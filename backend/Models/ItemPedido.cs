namespace RunWay.Api.Models;

public class ItemPedido
{
    public int Id { get; set; }

    public int PedidoId { get; set; }

    public int ProdutoVariacaoId { get; set; }

    public int Quantidade { get; set; }

    public decimal PrecoUnitario { get; set; }

    public Pedido Pedido { get; set; } = null!;

    public ProdutoVariacao ProdutoVariacao { get; set; } = null!;

    public ICollection<ItemTroca> ItensTroca { get; set; } = new List<ItemTroca>();
}
