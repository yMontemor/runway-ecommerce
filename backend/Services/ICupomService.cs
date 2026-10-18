using RunWay.Api.DTOs.Cupons;

namespace RunWay.Api.Services;

public interface ICupomService
{
    Task<List<CupomResponseDto>> ListarCuponsTrocaClienteAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<List<CupomResponseDto>> ListarCuponsPromocionaisAsync(CancellationToken cancellationToken = default);
    Task<List<CupomResponseDto>> ListarTodosCuponsClienteAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<CupomResponseDto> ConsultarCupomAsync(ConsultarCupomRequestDto request, CancellationToken cancellationToken = default);
}
