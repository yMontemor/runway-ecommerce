namespace RunWay.Api.Models;

public class Cupom
{
    public const string TipoPromocional = "PROMOCIONAL";
    public const string TipoTroca = "TROCA";

    public int Id { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public string Tipo { get; set; } = string.Empty;

    public decimal Valor { get; set; }

    public int? ClienteId { get; set; }

    public Cliente? Cliente { get; set; }

    public ICollection<PagamentoPedido> Pagamentos { get; set; } = new List<PagamentoPedido>();

    public Troca? Troca { get; set; }
}
