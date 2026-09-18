using RunWay.Api.DTOs.Clientes;

namespace RunWay.Api.Services;

public interface IClienteService
{
    Task<ClienteResponseDto> CadastrarAsync(ClienteCreateRequestDto request, CancellationToken cancellationToken = default);

    Task<List<EnderecoResponseDto>> ListarEnderecosAsync(string codigoCliente, CancellationToken cancellationToken = default);

    Task<EnderecoResponseDto> AdicionarEnderecoAsync(string codigoCliente, EnderecoRequestDto request, CancellationToken cancellationToken = default);

    Task<EnderecoResponseDto> AlterarEnderecoAsync(string codigoCliente, int enderecoId, EnderecoRequestDto request, CancellationToken cancellationToken = default);
}
