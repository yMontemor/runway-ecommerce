namespace RunWay.Api.Models;

public class Pedido
{
    public const string StatusEmProcessamento = "EM PROCESSAMENTO";
    public const string StatusAprovada = "APROVADA";
    public const string StatusReprovada = "REPROVADA";
    public const string StatusEmTransporte = "EM TRANSPORTE";
    public const string StatusEntregue = "ENTREGUE";
    public const string StatusEmTroca = "EM TROCA";
    public const string StatusTrocaAutorizada = "TROCA AUTORIZADA";
    public const string StatusTrocado = "TROCADO";

    public int Id { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public int ClienteId { get; set; }

    public int? EnderecoEntregaId { get; set; }

    public DateTimeOffset DataPedido { get; set; } = DateTimeOffset.UtcNow;

    public string Status { get; set; } = StatusEmProcessamento;

    public decimal Subtotal { get; set; }

    public decimal ValorFrete { get; set; }

    public decimal ValorTotal { get; set; }

    // Snapshot histórico do endereço utilizado na entrega
    public string EntregaTipoResidencia { get; set; } = string.Empty;

    public string EntregaTipoLogradouro { get; set; } = string.Empty;

    public string EntregaLogradouro { get; set; } = string.Empty;

    public string EntregaNumero { get; set; } = string.Empty;

    public string? EntregaComplemento { get; set; }

    public string EntregaBairro { get; set; } = string.Empty;

    public string EntregaCep { get; set; } = string.Empty;

    public string EntregaCidade { get; set; } = string.Empty;

    public string EntregaEstado { get; set; } = string.Empty;

    public string EntregaPais { get; set; } = string.Empty;

    public string? EntregaObservacoes { get; set; }

    public Cliente Cliente { get; set; } = null!;

    public Endereco? EnderecoEntrega { get; set; }

    public ICollection<ItemPedido> Itens { get; set; } = new List<ItemPedido>();

    public ICollection<PagamentoPedido> Pagamentos { get; set; } = new List<PagamentoPedido>();

    public ICollection<Troca> Trocas { get; set; } = new List<Troca>();
}
