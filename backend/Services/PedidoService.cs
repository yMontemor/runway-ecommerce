using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Pagamento;
using RunWay.Api.DTOs.Pedidos;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class PedidoService : IPedidoService
{
    private readonly RunWayDbContext _context;
    private readonly IPagamentoService _pagamentoService;
    private readonly IAuditoriaService _auditoriaService;

    public PedidoService(
        RunWayDbContext context,
        IPagamentoService pagamentoService,
        IAuditoriaService auditoriaService)
    {
        _context = context;
        _pagamentoService = pagamentoService;
        _auditoriaService = auditoriaService;
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
                        ProdutoNome = varDb.Produto.Nome,
                        Marca = varDb.Produto.Marca,
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
}
