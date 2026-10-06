namespace RunWay.Api.DTOs.Pedidos;

public class PedidoResponseDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset DataPedido { get; set; }
    public decimal Subtotal { get; set; }
    public decimal ValorFrete { get; set; }
    public decimal ValorTotal { get; set; }

    public EnderecoEntregaResponseDto EnderecoEntrega { get; set; } = null!;
    public List<ItemPedidoResponseDto> Itens { get; set; } = new();
    public List<PagamentoPedidoResponseDto> Pagamentos { get; set; } = new();
    public NovoCupomTrocaResponseDto? NovoCupomTroca { get; set; }
}

public class EnderecoEntregaResponseDto
{
    public int? EnderecoId { get; set; }
    public string TipoResidencia { get; set; } = string.Empty;
    public string TipoLogradouro { get; set; } = string.Empty;
    public string Logradouro { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public string? Complemento { get; set; }
    public string Bairro { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public string Pais { get; set; } = string.Empty;
    public string? Observacoes { get; set; }
}

public class ItemPedidoResponseDto
{
    public int Id { get; set; }
    public int ProdutoVariacaoId { get; set; }
    public string ProdutoNome { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Tamanho { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal TotalItem => PrecoUnitario * Quantidade;
}

public class PagamentoPedidoResponseDto
{
    public int Id { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public int? CartaoId { get; set; }
    public string? Bandeira { get; set; }
    public string? CartaoUltimosDigitos { get; set; }
    public string? CartaoNomeImpresso { get; set; }
    public int? CupomId { get; set; }
    public string? CupomCodigo { get; set; }
}

public class NovoCupomTrocaResponseDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}
