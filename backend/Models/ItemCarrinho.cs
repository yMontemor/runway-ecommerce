namespace RunWay.Api.Models;

public class ItemCarrinho
{
    public int Id { get; set; }

    public int CarrinhoId { get; set; }

    public int ProdutoVariacaoId { get; set; }

    public int Quantidade { get; set; }

    public DateTimeOffset DataAdicionado { get; set; }

    public Carrinho Carrinho { get; set; } = null!;

    public ProdutoVariacao ProdutoVariacao { get; set; } = null!;
}
