using RunWay.Api.DTOs.Pagamento;

namespace RunWay.Api.Services;

public interface IPagamentoService
{
    Task<ValidarPagamentoResponseDto> ValidarPagamentoAsync(ValidarPagamentoRequestDto request, CancellationToken cancellationToken = default);
}
