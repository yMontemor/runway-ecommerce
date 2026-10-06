namespace RunWay.Api.Models;

public class Estoque
{
    public int Id { get; set; }

    public int ProdutoVariacaoId { get; set; }

    public int Quantidade { get; set; }

    public ProdutoVariacao ProdutoVariacao { get; set; } = null!;
}
