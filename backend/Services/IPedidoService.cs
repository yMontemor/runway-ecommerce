using RunWay.Api.DTOs.Pedidos;

namespace RunWay.Api.Services;

public interface IPedidoService
{
    Task<PedidoResponseDto> CriarPedidoAsync(CriarPedidoRequestDto request, CancellationToken cancellationToken = default);
    Task<List<PedidoResponseDto>> ListarTodosAsync(string? status = null, CancellationToken cancellationToken = default);
    Task<List<PedidoResponseDto>> ListarPorClienteAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<PedidoResponseDto> ObterPorCodigoAsync(string codigo, CancellationToken cancellationToken = default);
    Task<PedidoResponseDto> ProcessarPagamentoAsync(string codigo, ProcessarPagamentoPedidoRequestDto? request = null, CancellationToken cancellationToken = default);
    Task<PedidoResponseDto> AtualizarStatusAsync(string codigo, AtualizarStatusPedidoRequestDto request, CancellationToken cancellationToken = default);
}
