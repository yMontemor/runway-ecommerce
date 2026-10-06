using RunWay.Api.DTOs.Pedidos;

namespace RunWay.Api.Services;

public interface IPedidoService
{
    Task<PedidoResponseDto> CriarPedidoAsync(CriarPedidoRequestDto request, CancellationToken cancellationToken = default);
}
