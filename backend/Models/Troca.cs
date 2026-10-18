namespace RunWay.Api.Models;

public class Troca
{
    public const string StatusEmTroca = "EM TROCA";
    public const string StatusTrocaAutorizada = "TROCA AUTORIZADA";
    public const string StatusTrocado = "TROCADO";
    public const string StatusTrocaRecusada = "TROCA RECUSADA";

    public const string TipoTotal = "TOTAL";
    public const string TipoParcial = "PARCIAL";

    public int Id { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public int PedidoId { get; set; }

    public int ClienteId { get; set; }

    public string Status { get; set; } = StatusEmTroca;

    public string Tipo { get; set; } = TipoParcial;

    public string Motivo { get; set; } = string.Empty;

    public decimal ValorTotal { get; set; }

    public DateTimeOffset DataSolicitacao { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DataAutorizacao { get; set; }

    public string? AdminAutorizacao { get; set; }

    public DateTimeOffset? DataRecebimento { get; set; }

    public string? AdminRecebimento { get; set; }

    public bool? RetornouAoEstoque { get; set; }

    public int? CupomId { get; set; }

    public string? NotificacaoCliente { get; set; }

    public DateTimeOffset? DataNotificacao { get; set; }

    public Pedido Pedido { get; set; } = null!;

    public Cliente Cliente { get; set; } = null!;

    public Cupom? Cupom { get; set; }

    public ICollection<ItemTroca> Itens { get; set; } = new List<ItemTroca>();
}
