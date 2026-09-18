using RunWay.Api.DTOs.Clientes;

namespace RunWay.Api.Services;

public interface IClienteService
{
    Task<ClienteResponseDto> CadastrarAsync(ClienteCreateRequestDto request, CancellationToken cancellationToken = default);
}
