using RunWay.Api.DTOs.Produtos;

namespace RunWay.Api.Services;

public interface IProdutoService
{
    Task<List<ProdutoResponseDto>> ListarAtivosAsync(CancellationToken cancellationToken = default);
    Task<ProdutoResponseDto?> ObterPorIdOuCodigoAsync(string idOuCodigo, CancellationToken cancellationToken = default);
    Task<ValidacaoEstoqueResponseDto> ValidarEstoqueAsync(ValidacaoEstoqueRequestDto request, CancellationToken cancellationToken = default);
}
