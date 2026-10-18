namespace RunWay.Api.DTOs.Produtos;

public class ItemValidacaoEstoqueRequestDto
{
    public int ProdutoVariacaoId { get; set; }
    public int Quantidade { get; set; }
}

public class ValidacaoEstoqueRequestDto
{
    public string? CodigoCliente { get; set; }
    public List<ItemValidacaoEstoqueRequestDto> Itens { get; set; } = new();
}

public class ItemValidacaoEstoqueResponseDto
{
    public int ProdutoVariacaoId { get; set; }
    public string NomeProduto { get; set; } = string.Empty;
    public int Tamanho { get; set; }
    public int QuantidadeSolicitada { get; set; }
    public int QuantidadeDisponivel { get; set; }
    public bool Disponivel { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}

public class ValidacaoEstoqueResponseDto
{
    public bool Valido { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    public List<ItemValidacaoEstoqueResponseDto> Itens { get; set; } = new();
}
