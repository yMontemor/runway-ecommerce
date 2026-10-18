namespace RunWay.Api.Models;

public class ItemTroca
{
    public int Id { get; set; }

    public int TrocaId { get; set; }

    public int ItemPedidoId { get; set; }

    public int ProdutoVariacaoId { get; set; }

    public int Quantidade { get; set; }

    public decimal PrecoUnitario { get; set; }

    public decimal Subtotal { get; set; }

    public Troca Troca { get; set; } = null!;

    public ItemPedido ItemPedido { get; set; } = null!;

    public ProdutoVariacao ProdutoVariacao { get; set; } = null!;
}
