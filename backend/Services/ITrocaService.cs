using RunWay.Api.DTOs.Trocas;

namespace RunWay.Api.Services;

public interface ITrocaService
{
    Task<TrocaResponseDto> SolicitarTrocaAsync(SolicitarTrocaRequestDto request, CancellationToken cancellationToken = default);
    Task<List<TrocaResponseDto>> ListarTrocasPorClienteAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<List<TrocaResponseDto>> ListarTrocasAdminAsync(string? status = null, CancellationToken cancellationToken = default);
    Task<TrocaResponseDto> ObterTrocaPorCodigoAsync(string codigoTroca, CancellationToken cancellationToken = default);
    Task<TrocaResponseDto> AutorizarTrocaAsync(string codigoTroca, AutorizarTrocaRequestDto request, CancellationToken cancellationToken = default);
    Task<TrocaResponseDto> ConfirmarRecebimentoAsync(string codigoTroca, ConfirmarRecebimentoTrocaRequestDto request, CancellationToken cancellationToken = default);
    Task<NotificacaoTrocaResponseDto> ObterNotificacaoTrocaAsync(string codigoTroca, CancellationToken cancellationToken = default);
    Task<ElegibilidadeTrocaResponseDto> ConsultarElegibilidadeTrocaAsync(string codigoPedido, CancellationToken cancellationToken = default);
}
