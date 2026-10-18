namespace RunWay.Api.DTOs.Pedidos;

public class ProcessarPagamentoPedidoRequestDto
{
    /// <summary>
    /// Opcional: "APROVADA" ou "REPROVADA".
    /// Se não informado, o simulador determinístico do backend avalia as regras de pagamento do pedido.
    /// </summary>
    public string? ForcarResultado { get; set; }

    /// <summary>
    /// Motivo ou justificativa da decisão para auditoria.
    /// </summary>
    public string? Motivo { get; set; }
}

public class AtualizarStatusPedidoRequestDto
{
    /// <summary>
    /// Novo status desejado: "EM TRANSPORTE" ou "ENTREGUE" (ou "APROVADA"/"REPROVADA" se for processamento de pagamento).
    /// </summary>
    public string NovoStatus { get; set; } = string.Empty;

    /// <summary>
    /// Motivo ou justificativa opcional da alteração.
    /// </summary>
    public string? Motivo { get; set; }

    /// <summary>
    /// Nome ou identificação do usuário/sistema responsável.
    /// </summary>
    public string? UsuarioResponsavel { get; set; }
}
