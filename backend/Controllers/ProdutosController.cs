using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Produtos;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/produtos")]
public class ProdutosController : ControllerBase
{
    private readonly IProdutoService _produtoService;

    public ProdutosController(IProdutoService produtoService)
    {
        _produtoService = produtoService;
    }

    /// <summary>
    /// Lista todos os produtos ativos com suas variações e estoque disponível.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ProdutoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken cancellationToken)
    {
        var produtos = await _produtoService.ListarAtivosAsync(cancellationToken);
        return Ok(produtos);
    }

    /// <summary>
    /// Obtém detalhes de um produto por ID ou código/slug com variações e estoque.
    /// </summary>
    [HttpGet("{idOuCodigo}")]
    [ProducesResponseType(typeof(ProdutoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterPorIdOuCodigo(string idOuCodigo, CancellationToken cancellationToken)
    {
        var produto = await _produtoService.ObterPorIdOuCodigoAsync(idOuCodigo, cancellationToken);
        if (produto == null)
        {
            return NotFound(new { mensagem = "Produto não encontrado ou inativo." });
        }

        return Ok(produto);
    }

    /// <summary>
    /// Valida disponibilidade de estoque para uma ou mais variações (adicionar ao carrinho, alterar quantidade ou antes do checkout).
    /// </summary>
    [HttpPost("validar-estoque")]
    [ProducesResponseType(typeof(ValidacaoEstoqueResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidarEstoque([FromBody] ValidacaoEstoqueRequestDto request, CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { mensagem = "Dados de validação não informados." });
        }

        var resultado = await _produtoService.ValidarEstoqueAsync(request, cancellationToken);
        return Ok(resultado);
    }
}
