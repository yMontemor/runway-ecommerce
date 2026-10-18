using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Frete;
using RunWay.Api.DTOs.Pagamento;
using RunWay.Api.DTOs.Produtos;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

public class PagamentoService : IPagamentoService
{
    private readonly RunWayDbContext _context;
    private readonly IProdutoService _produtoService;
    private readonly IFreteService _freteService;

    public PagamentoService(
        RunWayDbContext context,
        IProdutoService produtoService,
        IFreteService freteService)
    {
        _context = context;
        _produtoService = produtoService;
        _freteService = freteService;
    }

    public async Task<ValidarPagamentoResponseDto> ValidarPagamentoAsync(
        ValidarPagamentoRequestDto request,
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
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Codigo == request.CodigoCliente, cancellationToken);

        if (cliente == null)
        {
            throw new NotFoundException("Cliente informado não foi encontrado.");
        }

        if (request.Itens == null || request.Itens.Count == 0)
        {
            throw new ValidationException("O carrinho deve conter ao menos um item.");
        }

        // 1. Validação de estoque e variações através do ProdutoService
        var validacaoEstoque = await _produtoService.ValidarEstoqueAsync(new ValidacaoEstoqueRequestDto
        {
            CodigoCliente = request.CodigoCliente,
            Itens = request.Itens.Select(i => new ItemValidacaoEstoqueRequestDto
            {
                ProdutoVariacaoId = i.ProdutoVariacaoId,
                Quantidade = i.Quantidade
            }).ToList()
        }, cancellationToken);

        if (!validacaoEstoque.Valido)
        {
            throw new ValidationException(validacaoEstoque.Mensagem);
        }

        // 2. Cálculo oficial do Subtotal com preços do banco de dados
        var variacaoIds = request.Itens.Select(i => i.ProdutoVariacaoId).Distinct().ToList();
        var variacoesDb = await _context.ProdutoVariacoes
            .AsNoTracking()
            .Include(v => v.Produto)
            .Where(v => variacaoIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);

        decimal subtotalOficial = 0m;
        foreach (var item in request.Itens)
        {
            if (item.Quantidade <= 0)
            {
                throw new ValidationException("A quantidade de cada item deve ser maior que zero.");
            }

            if (!variacoesDb.TryGetValue(item.ProdutoVariacaoId, out var variacao))
            {
                throw new ValidationException("Item do carrinho não foi encontrado.");
            }

            subtotalOficial += variacao.Produto.Preco * item.Quantidade;
        }

        // 3. Cálculo oficial do Frete reutilizando FreteService
        var freteResponse = await _freteService.CalcularFreteAsync(new CalcularFreteRequestDto
        {
            CodigoCliente = request.CodigoCliente,
            EnderecoId = request.EnderecoId,
            Estado = request.Estado,
            Cep = request.Cep,
            Itens = request.Itens.Select(i => new ItemFreteRequestDto
            {
                ProdutoVariacaoId = i.ProdutoVariacaoId,
                Quantidade = i.Quantidade
            }).ToList()
        }, cancellationToken);

        decimal freteOficial = freteResponse.ValorFrete;
        decimal valorTotalOficial = subtotalOficial + freteOficial;

        // 4. Processamento determinístico de Cupons
        var cuponsCodigos = (request.Cupons ?? new List<string>())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim().ToUpperInvariant())
            .ToList();

        if (cuponsCodigos.Count != cuponsCodigos.Distinct(StringComparer.OrdinalIgnoreCase).Count())
        {
            throw new ValidationException("O mesmo cupom não pode ser informado mais de uma vez.");
        }

        var cuponsDb = await _context.Cupons
            .AsNoTracking()
            .Where(c => cuponsCodigos.Contains(c.Codigo))
            .ToDictionaryAsync(c => c.Codigo, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var cod in cuponsCodigos)
        {
            if (!cuponsDb.ContainsKey(cod))
            {
                throw new ValidationException($"Cupom '{cod}' não encontrado.");
            }
        }

        var cuponsSelecionados = cuponsCodigos.Select(cod => cuponsDb[cod]).ToList();

        // RN0033: Apenas um cupom promocional por compra
        int promoCount = cuponsSelecionados.Count(c => c.Tipo == Cupom.TipoPromocional);
        if (promoCount > 1)
        {
            throw new ValidationException("É permitido utilizar no máximo um cupom promocional por compra.");
        }

        // Validar titularidade e uso único de cupons de troca
        foreach (var cupom in cuponsSelecionados)
        {
            if (cupom.Tipo == Cupom.TipoTroca)
            {
                if (!cupom.ClienteId.HasValue || cupom.ClienteId.Value != cliente.Id)
                {
                    throw new ValidationException($"O cupom de troca '{cupom.Codigo}' pertence a outro cliente e não pode ser utilizado.");
                }

                // Se for cupom de excedente de compra, verificar se o pedido de origem já foi aprovado
                if (cupom.Codigo.StartsWith("TROCA-CLI") && cupom.Codigo.Contains("-RW-"))
                {
                    var idx = cupom.Codigo.IndexOf("-RW-", StringComparison.OrdinalIgnoreCase);
                    var pedidoCodigo = cupom.Codigo.Substring(idx + 1);

                    var pedidoOrigem = await _context.Pedidos
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Codigo == pedidoCodigo, cancellationToken);

                    if (pedidoOrigem != null && pedidoOrigem.Status == Pedido.StatusEmProcessamento)
                    {
                        throw new ValidationException(
                            $"O cupom de troca por excedente '{cupom.Codigo}' ainda não está disponível para uso, pois o pedido de origem '{pedidoCodigo}' está aguardando aprovação de pagamento.");
                    }
                }

                bool jaUtilizado = await _context.PagamentosPedido
                    .AnyAsync(pp => pp.CupomId == cupom.Id && pp.FormaPagamento == PagamentoPedido.FormaCupomTroca, cancellationToken);

                if (jaUtilizado)
                {
                    throw new ValidationException($"O cupom de troca '{cupom.Codigo}' já foi utilizado em outra compra.");
                }
            }
        }

        // Ordenação determinística: Maior valor primeiro; em empate, código ascendente
        var cuponsOrdenados = cuponsSelecionados
            .OrderByDescending(c => c.Valor)
            .ThenBy(c => c.Codigo)
            .ToList();

        decimal saldoPendente = valorTotalOficial;
        decimal totalExcedente = 0m;
        var cuponsUtilizados = new List<CupomUtilizadoDto>();

        foreach (var cupom in cuponsOrdenados)
        {
            if (saldoPendente == 0)
            {
                throw new ValidationException($"O cupom '{cupom.Codigo}' é desnecessário, pois o valor da compra já foi totalmente coberto.");
            }

            if (cupom.Valor <= saldoPendente)
            {
                decimal valorUsado = cupom.Valor;
                saldoPendente -= valorUsado;
                cuponsUtilizados.Add(new CupomUtilizadoDto
                {
                    Codigo = cupom.Codigo,
                    Tipo = cupom.Tipo,
                    FormaPagamento = cupom.Tipo == Cupom.TipoPromocional ? "CUPOM_PROMOCIONAL" : "CUPOM_TROCA",
                    ValorOriginal = cupom.Valor,
                    ValorUtilizado = valorUsado
                });
            }
            else
            {
                // RN0036: Gerar cupom de troca pelo excedente
                decimal valorUsado = saldoPendente;
                decimal excedente = cupom.Valor - saldoPendente;
                totalExcedente += excedente;
                saldoPendente = 0;
                cuponsUtilizados.Add(new CupomUtilizadoDto
                {
                    Codigo = cupom.Codigo,
                    Tipo = cupom.Tipo,
                    FormaPagamento = cupom.Tipo == Cupom.TipoPromocional ? "CUPOM_PROMOCIONAL" : "CUPOM_TROCA",
                    ValorOriginal = cupom.Valor,
                    ValorUtilizado = valorUsado
                });
            }
        }

        decimal totalPagoCupons = cuponsUtilizados.Sum(c => c.ValorUtilizado);
        decimal saldoRestante = saldoPendente;

        // 5. Validação dos Cartões de Crédito
        var cartoesUtilizados = new List<CartaoUtilizadoDto>();

        var cartoesEnviados = request.Cartoes ?? new List<ItemPagamentoCartaoDto>();

        // Rejeitar qualquer cartão com valor <= 0
        foreach (var c in cartoesEnviados)
        {
            if (c.Valor <= 0)
            {
                throw new ValidationException("O valor alocado em cada cartão deve ser maior que zero.");
            }
        }

        if (saldoRestante == 0)
        {
            if (cartoesEnviados.Count > 0)
            {
                throw new ValidationException("A compra já foi integralmente coberta por cupons. Remova os cartões para prosseguir.");
            }
        }
        else
        {
            if (cartoesEnviados.Count == 0)
            {
                throw new ValidationException($"Selecione ao menos um cartão para pagar o saldo restante de R$ {saldoRestante:N2}.");
            }

            decimal somaCartoes = cartoesEnviados.Sum(c => c.Valor);
            if (Math.Abs(somaCartoes - saldoRestante) > 0.01m)
            {
                throw new ValidationException($"A soma dos valores nos cartões (R$ {somaCartoes:N2}) deve ser exatamente igual ao saldo a pagar (R$ {saldoRestante:N2}).");
            }

            // RN0035: Cupons + cartão, usar valor máximo dos cupons e permitir residual < R$ 10
            bool ehResidualAposCupom = cuponsUtilizados.Count > 0 && saldoRestante > 0m && saldoRestante < 10.00m;

            if (ehResidualAposCupom)
            {
                // Decisão técnica de projeto para determinismo: exige exatamente 1 cartão absorvendo o residual
                if (cartoesEnviados.Count > 1)
                {
                    throw new ValidationException("Para valores residuais inferiores a R$ 10,00, utilize apenas um cartão.");
                }
            }
            else
            {
                // RN0034: Múltiplos cartões, mínimo R$ 10 por cartão
                foreach (var c in cartoesEnviados)
                {
                    if (c.Valor < 10.00m)
                    {
                        throw new ValidationException("Cada cartão utilizado deve receber pelo menos R$ 10,00.");
                    }
                }
            }

            // Validação individual de cada cartão (reutilizando regras da entidade e módulo Cliente)
            foreach (var c in cartoesEnviados)
            {
                if (c.CartaoId.HasValue && c.CartaoId.Value > 0)
                {
                    var cartaoDb = await _context.Cartoes
                        .AsNoTracking()
                        .Include(card => card.Bandeira)
                        .FirstOrDefaultAsync(card => card.Id == c.CartaoId.Value, cancellationToken);

                    if (cartaoDb == null || cartaoDb.ClienteId != cliente.Id)
                    {
                        throw new ValidationException("O cartão informado não pertence ao cliente ativo.");
                    }

                    var ultimos = cartaoDb.NumeroCartao.Length >= 4
                        ? cartaoDb.NumeroCartao[^4..]
                        : cartaoDb.NumeroCartao;

                    cartoesUtilizados.Add(new CartaoUtilizadoDto
                    {
                        CartaoId = cartaoDb.Id,
                        FormaPagamento = "CARTAO_CREDITO",
                        Bandeira = cartaoDb.Bandeira?.Nome ?? "Cartão",
                        UltimosDigitos = ultimos,
                        Valor = c.Valor,
                        SalvarNoPerfil = false
                    });
                }
                else if (c.CartaoNovo != null)
                {
                    var novo = c.CartaoNovo;

                    // RN0025: Bandeira cadastrada e ativa
                    if (novo.BandeiraId <= 0)
                    {
                        throw new ValidationException("A bandeira do cartão é obrigatória.");
                    }

                    var bandeira = await _context.Bandeiras
                        .AsNoTracking()
                        .FirstOrDefaultAsync(b => b.Id == novo.BandeiraId && b.Ativo, cancellationToken);

                    if (bandeira == null)
                    {
                        throw new ValidationException("A bandeira informada não é válida ou não está ativa.");
                    }

                    // RN0024: Número do cartão
                    var numeroLimpo = Regex.Replace(novo.NumeroCartao ?? string.Empty, @"\D", "");
                    if (string.IsNullOrWhiteSpace(numeroLimpo) || numeroLimpo.Length < 13 || numeroLimpo.Length > 19)
                    {
                        throw new ValidationException("O número do cartão informado é inválido.");
                    }

                    // RN0024: Nome impresso no cartão
                    if (string.IsNullOrWhiteSpace(novo.NomeImpresso))
                    {
                        throw new ValidationException("O nome impresso no cartão é obrigatório.");
                    }

                    if (novo.NomeImpresso.Trim().Length > 100)
                    {
                        throw new ValidationException("O nome impresso no cartão não pode exceder 100 caracteres.");
                    }

                    // RN0024: Código de segurança (CVV)
                    var cvvLimpo = Regex.Replace(novo.Cvv ?? string.Empty, @"\D", "");
                    if (string.IsNullOrWhiteSpace(cvvLimpo) || (cvvLimpo.Length != 3 && cvvLimpo.Length != 4) || cvvLimpo != (novo.Cvv ?? string.Empty).Trim())
                    {
                        throw new ValidationException("O código de segurança (CVV) deve conter 3 ou 4 dígitos numéricos.");
                    }

                    // Decisão adicional de implementação (RunWay): Data de validade (não é exigência da RN0024 do DRS)
                    if (string.IsNullOrWhiteSpace(novo.DataValidade))
                    {
                        throw new ValidationException("A data de validade do cartão é obrigatória.");
                    }

                    var partesValidade = novo.DataValidade.Trim().Split('/');
                    if (partesValidade.Length != 2 ||
                        !int.TryParse(partesValidade[0], out int mes) ||
                        !int.TryParse(partesValidade[1], out int ano) ||
                        mes < 1 || mes > 12)
                    {
                        throw new ValidationException("Informe uma data de validade válida no formato MM/AA.");
                    }

                    int anoCompleto = partesValidade[1].Length == 2 ? 2000 + ano : ano;
                    var dataExpiracao = new DateTime(anoCompleto, mes, DateTime.DaysInMonth(anoCompleto, mes), 23, 59, 59, DateTimeKind.Utc);
                    if (dataExpiracao < DateTime.UtcNow)
                    {
                        throw new ValidationException("A data de validade do cartão já expirou.");
                    }

                    var ultimos = numeroLimpo.Length >= 4 ? numeroLimpo[^4..] : numeroLimpo;

                    cartoesUtilizados.Add(new CartaoUtilizadoDto
                    {
                        CartaoId = null,
                        FormaPagamento = "CARTAO_CREDITO",
                        Bandeira = bandeira.Nome,
                        UltimosDigitos = ultimos,
                        Valor = c.Valor,
                        SalvarNoPerfil = novo.SalvarNoPerfil
                    });
                }
                else
                {
                    throw new ValidationException("Informe um cartão cadastrado ou os dados de um novo cartão.");
                }
            }
        }

        NovoCupomTrocaPreviewDto? novoCupomPreview = null;
        if (totalExcedente > 0)
        {
            novoCupomPreview = new NovoCupomTrocaPreviewDto
            {
                Valor = totalExcedente,
                Mensagem = $"Um novo cupom de troca no valor de R$ {totalExcedente:N2} será gerado automaticamente para você na finalização do pedido."
            };
        }

        return new ValidarPagamentoResponseDto
        {
            Valido = true,
            Mensagem = "Composição de pagamento validada com sucesso.",
            Subtotal = subtotalOficial,
            ValorFrete = freteOficial,
            ValorTotal = valorTotalOficial,
            TotalPagoCupons = totalPagoCupons,
            TotalPagoCartoes = cartoesUtilizados.Sum(c => c.Valor),
            SaldoRestante = saldoRestante,
            ValorExcedenteCupons = totalExcedente,
            NovoCupomTroca = novoCupomPreview,
            CuponsUtilizados = cuponsUtilizados,
            CartoesUtilizados = cartoesUtilizados
        };
    }
}
