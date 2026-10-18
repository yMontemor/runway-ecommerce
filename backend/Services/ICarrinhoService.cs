using RunWay.Api.DTOs.Carrinho;

namespace RunWay.Api.Services;

public interface ICarrinhoService
{
    Task<CarrinhoResponseDto> ObterCarrinhoAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<CarrinhoResponseDto> AdicionarItemAsync(string codigoCliente, AdicionarItemCarrinhoRequestDto request, CancellationToken cancellationToken = default);
    Task<CarrinhoResponseDto> AtualizarQuantidadeItemAsync(string codigoCliente, int produtoVariacaoId, int novaQuantidade, CancellationToken cancellationToken = default);
    Task<CarrinhoResponseDto> RemoverItemAsync(string codigoCliente, int produtoVariacaoId, CancellationToken cancellationToken = default);
    Task<CarrinhoResponseDto> LimparCarrinhoAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<ExpiracaoCarrinhoResponseDto> ObterExpiracaoAsync(string codigoCliente, CancellationToken cancellationToken = default);
    Task<int> ObterEstoqueDisponivelVariacaoAsync(int produtoVariacaoId, string? codigoCliente = null, CancellationToken cancellationToken = default);
    Task<Dictionary<int, int>> ObterEstoquesDisponiveisAsync(IEnumerable<int> produtoVariacaoIds, string? codigoCliente = null, CancellationToken cancellationToken = default);
}
