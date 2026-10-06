using RunWay.Api.DTOs.Cupons;

namespace RunWay.Api.Services;

public interface ICupomService
{
    Task<List<CupomResponseDto>> ListarCuponsTrocaClienteAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<CupomResponseDto> ConsultarCupomAsync(ConsultarCupomRequestDto request, CancellationToken cancellationToken = default);
}
