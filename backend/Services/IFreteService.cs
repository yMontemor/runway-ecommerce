using RunWay.Api.DTOs.Frete;

namespace RunWay.Api.Services;

public interface IFreteService
{
    Task<CalcularFreteResponseDto> CalcularFreteAsync(CalcularFreteRequestDto request, CancellationToken cancellationToken = default);
}
