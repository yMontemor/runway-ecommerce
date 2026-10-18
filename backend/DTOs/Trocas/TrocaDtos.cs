namespace RunWay.Api.DTOs.Trocas;

public class SolicitarTrocaRequestDto
{
    public string CodigoCliente { get; set; } = string.Empty;
    public string CodigoPedido { get; set; } = string.Empty;
    public string Motivo { get; set; } = string.Empty;
    public List<ItemSolicitacaoTrocaRequestDto> Itens { get; set; } = new();
}

public class ItemSolicitacaoTrocaRequestDto
{
    public int ItemPedidoId { get; set; }
    public int Quantidade { get; set; }
}

public class AutorizarTrocaRequestDto
{
    public bool Autorizado { get; set; } = true;
    public string? UsuarioResponsavel { get; set; }
    public string? MotivoRecusa { get; set; }
}

public class ConfirmarRecebimentoTrocaRequestDto
{
    public bool RetornarAoEstoque { get; set; }
    public string? UsuarioResponsavel { get; set; }
    public string? Observacoes { get; set; }
}

public class TrocaResponseDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public int PedidoId { get; set; }
    public string CodigoPedido { get; set; } = string.Empty;
    public int ClienteId { get; set; }
    public string CodigoCliente { get; set; } = string.Empty;
    public string NomeCliente { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Motivo { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public DateTimeOffset DataSolicitacao { get; set; }
    public DateTimeOffset? DataAutorizacao { get; set; }
    public string? AdminAutorizacao { get; set; }
    public DateTimeOffset? DataRecebimento { get; set; }
    public string? AdminRecebimento { get; set; }
    public bool? RetornouAoEstoque { get; set; }
    public int? CupomId { get; set; }
    public string? CodigoCupom { get; set; }
    public decimal? ValorCupom { get; set; }
    public string? NotificacaoCliente { get; set; }
    public DateTimeOffset? DataNotificacao { get; set; }
    public List<ItemTrocaResponseDto> Itens { get; set; } = new();
}

public class ItemTrocaResponseDto
{
    public int Id { get; set; }
    public int TrocaId { get; set; }
    public int ItemPedidoId { get; set; }
    public int ProdutoVariacaoId { get; set; }
    public int ProdutoId { get; set; }
    public string CodigoProduto { get; set; } = string.Empty;
    public string NomeProduto { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public string ImagemUrl { get; set; } = string.Empty;
    public int Tamanho { get; set; }
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

public class NotificacaoTrocaResponseDto
{
    public string CodigoTroca { get; set; } = string.Empty;
    public string CodigoPedido { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public DateTimeOffset? DataNotificacao { get; set; }
}

public class ElegibilidadeTrocaResponseDto
{
    public string CodigoPedido { get; set; } = string.Empty;
    public string StatusPedido { get; set; } = string.Empty;
    public bool PodeSolicitarTroca { get; set; }
    public string? MotivoBloqueio { get; set; }
    public List<ItemElegibilidadeTrocaDto> Itens { get; set; } = new();
}

public class ItemElegibilidadeTrocaDto
{
    public int ItemPedidoId { get; set; }
    public int ProdutoVariacaoId { get; set; }
    public string NomeProduto { get; set; } = string.Empty;
    public int Tamanho { get; set; }
    public decimal PrecoUnitario { get; set; }
    public int QuantidadeComprada { get; set; }
    public int QuantidadeJaEmTroca { get; set; }
    public int QuantidadeElegivel { get; set; }
}
