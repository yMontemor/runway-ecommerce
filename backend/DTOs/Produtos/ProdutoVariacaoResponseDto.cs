namespace RunWay.Api.DTOs.Produtos;

public class ProdutoVariacaoResponseDto
{
    public int Id { get; set; }
    public int ProdutoId { get; set; }
    public int Tamanho { get; set; }
    public int QuantidadeEstoque { get; set; }
    public bool Ativo { get; set; }
}
