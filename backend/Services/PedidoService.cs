using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Pagamento;
using RunWay.Api.DTOs.Pedidos;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace RunWay.Api.Services;

public class PedidoService : IPedidoService
{
    private readonly RunWayDbContext _context;
    private readonly IPagamentoService _pagamentoService;
    private readonly IAuditoriaService _auditoriaService;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly int _tempoExpiracaoProcessamentoMinutos;

    public PedidoService(
        RunWayDbContext context,
        IPagamentoService pagamentoService,
        IAuditoriaService auditoriaService,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        _context = context;
        _pagamentoService = pagamentoService;
        _auditoriaService = auditoriaService;
        _environment = environment;
        _configuration = configuration;
        _tempoExpiracaoProcessamentoMinutos = _configuration.GetValue<int>("Pedido:TempoExpiracaoProcessamentoMinutos", 30);
    }

    public async Task<PedidoResponseDto> CriarPedidoAsync(
        CriarPedidoRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("Requisição inválida.");
        }

        if (string.IsNullOrWhiteSpace(request.CodigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        var cliente = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Codigo == request.CodigoCliente, cancellationToken);

        if (cliente == null)
        {
            throw new NotFoundException("Cliente informado não foi encontrado.");
        }

        if (request.Itens == null || request.Itens.Count == 0)
        {
            throw new ValidationException("O pedido deve conter ao menos um item.");
        }

        // =========================================================================
        // 1. RESOLUÇÃO E VALIDAÇÃO EXCLUSIVA DO ENDEREÇO DE ENTREGA
        // =========================================================================
        bool temEnderecoCadastrado = request.EnderecoId.HasValue && request.EnderecoId.Value > 0;
        bool temEnderecoAvulso = request.EnderecoAvulso != null;

        if (!temEnderecoCadastrado && !temEnderecoAvulso)
        {
            throw new ValidationException("Informe um endereço para entrega do pedido.");
        }

        if (temEnderecoCadastrado && temEnderecoAvulso)
        {
            throw new ValidationException("Informe apenas um endereço cadastrado OU um endereço novo, não ambos.");
        }

        Endereco? enderecoCadastrado = null;
        string estadoParaFrete;
        string cepParaFrete;

        if (temEnderecoCadastrado)
        {
            enderecoCadastrado = await _context.Enderecos
                .FirstOrDefaultAsync(e => e.Id == request.EnderecoId!.Value && e.ClienteId == cliente.Id, cancellationToken);

            if (enderecoCadastrado == null)
            {
                throw new ValidationException("O endereço selecionado não pertence ao cliente informado.");
            }

            estadoParaFrete = enderecoCadastrado.Estado;
            cepParaFrete = enderecoCadastrado.Cep;
        }
        else
        {
            ValidarEnderecoAvulso(request.EnderecoAvulso!);
            estadoParaFrete = request.EnderecoAvulso!.Estado.Trim().ToUpperInvariant();
            cepParaFrete = Regex.Replace(request.EnderecoAvulso!.Cep ?? string.Empty, @"\D", "");
        }

        // =========================================================================
        // 2. REVALIDAÇÃO COMPLETA DA COMPRA VIA PAGAMENTOSERVICE
        //    (Estoque, Subtotal oficial com preços do banco, Frete oficial, Cupons e Cartões)
        // =========================================================================
        var validarRequest = new ValidarPagamentoRequestDto
        {
            CodigoCliente = request.CodigoCliente,
            Itens = request.Itens.Select(i => new ItemPedidoValidacaoDto
            {
                ProdutoVariacaoId = i.ProdutoVariacaoId,
                Quantidade = i.Quantidade
            }).ToList(),
            EnderecoId = temEnderecoCadastrado ? request.EnderecoId : null,
            Estado = estadoParaFrete,
            Cep = cepParaFrete,
            Cupons = request.Cupons ?? new List<string>(),
            Cartoes = (request.Cartoes ?? new List<ItemPagamentoCartaoPedidoDto>()).Select(c => new ItemPagamentoCartaoDto
            {
                CartaoId = c.CartaoId,
                Valor = c.Valor,
                CartaoNovo = c.CartaoNovo == null ? null : new NovoCartaoPagamentoDto
                {
                    BandeiraId = c.CartaoNovo.BandeiraId,
                    NumeroCartao = c.CartaoNovo.NumeroCartao,
                    NomeImpresso = c.CartaoNovo.NomeImpresso,
                    DataValidade = c.CartaoNovo.DataValidade,
                    Cvv = c.CartaoNovo.Cvv,
                    SalvarNoPerfil = c.CartaoNovo.SalvarNoPerfil
                }
            }).ToList()
        };

        var validacao = await _pagamentoService.ValidarPagamentoAsync(validarRequest, cancellationToken);

        if (!validacao.Valido)
        {
            throw new ValidationException(validacao.Mensagem);
        }

        // Carregar variações e produtos com preços oficiais para snapshot imutável nos itens
        var variacaoIds = request.Itens.Select(i => i.ProdutoVariacaoId).Distinct().ToList();
        var variacoesDb = await _context.ProdutoVariacoes
            .Include(v => v.Produto)
            .Where(v => variacaoIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);

        // Carregar cupons do banco
        var codigosCupons = validacao.CuponsUtilizados.Select(c => c.Codigo).ToList();
        var cuponsDb = await _context.Cupons
            .Where(c => codigosCupons.Contains(c.Codigo))
            .ToDictionaryAsync(c => c.Codigo, StringComparer.OrdinalIgnoreCase, cancellationToken);

        // Carregar bandeiras para detalhamento nos DTOs
        var bandeirasDb = await _context.Bandeiras.ToDictionaryAsync(b => b.Id, cancellationToken);

        // =========================================================================
        // 3. TRANSAÇÃO ATÔMICA DE PERSISTÊNCIA DO PEDIDO
        // =========================================================================
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // 3.0. Concorrência: Bloqueio FOR UPDATE nas variações em estoque no PostgreSQL
            foreach (var itemReq in request.Itens)
            {
                await _context.Estoques
                    .FromSqlInterpolated($"SELECT * FROM \"ESTOQUE\" WHERE produto_variacao_id = {itemReq.ProdutoVariacaoId} FOR UPDATE")
                    .FirstOrDefaultAsync(cancellationToken);
            }

            // 3.1. Obtenção thread-safe do próximo valor da sequence existente pedido_codigo_seq
            var seqVal = await _context.Database
                .SqlQueryRaw<long>("SELECT nextval('pedido_codigo_seq') AS \"Value\"")
                .FirstAsync(cancellationToken);

            string codigoPedido = $"RW-2026-{seqVal:D4}";

            // 3.2. Endereço e Snapshot histórico de 11 colunas
            int? enderecoIdFinal = null;
            var pedido = new Pedido
            {
                Codigo = codigoPedido,
                ClienteId = cliente.Id,
                Status = Pedido.StatusEmProcessamento,
                DataPedido = DateTimeOffset.UtcNow,
                Subtotal = validacao.Subtotal,
                ValorFrete = validacao.ValorFrete,
                ValorTotal = validacao.ValorTotal
            };

            if (temEnderecoCadastrado)
            {
                enderecoIdFinal = enderecoCadastrado!.Id;
                pedido.EnderecoEntregaId = enderecoIdFinal;
                pedido.EntregaTipoResidencia = enderecoCadastrado.TipoResidencia;
                pedido.EntregaTipoLogradouro = enderecoCadastrado.TipoLogradouro;
                pedido.EntregaLogradouro = enderecoCadastrado.Logradouro;
                pedido.EntregaNumero = enderecoCadastrado.Numero;
                pedido.EntregaComplemento = enderecoCadastrado.Complemento;
                pedido.EntregaBairro = enderecoCadastrado.Bairro;
                pedido.EntregaCep = enderecoCadastrado.Cep;
                pedido.EntregaCidade = enderecoCadastrado.Cidade;
                pedido.EntregaEstado = enderecoCadastrado.Estado;
                pedido.EntregaPais = enderecoCadastrado.Pais;
                pedido.EntregaObservacoes = enderecoCadastrado.Observacoes;
            }
            else
            {
                var avulso = request.EnderecoAvulso!;
                pedido.EntregaTipoResidencia = avulso.TipoResidencia.Trim();
                pedido.EntregaTipoLogradouro = avulso.TipoLogradouro.Trim();
                pedido.EntregaLogradouro = avulso.Logradouro.Trim();
                pedido.EntregaNumero = avulso.Numero.Trim();
                pedido.EntregaComplemento = avulso.Complemento?.Trim();
                pedido.EntregaBairro = avulso.Bairro.Trim();
                pedido.EntregaCep = Regex.Replace(avulso.Cep ?? string.Empty, @"\D", "");
                pedido.EntregaCidade = avulso.Cidade.Trim();
                pedido.EntregaEstado = avulso.Estado.Trim().ToUpperInvariant();
                pedido.EntregaPais = avulso.Pais.Trim();
                pedido.EntregaObservacoes = avulso.Observacoes?.Trim();

                if (avulso.SalvarNoPerfil)
                {
                    var novoEndereco = new Endereco
                    {
                        ClienteId = cliente.Id,
                        Nome = $"Entrega - {pedido.EntregaLogradouro}",
                        TipoResidencia = pedido.EntregaTipoResidencia,
                        TipoLogradouro = pedido.EntregaTipoLogradouro,
                        Logradouro = pedido.EntregaLogradouro,
                        Numero = pedido.EntregaNumero,
                        Complemento = pedido.EntregaComplemento,
                        Bairro = pedido.EntregaBairro,
                        Cep = pedido.EntregaCep,
                        Cidade = pedido.EntregaCidade,
                        Estado = pedido.EntregaEstado,
                        Pais = pedido.EntregaPais,
                        Observacoes = pedido.EntregaObservacoes,
                        Entrega = true,
                        Residencial = false,
                        Cobranca = false
                    };

                    _context.Enderecos.Add(novoEndereco);
                    await _context.SaveChangesAsync(cancellationToken);
                    enderecoIdFinal = novoEndereco.Id;
                    pedido.EnderecoEntregaId = novoEndereco.Id;
                }
                else
                {
                    pedido.EnderecoEntregaId = null;
                }
            }

            // 3.3. Itens do Pedido com congelamento do preço unitário oficial
            foreach (var itemReq in request.Itens)
            {
                var variacao = variacoesDb[itemReq.ProdutoVariacaoId];
                pedido.Itens.Add(new ItemPedido
                {
                    ProdutoVariacaoId = itemReq.ProdutoVariacaoId,
                    Quantidade = itemReq.Quantidade,
                    PrecoUnitario = variacao.Produto.Preco
                });
            }

            // 3.4. Pagamentos do Pedido
            // A) Cupons utilizados
            foreach (var cUtil in validacao.CuponsUtilizados)
            {
                var cupomDb = cuponsDb[cUtil.Codigo];
                pedido.Pagamentos.Add(new PagamentoPedido
                {
                    FormaPagamento = cupomDb.Tipo == Cupom.TipoPromocional ? PagamentoPedido.FormaCupomPromocional : PagamentoPedido.FormaCupomTroca,
                    Valor = cUtil.ValorUtilizado,
                    CupomId = cupomDb.Id,
                    CartaoId = null,
                    BandeiraId = null,
                    CartaoUltimosDigitos = null,
                    CartaoNomeImpresso = null
                });
            }

            // B) Cartões alocados
            if (request.Cartoes != null)
            {
                foreach (var cartaoReq in request.Cartoes)
                {
                    if (cartaoReq.CartaoId.HasValue && cartaoReq.CartaoId.Value > 0)
                    {
                        pedido.Pagamentos.Add(new PagamentoPedido
                        {
                            FormaPagamento = PagamentoPedido.FormaCartaoCredito,
                            Valor = cartaoReq.Valor,
                            CartaoId = cartaoReq.CartaoId.Value,
                            BandeiraId = null,
                            CartaoUltimosDigitos = null,
                            CartaoNomeImpresso = null,
                            CupomId = null
                        });
                    }
                    else if (cartaoReq.CartaoNovo != null)
                    {
                        var novo = cartaoReq.CartaoNovo;
                        var numLimpo = Regex.Replace(novo.NumeroCartao ?? string.Empty, @"\D", "");
                        var ultimosDigitos = numLimpo.Length >= 4 ? numLimpo[^4..] : numLimpo;

                        if (novo.SalvarNoPerfil)
                        {
                            var novoCartao = new Cartao
                            {
                                ClienteId = cliente.Id,
                                BandeiraId = novo.BandeiraId,
                                NumeroCartao = numLimpo,
                                NomeImpresso = novo.NomeImpresso.Trim(),
                                DataValidade = novo.DataValidade.Trim(),
                                Cvv = novo.Cvv.Trim(),
                                Preferencial = false
                            };

                            _context.Cartoes.Add(novoCartao);
                            await _context.SaveChangesAsync(cancellationToken);

                            pedido.Pagamentos.Add(new PagamentoPedido
                            {
                                FormaPagamento = PagamentoPedido.FormaCartaoCredito,
                                Valor = cartaoReq.Valor,
                                CartaoId = novoCartao.Id,
                                BandeiraId = null,
                                CartaoUltimosDigitos = null,
                                CartaoNomeImpresso = null,
                                CupomId = null
                            });
                        }
                        else
                        {
                            // Cartão não salvo: snapshot seguro sem CVV
                            pedido.Pagamentos.Add(new PagamentoPedido
                            {
                                FormaPagamento = PagamentoPedido.FormaCartaoCredito,
                                Valor = cartaoReq.Valor,
                                CartaoId = null,
                                BandeiraId = novo.BandeiraId,
                                CartaoUltimosDigitos = ultimosDigitos,
                                CartaoNomeImpresso = novo.NomeImpresso.Trim(),
                                CupomId = null
                            });
                        }
                    }
                }
            }

            // 3.5. Geração de cupom de troca por excedente (RN0036)
            Cupom? novoCupomTroca = null;
            if (validacao.ValorExcedenteCupons > 0)
            {
                novoCupomTroca = new Cupom
                {
                    Codigo = $"TROCA-CLI{cliente.Id}-{codigoPedido}",
                    Tipo = Cupom.TipoTroca,
                    Valor = validacao.ValorExcedenteCupons,
                    ClienteId = cliente.Id
                };

                _context.Cupons.Add(novoCupomTroca);
            }

            // 3.6. Auditoria explícita dos 4 escopos na mesma transação atômica
            // Escopo 1: PEDIDO
            await _auditoriaService.RegistrarAsync(
                entidade: "PEDIDO",
                registroId: pedido.Codigo,
                operacao: "INSERCAO",
                dadosAnteriores: null,
                dadosNovos: new
                {
                    codigo = pedido.Codigo,
                    clienteId = pedido.ClienteId,
                    status = pedido.Status,
                    subtotal = pedido.Subtotal,
                    valorFrete = pedido.ValorFrete,
                    valorTotal = pedido.ValorTotal,
                    enderecoEntrega = new
                    {
                        enderecoId = pedido.EnderecoEntregaId,
                        tipoResidencia = pedido.EntregaTipoResidencia,
                        tipoLogradouro = pedido.EntregaTipoLogradouro,
                        logradouro = pedido.EntregaLogradouro,
                        numero = pedido.EntregaNumero,
                        complemento = pedido.EntregaComplemento,
                        bairro = pedido.EntregaBairro,
                        cep = pedido.EntregaCep,
                        cidade = pedido.EntregaCidade,
                        estado = pedido.EntregaEstado,
                        pais = pedido.EntregaPais
                    },
                    quantidadeItens = pedido.Itens.Count
                },
                usuarioResponsavel: cliente.Nome,
                cancellationToken: cancellationToken);

            // Escopo 2: ITEM_PEDIDO
            foreach (var item in pedido.Itens)
            {
                await _auditoriaService.RegistrarAsync(
                    entidade: "ITEM_PEDIDO",
                    registroId: $"{pedido.Codigo}-{item.ProdutoVariacaoId}",
                    operacao: "INSERCAO",
                    dadosAnteriores: null,
                    dadosNovos: new
                    {
                        pedidoCodigo = pedido.Codigo,
                        produtoVariacaoId = item.ProdutoVariacaoId,
                        quantidade = item.Quantidade,
                        precoUnitario = item.PrecoUnitario
                    },
                    usuarioResponsavel: cliente.Nome,
                    cancellationToken: cancellationToken);
            }

            // Escopo 3: PAGAMENTO_PEDIDO (sem CVV)
            int pagIdx = 1;
            foreach (var pg in pedido.Pagamentos)
            {
                await _auditoriaService.RegistrarAsync(
                    entidade: "PAGAMENTO_PEDIDO",
                    registroId: $"{pedido.Codigo}-PAG{pagIdx++}",
                    operacao: "INSERCAO",
                    dadosAnteriores: null,
                    dadosNovos: new
                    {
                        pedidoCodigo = pedido.Codigo,
                        formaPagamento = pg.FormaPagamento,
                        valor = pg.Valor,
                        cartaoId = pg.CartaoId,
                        bandeiraId = pg.BandeiraId,
                        cartaoUltimosDigitos = pg.CartaoUltimosDigitos,
                        cartaoNomeImpresso = pg.CartaoNomeImpresso,
                        cupomId = pg.CupomId
                    },
                    usuarioResponsavel: cliente.Nome,
                    cancellationToken: cancellationToken);
            }

            // Escopo 4: CUPOM (se houve cupom por excedente)
            if (novoCupomTroca != null)
            {
                await _auditoriaService.RegistrarAsync(
                    entidade: "CUPOM",
                    registroId: novoCupomTroca.Codigo,
                    operacao: "INSERCAO",
                    dadosAnteriores: null,
                    dadosNovos: new
                    {
                        codigo = novoCupomTroca.Codigo,
                        tipo = novoCupomTroca.Tipo,
                        valor = novoCupomTroca.Valor,
                        clienteId = novoCupomTroca.ClienteId,
                        origemPedido = pedido.Codigo
                    },
                    usuarioResponsavel: cliente.Nome,
                    cancellationToken: cancellationToken);
            }

            // 3.6. Transferência atômica da reserva do carrinho para o pedido:
            // Remove os itens correspondentes do carrinho persistido do cliente
            var carrinhoCliente = await _context.Carrinhos
                .Include(c => c.Itens)
                .FirstOrDefaultAsync(c => c.ClienteId == cliente.Id, cancellationToken);

            if (carrinhoCliente != null && carrinhoCliente.Itens.Count > 0)
            {
                var variacaoIdsPedidas = request.Itens.Select(i => i.ProdutoVariacaoId).ToHashSet();
                var itensParaRemover = carrinhoCliente.Itens
                    .Where(i => variacaoIdsPedidas.Contains(i.ProdutoVariacaoId))
                    .ToList();

                if (itensParaRemover.Count > 0)
                {
                    _context.ItensCarrinho.RemoveRange(itensParaRemover);
                    carrinhoCliente.DataAtualizacao = DateTimeOffset.UtcNow;
                }
            }

            // 3.7. Persistência única e Commit
            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // =====================================================================
            // 4. MAPEAMENTO DO RESPONSE DTO
            // =====================================================================
            var responseDto = new PedidoResponseDto
            {
                Id = pedido.Id,
                Codigo = pedido.Codigo,
                CodigoCliente = cliente.Codigo,
                NomeCliente = cliente.Nome,
                Status = pedido.Status,
                DataPedido = pedido.DataPedido,
                Subtotal = pedido.Subtotal,
                ValorFrete = pedido.ValorFrete,
                ValorTotal = pedido.ValorTotal,
                EnderecoEntrega = new EnderecoEntregaResponseDto
                {
                    EnderecoId = pedido.EnderecoEntregaId,
                    TipoResidencia = pedido.EntregaTipoResidencia,
                    TipoLogradouro = pedido.EntregaTipoLogradouro,
                    Logradouro = pedido.EntregaLogradouro,
                    Numero = pedido.EntregaNumero,
                    Complemento = pedido.EntregaComplemento,
                    Bairro = pedido.EntregaBairro,
                    Cep = pedido.EntregaCep,
                    Cidade = pedido.EntregaCidade,
                    Estado = pedido.EntregaEstado,
                    Pais = pedido.EntregaPais,
                    Observacoes = pedido.EntregaObservacoes
                },
                Itens = pedido.Itens.Select(i =>
                {
                    var varDb = variacoesDb[i.ProdutoVariacaoId];
                    return new ItemPedidoResponseDto
                    {
                        Id = i.Id,
                        ProdutoVariacaoId = i.ProdutoVariacaoId,
                        ProdutoCodigo = varDb.Produto.Codigo,
                        ProdutoNome = varDb.Produto.Nome,
                        Marca = varDb.Produto.Marca,
                        ImagemUrl = varDb.Produto.ImagemUrl,
                        Tamanho = varDb.Tamanho.ToString(),
                        Quantidade = i.Quantidade,
                        PrecoUnitario = i.PrecoUnitario
                    };
                }).ToList(),
                Pagamentos = pedido.Pagamentos.Select(p =>
                {
                    string? nomeBandeira = null;
                    if (p.BandeiraId.HasValue && bandeirasDb.TryGetValue(p.BandeiraId.Value, out var bDb))
                    {
                        nomeBandeira = bDb.Nome;
                    }

                    string? cupomCod = null;
                    if (p.CupomId.HasValue)
                    {
                        var found = cuponsDb.Values.FirstOrDefault(c => c.Id == p.CupomId.Value);
                        cupomCod = found?.Codigo;
                    }

                    return new PagamentoPedidoResponseDto
                    {
                        Id = p.Id,
                        FormaPagamento = p.FormaPagamento,
                        Valor = p.Valor,
                        CartaoId = p.CartaoId,
                        Bandeira = nomeBandeira,
                        CartaoUltimosDigitos = p.CartaoUltimosDigitos,
                        CartaoNomeImpresso = p.CartaoNomeImpresso,
                        CupomId = p.CupomId,
                        CupomCodigo = cupomCod
                    };
                }).ToList()
            };

            if (novoCupomTroca != null)
            {
                responseDto.NovoCupomTroca = new NovoCupomTrocaResponseDto
                {
                    Id = novoCupomTroca.Id,
                    Codigo = novoCupomTroca.Codigo,
                    Valor = novoCupomTroca.Valor,
                    Mensagem = $"Cupom de troca gerado automaticamente pelo excedente de pagamento: R$ {novoCupomTroca.Valor:N2}."
                };
            }

            return responseDto;
        }
        catch (DbUpdateException ex)
        {
            await transaction.RollbackAsync(cancellationToken);

            if (ex.InnerException?.Message.Contains("uq_pagamento_pedido_cupom_troca") == true ||
                ex.Message.Contains("uq_pagamento_pedido_cupom_troca"))
            {
                throw new ConflictException("O cupom de troca informado já foi utilizado em outra transação concorrente.");
            }

            throw;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<List<PedidoResponseDto>> ListarTodosAsync(
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = ObterQueryPedidosCompleta();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("TODOS", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(p => p.Status.ToUpper() == status.Trim().ToUpper());
        }

        var pedidos = await query
            .OrderByDescending(p => p.DataPedido)
            .ToListAsync(cancellationToken);

        return pedidos.Select(p => MapearParaResponseDto(p)).ToList();
    }

    public async Task<List<PedidoResponseDto>> ListarPorClienteAsync(
        string codigoCliente,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigoCliente))
        {
            throw new ValidationException("Código do cliente é obrigatório.");
        }

        var clienteExiste = await _context.Clientes
            .AsNoTracking()
            .AnyAsync(c => c.Codigo == codigoCliente.Trim(), cancellationToken);

        if (!clienteExiste)
        {
            throw new NotFoundException($"Cliente com código '{codigoCliente}' não foi encontrado.");
        }

        var pedidos = await ObterQueryPedidosCompleta()
            .Where(p => p.Cliente.Codigo == codigoCliente.Trim())
            .OrderByDescending(p => p.DataPedido)
            .ToListAsync(cancellationToken);

        foreach (var p in pedidos.Where(p => p.Status == Pedido.StatusEmProcessamento).ToList())
        {
            await VerificarEAtualizarExpiracaoPedidoAsync(p, cancellationToken);
        }

        return pedidos.Select(p => MapearParaResponseDto(p)).ToList();
    }

    public async Task<PedidoResponseDto> ObterPorCodigoAsync(
        string codigo,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigo))
        {
            throw new ValidationException("Código do pedido é obrigatório.");
        }

        var pedido = await ObterQueryPedidosCompleta()
            .FirstOrDefaultAsync(p => p.Codigo == codigo.Trim(), cancellationToken);

        if (pedido == null)
        {
            throw new NotFoundException($"Pedido com código '{codigo}' não foi encontrado.");
        }

        if (pedido.Status == Pedido.StatusEmProcessamento)
        {
            await VerificarEAtualizarExpiracaoPedidoAsync(pedido, cancellationToken);
        }

        // Verificar se existe cupom de troca gerado por excedente vinculado a este pedido
        NovoCupomTrocaResponseDto? novoCupomTroca = null;
        var cupomExcedente = await _context.Cupons
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Codigo == $"TROCA-CLI{pedido.ClienteId}-{pedido.Codigo}", cancellationToken);

        if (cupomExcedente != null)
        {
            novoCupomTroca = new NovoCupomTrocaResponseDto
            {
                Id = cupomExcedente.Id,
                Codigo = cupomExcedente.Codigo,
                Valor = cupomExcedente.Valor,
                Mensagem = $"Cupom de troca gerado automaticamente pelo excedente de pagamento: R$ {cupomExcedente.Valor:N2}."
            };
        }

        return MapearParaResponseDto(pedido, novoCupomTroca);
    }

    public async Task<PedidoResponseDto> ProcessarPagamentoAsync(
        string codigo,
        ProcessarPagamentoPedidoRequestDto? request = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigo))
        {
            throw new ValidationException("Código do pedido é obrigatório.");
        }

        var pedido = await _context.Pedidos
            .Include(p => p.Cliente)
            .Include(p => p.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto)
            .Include(p => p.Pagamentos)
                .ThenInclude(pg => pg.Cartao)
            .Include(p => p.Pagamentos)
                .ThenInclude(pg => pg.Cupom)
            .FirstOrDefaultAsync(p => p.Codigo == codigo.Trim(), cancellationToken);

        if (pedido == null)
        {
            throw new NotFoundException($"Pedido com código '{codigo}' não foi encontrado.");
        }

        if (pedido.Status != Pedido.StatusEmProcessamento)
        {
            throw new ValidationException(
                $"O pagamento do pedido '{codigo}' já foi processado anteriormente com status '{pedido.Status}'. Não é permitido alterar uma transação já concluída.");
        }

        bool aprovado;
        string motivoFinal;

        if (!string.IsNullOrWhiteSpace(request?.ForcarResultado))
        {
            if (!_environment.IsDevelopment())
            {
                throw new ValidationException("A manipulação arbitrária do resultado de pagamento só é permitida em ambiente de desenvolvimento/testes.");
            }

            var forcar = NormalizarStatus(request.ForcarResultado);
            if (forcar == Pedido.StatusAprovada)
            {
                aprovado = true;
                motivoFinal = request.Motivo ?? "Pagamento aprovado via simulação de teste controlada";
            }
            else if (forcar == Pedido.StatusReprovada)
            {
                aprovado = false;
                motivoFinal = request.Motivo ?? "Pagamento reprovado via simulação de teste controlada";
            }
            else
            {
                throw new ValidationException($"Resultado forçado '{request.ForcarResultado}' inválido. Utilize 'APROVADA' ou 'REPROVADA'.");
            }
        }
        else
        {
            var pagamentosCartao = pedido.Pagamentos
                .Where(p => p.FormaPagamento == PagamentoPedido.FormaCartaoCredito)
                .ToList();

            if (pagamentosCartao.Count == 0)
            {
                // Compra 100% coberta por cupons: aprovada sem necessidade de consulta à operadora de cartão
                aprovado = true;
                motivoFinal = "Pagamento integralmente coberto por cupons";
            }
            else
            {
                // Simulação determinística acadêmica para testes:
                // Reprovação ocorre se:
                // 1. O nome impresso contiver "REPROVAR", "RECUSAR" ou "REJEITAR"
                // 2. Os últimos dígitos do cartão forem "9999"
                // (NÃO reprova por "0000", preservando cartões de teste existentes)
                bool temCartaoReprovado = false;
                string detalheReprovacao = string.Empty;

                foreach (var pg in pagamentosCartao)
                {
                    string nome = (pg.Cartao?.NomeImpresso ?? pg.CartaoNomeImpresso ?? string.Empty).ToUpperInvariant();
                    string ultimos = pg.Cartao?.NumeroCartao != null && pg.Cartao.NumeroCartao.Length >= 4
                        ? pg.Cartao.NumeroCartao[^4..]
                        : (pg.CartaoUltimosDigitos ?? string.Empty);

                    if (nome.Contains("REPROVAR") || nome.Contains("RECUSAR") || nome.Contains("REJEITAR"))
                    {
                        temCartaoReprovado = true;
                        detalheReprovacao = "Operadora recusou a transação: titular do cartão instruído para reprovação de teste";
                        break;
                    }

                    if (ultimos == "9999")
                    {
                        temCartaoReprovado = true;
                        detalheReprovacao = "Operadora recusou a transação: cartão de teste com final 9999";
                        break;
                    }
                }

                if (temCartaoReprovado)
                {
                    aprovado = false;
                    motivoFinal = detalheReprovacao;
                }
                else
                {
                    aprovado = true;
                    motivoFinal = "Transação autorizada com sucesso pela operadora de cartão";
                }
            }
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var agora = DateTimeOffset.UtcNow;
            var cutoffProcessamento = agora.AddMinutes(-_tempoExpiracaoProcessamentoMinutos);
            bool reservaExpirada = pedido.DataPedido < cutoffProcessamento;

            if (reservaExpirada)
            {
                aprovado = false;
                motivoFinal = "Pagamento reprovado: O prazo de reserva e pagamento de 30 minutos expirou.";
            }

            if (aprovado)
            {
                // 1. Concorrência: Bloqueio FOR UPDATE nas variações em estoque no PostgreSQL e validação de disponibilidade real
                foreach (var item in pedido.Itens)
                {
                    var estoque = await _context.Estoques
                        .FromSqlInterpolated($"SELECT * FROM \"ESTOQUE\" WHERE produto_variacao_id = {item.ProdutoVariacaoId} FOR UPDATE")
                        .FirstOrDefaultAsync(cancellationToken);

                    // Se não há estoque físico suficiente:
                    if (estoque == null || estoque.Quantidade < item.Quantidade)
                    {
                        aprovado = false;
                        motivoFinal = $"Pagamento reprovado: Estoque insuficiente para o produto '{item.ProdutoVariacao?.Produto?.Nome}' (Tam: {item.ProdutoVariacao?.Tamanho}).";
                        break;
                    }
                }
            }

            if (aprovado)
            {
                // 1. Baixa definitiva de estoque (RF0053 / RN0028)
                foreach (var item in pedido.Itens)
                {
                    var estoque = await _context.Estoques
                        .FirstAsync(e => e.ProdutoVariacaoId == item.ProdutoVariacaoId, cancellationToken);

                    int qtdAnterior = estoque.Quantidade;
                    estoque.Quantidade -= item.Quantidade;

                    await _auditoriaService.RegistrarAsync(
                        entidade: "ESTOQUE",
                        registroId: estoque.Id.ToString(),
                        operacao: "BAIXA_VENDA",
                        dadosAnteriores: new { produtoVariacaoId = estoque.ProdutoVariacaoId, quantidade = qtdAnterior },
                        dadosNovos: new { produtoVariacaoId = estoque.ProdutoVariacaoId, quantidade = estoque.Quantidade, pedidoCodigo = pedido.Codigo, quantidadeBaixada = item.Quantidade },
                        usuarioResponsavel: "Sistema - Processamento de Pagamento",
                        cancellationToken: cancellationToken);
                }

                // 2. Transição para APROVADA
                string statusAnterior = pedido.Status;
                pedido.Status = Pedido.StatusAprovada;

                await _auditoriaService.RegistrarAsync(
                    entidade: "PEDIDO",
                    registroId: pedido.Codigo,
                    operacao: "PAGAMENTO_APROVADO",
                    dadosAnteriores: new { status = statusAnterior },
                    dadosNovos: new { status = pedido.Status, motivo = motivoFinal },
                    usuarioResponsavel: "Sistema - Operadora",
                    cancellationToken: cancellationToken);
            }
            else
            {
                // 1. Reprovação (RN0038): NÃO baixa estoque
                // 2. Liberar cupons reservados para reutilização (RN0036)
                var pagamentosCupons = pedido.Pagamentos
                    .Where(p => p.FormaPagamento == PagamentoPedido.FormaCupomPromocional || p.FormaPagamento == PagamentoPedido.FormaCupomTroca)
                    .ToList();

                foreach (var pgCupom in pagamentosCupons)
                {
                    await _auditoriaService.RegistrarAsync(
                        entidade: "CUPOM",
                        registroId: pgCupom.Cupom?.Codigo ?? pgCupom.CupomId?.ToString() ?? "CUPOM",
                        operacao: "LIBERACAO_RESERVA",
                        dadosAnteriores: new { pedidoCodigo = pedido.Codigo, formaPagamento = pgCupom.FormaPagamento, valor = pgCupom.Valor },
                        dadosNovos: new { status = "LIBERADO_PARA_REUSO", motivo = "Pagamento do pedido reprovado" },
                        usuarioResponsavel: "Sistema - Operadora",
                        cancellationToken: cancellationToken);

                    _context.PagamentosPedido.Remove(pgCupom);
                }

                // 3. Se foi gerado cupom de excedente para este pedido, exclui para impedir utilização indevida
                var surplusCupom = await _context.Cupons
                    .FirstOrDefaultAsync(c => c.Codigo == $"TROCA-CLI{pedido.ClienteId}-{pedido.Codigo}", cancellationToken);

                if (surplusCupom != null)
                {
                    await _auditoriaService.RegistrarAsync(
                        entidade: "CUPOM",
                        registroId: surplusCupom.Codigo,
                        operacao: "EXCLUSAO_EXCEDENTE",
                        dadosAnteriores: new { codigo = surplusCupom.Codigo, valor = surplusCupom.Valor },
                        dadosNovos: null,
                        usuarioResponsavel: "Sistema - Operadora",
                        cancellationToken: cancellationToken);

                    _context.Cupons.Remove(surplusCupom);
                }

                // 4. Transição para REPROVADA
                string statusAnterior = pedido.Status;
                pedido.Status = Pedido.StatusReprovada;

                await _auditoriaService.RegistrarAsync(
                    entidade: "PEDIDO",
                    registroId: pedido.Codigo,
                    operacao: "PAGAMENTO_REPROVADO",
                    dadosAnteriores: new { status = statusAnterior },
                    dadosNovos: new { status = pedido.Status, motivo = motivoFinal },
                    usuarioResponsavel: "Sistema - Operadora",
                    cancellationToken: cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterPorCodigoAsync(pedido.Codigo, cancellationToken);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<PedidoResponseDto> AtualizarStatusAsync(
        string codigo,
        AtualizarStatusPedidoRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigo))
        {
            throw new ValidationException("Código do pedido é obrigatório.");
        }

        if (request == null || string.IsNullOrWhiteSpace(request.NovoStatus))
        {
            throw new ValidationException("Novo status é obrigatório.");
        }

        var pedido = await _context.Pedidos
            .FirstOrDefaultAsync(p => p.Codigo == codigo.Trim(), cancellationToken);

        if (pedido == null)
        {
            throw new NotFoundException($"Pedido com código '{codigo}' não foi encontrado.");
        }

        var novoStatusNorm = NormalizarStatus(request.NovoStatus);

        // Se a solicitação for de APROVADA ou REPROVADA, redirecionar para ProcessarPagamentoAsync
        if (novoStatusNorm == Pedido.StatusAprovada || novoStatusNorm == Pedido.StatusReprovada)
        {
            return await ProcessarPagamentoAsync(codigo, new ProcessarPagamentoPedidoRequestDto
            {
                ForcarResultado = novoStatusNorm,
                Motivo = request.Motivo
            }, cancellationToken);
        }

        if (pedido.Status == Pedido.StatusReprovada)
        {
            throw new ValidationException($"O pedido '{codigo}' foi REPROVADO e não pode avançar no fluxo de entrega.");
        }

        if (novoStatusNorm == Pedido.StatusEmTransporte)
        {
            // RF0039 / RN0039: Despacho de pedido aprovado
            if (pedido.Status != Pedido.StatusAprovada)
            {
                throw new ValidationException(
                    $"Transição inválida. O pedido deve estar '{Pedido.StatusAprovada}' para ser despachado ('{Pedido.StatusEmTransporte}'). Status atual: '{pedido.Status}'.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            string statusAnterior = pedido.Status;
            pedido.Status = Pedido.StatusEmTransporte;

            await _auditoriaService.RegistrarAsync(
                entidade: "PEDIDO",
                registroId: pedido.Codigo,
                operacao: "DESPACHO",
                dadosAnteriores: new { status = statusAnterior },
                dadosNovos: new { status = pedido.Status, motivo = request.Motivo ?? "Pedido despachado para entrega" },
                usuarioResponsavel: request.UsuarioResponsavel ?? "Administrador",
                cancellationToken: cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterPorCodigoAsync(pedido.Codigo, cancellationToken);
        }

        if (novoStatusNorm == Pedido.StatusEntregue)
        {
            // RF0040 / RN0040: Confirmação de entrega
            if (pedido.Status != Pedido.StatusEmTransporte)
            {
                throw new ValidationException(
                    $"Transição inválida. O pedido deve estar '{Pedido.StatusEmTransporte}' para ser confirmado como '{Pedido.StatusEntregue}'. Status atual: '{pedido.Status}'.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            string statusAnterior = pedido.Status;
            pedido.Status = Pedido.StatusEntregue;

            await _auditoriaService.RegistrarAsync(
                entidade: "PEDIDO",
                registroId: pedido.Codigo,
                operacao: "ENTREGA_CONFIRMADA",
                dadosAnteriores: new { status = statusAnterior },
                dadosNovos: new { status = pedido.Status, motivo = request.Motivo ?? "Entrega do pedido confirmada" },
                usuarioResponsavel: request.UsuarioResponsavel ?? "Sistema / Transportadora",
                cancellationToken: cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await ObterPorCodigoAsync(pedido.Codigo, cancellationToken);
        }

        throw new ValidationException(
            $"Transição de status de '{pedido.Status}' para '{request.NovoStatus}' não é permitida pelas regras de negócio do RunWay.");
    }

    private static string NormalizarStatus(string status)
    {
        var s = status.Trim().ToUpperInvariant();
        return s switch
        {
            "APROVADO" or "APROVADA" or "PAGAMENTO REALIZADO" => Pedido.StatusAprovada,
            "REPROVADO" or "REPROVADA" => Pedido.StatusReprovada,
            "EM TRANSPORTE" or "EM TRANSITO" or "EM TRÂNSITO" => Pedido.StatusEmTransporte,
            "ENTREGUE" => Pedido.StatusEntregue,
            "EM PROCESSAMENTO" => Pedido.StatusEmProcessamento,
            "EM TROCA" => Pedido.StatusEmTroca,
            "TROCA AUTORIZADA" => Pedido.StatusTrocaAutorizada,
            "TROCADO" => Pedido.StatusTrocado,
            _ => s
        };
    }

    private IQueryable<Pedido> ObterQueryPedidosCompleta()
    {
        return _context.Pedidos
            .AsNoTracking()
            .Include(p => p.Cliente)
            .Include(p => p.Itens)
                .ThenInclude(i => i.ProdutoVariacao)
                    .ThenInclude(pv => pv.Produto)
            .Include(p => p.Pagamentos)
                .ThenInclude(pg => pg.Cartao)
                    .ThenInclude(c => c!.Bandeira)
            .Include(p => p.Pagamentos)
                .ThenInclude(pg => pg.Bandeira)
            .Include(p => p.Pagamentos)
                .ThenInclude(pg => pg.Cupom);
    }

    private static PedidoResponseDto MapearParaResponseDto(Pedido p, NovoCupomTrocaResponseDto? novoCupomTroca = null)
    {
        return new PedidoResponseDto
        {
            Id = p.Id,
            Codigo = p.Codigo,
            CodigoCliente = p.Cliente?.Codigo ?? string.Empty,
            NomeCliente = p.Cliente?.Nome ?? string.Empty,
            Status = p.Status,
            DataPedido = p.DataPedido,
            Subtotal = p.Subtotal,
            ValorFrete = p.ValorFrete,
            ValorTotal = p.ValorTotal,
            EnderecoEntrega = new EnderecoEntregaResponseDto
            {
                EnderecoId = p.EnderecoEntregaId,
                TipoResidencia = p.EntregaTipoResidencia,
                TipoLogradouro = p.EntregaTipoLogradouro,
                Logradouro = p.EntregaLogradouro,
                Numero = p.EntregaNumero,
                Complemento = p.EntregaComplemento,
                Bairro = p.EntregaBairro,
                Cep = p.EntregaCep,
                Cidade = p.EntregaCidade,
                Estado = p.EntregaEstado,
                Pais = p.EntregaPais,
                Observacoes = p.EntregaObservacoes
            },
            Itens = p.Itens.Select(i => new ItemPedidoResponseDto
            {
                Id = i.Id,
                ProdutoVariacaoId = i.ProdutoVariacaoId,
                ProdutoCodigo = i.ProdutoVariacao?.Produto?.Codigo ?? string.Empty,
                ProdutoNome = i.ProdutoVariacao?.Produto?.Nome ?? string.Empty,
                Marca = i.ProdutoVariacao?.Produto?.Marca ?? string.Empty,
                ImagemUrl = i.ProdutoVariacao?.Produto?.ImagemUrl ?? string.Empty,
                Tamanho = i.ProdutoVariacao != null ? i.ProdutoVariacao.Tamanho.ToString() : string.Empty,
                Quantidade = i.Quantidade,
                PrecoUnitario = i.PrecoUnitario
            }).ToList(),
            Pagamentos = p.Pagamentos.Select(pg =>
            {
                string? nomeBandeira = null;
                string? ultimosDigitos = null;
                string? nomeImpresso = null;

                if (pg.Cartao != null)
                {
                    nomeBandeira = pg.Cartao.Bandeira?.Nome;
                    var numLimpo = pg.Cartao.NumeroCartao ?? string.Empty;
                    ultimosDigitos = numLimpo.Length >= 4 ? numLimpo[^4..] : numLimpo;
                    nomeImpresso = pg.Cartao.NomeImpresso;
                }
                else
                {
                    nomeBandeira = pg.Bandeira?.Nome;
                    ultimosDigitos = pg.CartaoUltimosDigitos;
                    nomeImpresso = pg.CartaoNomeImpresso;
                }

                return new PagamentoPedidoResponseDto
                {
                    Id = pg.Id,
                    FormaPagamento = pg.FormaPagamento,
                    Valor = pg.Valor,
                    CartaoId = pg.CartaoId,
                    Bandeira = nomeBandeira,
                    CartaoUltimosDigitos = ultimosDigitos,
                    CartaoNomeImpresso = nomeImpresso,
                    CupomId = pg.CupomId,
                    CupomCodigo = pg.Cupom?.Codigo
                };
            }).ToList(),
            NovoCupomTroca = novoCupomTroca
        };
    }

    private static void ValidarEnderecoAvulso(EnderecoAvulsoPedidoDto avulso)
    {
        if (string.IsNullOrWhiteSpace(avulso.TipoResidencia))
        {
            throw new ValidationException("O tipo de residência do endereço de entrega é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.TipoLogradouro))
        {
            throw new ValidationException("O tipo de logradouro do endereço de entrega é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.Logradouro))
        {
            throw new ValidationException("O logradouro do endereço de entrega é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.Numero))
        {
            throw new ValidationException("O número do endereço de entrega é obrigatório. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.Bairro))
        {
            throw new ValidationException("O bairro do endereço de entrega é obrigatório. (RN0023)");
        }

        var cepLimpo = Regex.Replace(avulso.Cep ?? string.Empty, @"\D", "");
        if (cepLimpo.Length != 8)
        {
            throw new ValidationException("O CEP do endereço de entrega deve conter exatamente 8 dígitos numéricos. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.Cidade))
        {
            throw new ValidationException("A cidade do endereço de entrega é obrigatória. (RN0023)");
        }

        if (string.IsNullOrWhiteSpace(avulso.Estado))
        {
            throw new ValidationException("O estado do endereço de entrega é obrigatório. (RN0023)");
        }

        var uf = avulso.Estado.Trim().ToUpperInvariant();
        var ufsValidas = new HashSet<string>
        {
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
            "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
            "RS", "RO", "RR", "SC", "SP", "SE", "TO"
        };

        if (!ufsValidas.Contains(uf))
        {
            throw new ValidationException($"UF '{uf}' informada no endereço de entrega é inválida.");
        }

        if (string.IsNullOrWhiteSpace(avulso.Pais))
        {
            throw new ValidationException("O país do endereço de entrega é obrigatório. (RN0023)");
        }
    }

    private async Task VerificarEAtualizarExpiracaoPedidoAsync(Pedido pedido, CancellationToken cancellationToken)
    {
        if (pedido.Status != Pedido.StatusEmProcessamento) return;

        var agora = DateTimeOffset.UtcNow;
        var cutoff = agora.AddMinutes(-_tempoExpiracaoProcessamentoMinutos);
        if (pedido.DataPedido >= cutoff) return;

        // O prazo de reserva e pagamento de 30 minutos expirou: reprovar de forma consistente
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var pagamentosCupons = await _context.PagamentosPedido
                .Include(p => p.Cupom)
                .Where(p => p.PedidoId == pedido.Id && (p.FormaPagamento == PagamentoPedido.FormaCupomPromocional || p.FormaPagamento == PagamentoPedido.FormaCupomTroca))
                .ToListAsync(cancellationToken);

            foreach (var pgCupom in pagamentosCupons)
            {
                await _auditoriaService.RegistrarAsync(
                    entidade: "CUPOM",
                    registroId: pgCupom.Cupom?.Codigo ?? pgCupom.CupomId?.ToString() ?? "CUPOM",
                    operacao: "LIBERACAO_RESERVA",
                    dadosAnteriores: new { pedidoCodigo = pedido.Codigo, formaPagamento = pgCupom.FormaPagamento, valor = pgCupom.Valor },
                    dadosNovos: new { status = "LIBERADO_PARA_REUSO", motivo = "Prazo de 30 minutos de reserva e pagamento expirou." },
                    usuarioResponsavel: "Sistema - Expiracao de Reserva",
                    cancellationToken: cancellationToken);

                _context.PagamentosPedido.Remove(pgCupom);
            }

            var surplusCupom = await _context.Cupons
                .FirstOrDefaultAsync(c => c.Codigo == $"TROCA-CLI{pedido.ClienteId}-{pedido.Codigo}", cancellationToken);

            if (surplusCupom != null)
            {
                await _auditoriaService.RegistrarAsync(
                    entidade: "CUPOM",
                    registroId: surplusCupom.Codigo,
                    operacao: "EXCLUSAO_EXCEDENTE",
                    dadosAnteriores: new { codigo = surplusCupom.Codigo, valor = surplusCupom.Valor },
                    dadosNovos: null,
                    usuarioResponsavel: "Sistema - Expiracao de Reserva",
                    cancellationToken: cancellationToken);

                _context.Cupons.Remove(surplusCupom);
            }

            var pedidoDb = await _context.Pedidos.FirstAsync(p => p.Id == pedido.Id, cancellationToken);
            string statusAnt = pedidoDb.Status;
            pedidoDb.Status = Pedido.StatusReprovada;
            pedido.Status = Pedido.StatusReprovada;

            await _auditoriaService.RegistrarAsync(
                entidade: "PEDIDO",
                registroId: pedido.Codigo,
                operacao: "PAGAMENTO_REPROVADO",
                dadosAnteriores: new { status = statusAnt },
                dadosNovos: new { status = pedido.Status, motivo = "Prazo de 30 minutos de reserva e pagamento expirou." },
                usuarioResponsavel: "Sistema - Expiracao de Reserva",
                cancellationToken: cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }
}
