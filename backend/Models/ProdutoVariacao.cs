namespace RunWay.Api.Models;

public class ProdutoVariacao
{
    public int Id { get; set; }

    public int ProdutoId { get; set; }

    public int Tamanho { get; set; }

    public bool Ativo { get; set; } = true;

    public Produto Produto { get; set; } = null!;

    public Estoque? Estoque { get; set; }

    public ICollection<ItemPedido> ItensPedido { get; set; } = new List<ItemPedido>();
    public ICollection<ItemCarrinho> ItensCarrinho { get; set; } = new List<ItemCarrinho>();
}
