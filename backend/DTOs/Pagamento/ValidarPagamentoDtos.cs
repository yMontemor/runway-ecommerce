namespace RunWay.Api.DTOs.Pagamento;

public class ValidarPagamentoRequestDto
{
    public string CodigoCliente { get; set; } = string.Empty;
    public List<ItemPedidoValidacaoDto> Itens { get; set; } = new();
    public int? EnderecoId { get; set; }
    public string? Estado { get; set; }
    public string? Cep { get; set; }
    public List<string> Cupons { get; set; } = new();
    public List<ItemPagamentoCartaoDto> Cartoes { get; set; } = new();
}

public class ItemPedidoValidacaoDto
{
    public int ProdutoVariacaoId { get; set; }
    public int Quantidade { get; set; }
}

public class ItemPagamentoCartaoDto
{
    public int? CartaoId { get; set; }
    public NovoCartaoPagamentoDto? CartaoNovo { get; set; }
    public decimal Valor { get; set; }
}

public class NovoCartaoPagamentoDto
{
    public int BandeiraId { get; set; }
    public string NumeroCartao { get; set; } = string.Empty;
    public string NomeImpresso { get; set; } = string.Empty;
    public string DataValidade { get; set; } = string.Empty;
    public string Cvv { get; set; } = string.Empty;
    public bool SalvarNoPerfil { get; set; } = true;
}

public class ValidarPagamentoResponseDto
{
    public bool Valido { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal ValorFrete { get; set; }
    public decimal ValorTotal { get; set; }
    public decimal TotalPagoCupons { get; set; }
    public decimal TotalPagoCartoes { get; set; }
    public decimal SaldoRestante { get; set; }
    public decimal ValorExcedenteCupons { get; set; }
    public NovoCupomTrocaPreviewDto? NovoCupomTroca { get; set; }
    public List<CupomUtilizadoDto> CuponsUtilizados { get; set; } = new();
    public List<CartaoUtilizadoDto> CartoesUtilizados { get; set; } = new();
}

public class CupomUtilizadoDto
{
    public string Codigo { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = string.Empty;
    public decimal ValorOriginal { get; set; }
    public decimal ValorUtilizado { get; set; }
}

public class CartaoUtilizadoDto
{
    public int? CartaoId { get; set; }
    public string FormaPagamento { get; set; } = "CARTAO_CREDITO";
    public string Bandeira { get; set; } = string.Empty;
    public string UltimosDigitos { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public bool SalvarNoPerfil { get; set; }
}

public class NovoCupomTrocaPreviewDto
{
    public decimal Valor { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}
