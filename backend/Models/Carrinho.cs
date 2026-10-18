namespace RunWay.Api.Models;

public class Carrinho
{
    public int Id { get; set; }

    public int ClienteId { get; set; }

    public DateTimeOffset DataCriacao { get; set; }

    public DateTimeOffset DataAtualizacao { get; set; }

    public DateTimeOffset DataExpiracao { get; set; }

    public Cliente Cliente { get; set; } = null!;

    public ICollection<ItemCarrinho> Itens { get; set; } = new List<ItemCarrinho>();
}
