using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Frete;
using RunWay.Api.DTOs.Produtos;
using RunWay.Api.Exceptions;

namespace RunWay.Api.Services;

public class FreteService : IFreteService
{
    private readonly RunWayDbContext _context;
    private readonly IProdutoService _produtoService;

    private static readonly Dictionary<string, (string Regiao, decimal BaseFrete)> TabelaFrete = new(StringComparer.OrdinalIgnoreCase)
    {
        // Sudeste (R$ 20,00)
        ["SP"] = ("Sudeste", 20.00m),
        ["RJ"] = ("Sudeste", 20.00m),
        ["MG"] = ("Sudeste", 20.00m),
        ["ES"] = ("Sudeste", 20.00m),

        // Sul (R$ 25,00)
        ["PR"] = ("Sul", 25.00m),
        ["SC"] = ("Sul", 25.00m),
        ["RS"] = ("Sul", 25.00m),

        // Centro-Oeste (R$ 30,00)
        ["DF"] = ("Centro-Oeste", 30.00m),
        ["GO"] = ("Centro-Oeste", 30.00m),
        ["MT"] = ("Centro-Oeste", 30.00m),
        ["MS"] = ("Centro-Oeste", 30.00m),

        // Nordeste (R$ 35,00)
        ["BA"] = ("Nordeste", 35.00m),
        ["PE"] = ("Nordeste", 35.00m),
        ["CE"] = ("Nordeste", 35.00m),
        ["RN"] = ("Nordeste", 35.00m),
        ["PB"] = ("Nordeste", 35.00m),
        ["AL"] = ("Nordeste", 35.00m),
        ["SE"] = ("Nordeste", 35.00m),
        ["PI"] = ("Nordeste", 35.00m),
        ["MA"] = ("Nordeste", 35.00m),

        // Norte (R$ 40,00)
        ["AM"] = ("Norte", 40.00m),
        ["PA"] = ("Norte", 40.00m),
        ["AC"] = ("Norte", 40.00m),
        ["RO"] = ("Norte", 40.00m),
        ["RR"] = ("Norte", 40.00m),
        ["AP"] = ("Norte", 40.00m),
        ["TO"] = ("Norte", 40.00m),
    };

    private static readonly Dictionary<string, string> NomesParaSiglas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SÃO PAULO"] = "SP", ["SAO PAULO"] = "SP",
        ["RIO DE JANEIRO"] = "RJ",
        ["MINAS GERAIS"] = "MG",
        ["ESPÍRITO SANTO"] = "ES", ["ESPIRITO SANTO"] = "ES",
        ["PARANÁ"] = "PR", ["PARANA"] = "PR",
        ["SANTA CATARINA"] = "SC",
        ["RIO GRANDE DO SUL"] = "RS",
        ["DISTRITO FEDERAL"] = "DF",
        ["GOIÁS"] = "GO", ["GOIAS"] = "GO",
        ["MATO GROSSO"] = "MT",
        ["MATO GROSSO DO SUL"] = "MS",
        ["BAHIA"] = "BA",
        ["PERNAMBUCO"] = "PE",
        ["CEARÁ"] = "CE", ["CEARA"] = "CE",
        ["RIO GRANDE DO NORTE"] = "RN",
        ["PARAÍBA"] = "PB", ["PARAIBA"] = "PB",
        ["ALAGOAS"] = "AL",
        ["SERGIPE"] = "SE",
        ["PIAUÍ"] = "PI", ["PIAUI"] = "PI",
        ["MARANHÃO"] = "MA", ["MARANHAO"] = "MA",
        ["AMAZONAS"] = "AM",
        ["PARÁ"] = "PA", ["PARA"] = "PA",
        ["ACRE"] = "AC",
        ["RONDÔNIA"] = "RO", ["RONDONIA"] = "RO",
        ["RORAIMA"] = "RR",
        ["AMAPÁ"] = "AP", ["AMAPA"] = "AP",
        ["TOCANTINS"] = "TO"
    };

    public FreteService(RunWayDbContext context, IProdutoService produtoService)
    {
        _context = context;
        _produtoService = produtoService;
    }

    public async Task<CalcularFreteResponseDto> CalcularFreteAsync(CalcularFreteRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("Requisição inválida.");
        }

        if (request.Itens == null || request.Itens.Count == 0)
        {
            throw new ValidationException("O carrinho deve conter ao menos um item para cálculo do frete.");
        }

        int quantidadeTotal = 0;
        foreach (var item in request.Itens)
        {
            if (item.Quantidade <= 0)
            {
                throw new ValidationException("A quantidade de cada item deve ser maior que zero.");
            }
            quantidadeTotal += item.Quantidade;
        }

        if (quantidadeTotal <= 0)
        {
            throw new ValidationException("A quantidade total de itens deve ser maior que zero.");
        }

        // Validação de produto/variação ativa e disponível reutilizando o serviço de produtos existente
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

        string rawEstado = string.Empty;

        if (request.EnderecoId.HasValue && request.EnderecoId.Value > 0)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoCliente))
            {
                throw new ValidationException("Informe o cliente para utilizar um endereço de entrega cadastrado.");
            }

            var cliente = await _context.Clientes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Codigo == request.CodigoCliente, cancellationToken);

            if (cliente == null)
            {
                throw new ValidationException("Cliente informado não foi encontrado.");
            }

            var endereco = await _context.Enderecos
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.EnderecoId.Value, cancellationToken);

            if (endereco == null)
            {
                throw new ValidationException("Endereço de entrega selecionado não foi encontrado.");
            }

            if (endereco.ClienteId != cliente.Id)
            {
                throw new ValidationException("O endereço informado não pertence ao cliente informado.");
            }

            rawEstado = endereco.Estado;
        }
        else if (!string.IsNullOrWhiteSpace(request.Estado))
        {
            rawEstado = request.Estado.Trim();
        }
        else
        {
            throw new ValidationException("Informe o endereço de entrega ou o estado (UF) para cálculo do frete.");
        }

        string siglaUf = rawEstado.Trim().ToUpperInvariant();
        if (siglaUf.Length > 2 && NomesParaSiglas.TryGetValue(siglaUf, out var siglaMapeada))
        {
            siglaUf = siglaMapeada;
        }

        if (!TabelaFrete.TryGetValue(siglaUf, out var regiaoFrete))
        {
            throw new ValidationException("Estado (UF) de entrega inválido ou não atendido.");
        }

        decimal adicionalPares = (quantidadeTotal - 1) * 5.00m;
        decimal valorFrete = regiaoFrete.BaseFrete + adicionalPares;

        return new CalcularFreteResponseDto
        {
            ValorFrete = valorFrete,
            Estado = siglaUf,
            Regiao = regiaoFrete.Regiao,
            QuantidadeItens = quantidadeTotal
        };
    }
}
