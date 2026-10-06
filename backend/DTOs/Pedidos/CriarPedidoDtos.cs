namespace RunWay.Api.DTOs.Pedidos;

public class CriarPedidoRequestDto
{
    public string CodigoCliente { get; set; } = string.Empty;
    public List<ItemPedidoCriacaoDto> Itens { get; set; } = new();
    
    // Origem exclusiva de endereço: ou EnderecoId OU EnderecoAvulso
    public int? EnderecoId { get; set; }
    public EnderecoAvulsoPedidoDto? EnderecoAvulso { get; set; }

    // Cupons informados pelo cliente
    public List<string> Cupons { get; set; } = new();

    // Cartões alocados para pagamento do saldo restante
    public List<ItemPagamentoCartaoPedidoDto> Cartoes { get; set; } = new();
}

public class ItemPedidoCriacaoDto
{
    public int ProdutoVariacaoId { get; set; }
    public int Quantidade { get; set; }
}

public class EnderecoAvulsoPedidoDto
{
    public string TipoResidencia { get; set; } = string.Empty;
    public string TipoLogradouro { get; set; } = string.Empty;
    public string Logradouro { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public string? Complemento { get; set; }
    public string Bairro { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public string Pais { get; set; } = "Brasil";
    public string? Observacoes { get; set; }
    public bool SalvarNoPerfil { get; set; } = false;
}

public class ItemPagamentoCartaoPedidoDto
{
    public int? CartaoId { get; set; }
    public CartaoNovoPedidoDto? CartaoNovo { get; set; }
    public decimal Valor { get; set; }
}

public class CartaoNovoPedidoDto
{
    public int BandeiraId { get; set; }
    public string NumeroCartao { get; set; } = string.Empty;
    public string NomeImpresso { get; set; } = string.Empty;
    public string DataValidade { get; set; } = string.Empty;
    public string Cvv { get; set; } = string.Empty;
    public bool SalvarNoPerfil { get; set; } = false;
}
