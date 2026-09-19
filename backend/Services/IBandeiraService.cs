using RunWay.Api.DTOs.Bandeiras;

namespace RunWay.Api.Services;

public interface IBandeiraService
{
    Task<List<BandeiraResponseDto>> ListarAtivasAsync(CancellationToken cancellationToken = default);
}
