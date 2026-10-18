using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Carrinho;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CarrinhoController : ControllerBase
{
    private readonly ICarrinhoService _carrinhoService;

    public CarrinhoController(ICarrinhoService carrinhoService)
    {
        _carrinhoService = carrinhoService;
    }

    /// <summary>
    /// Consulta o carrinho persistido do cliente, incluindo itens, subtotal e status de expiração da reserva.
    /// Caso o prazo tenha expirado, libera as reservas e retorna a lista de itens expirados (RNF0042).
    /// </summary>
    [HttpGet("{codigoCliente}")]
    [ProducesResponseType(typeof(CarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterCarrinho(
        [FromRoute] string codigoCliente,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.ObterCarrinhoAsync(codigoCliente, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Adiciona item ao carrinho e efetua a reserva temporária de estoque no PostgreSQL com FOR UPDATE.
    /// Reinicia o prazo de expiração de 20 minutos considerando o último item adicionado (RN0044).
    /// </summary>
    [HttpPost("{codigoCliente}/itens")]
    [ProducesResponseType(typeof(CarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdicionarItem(
        [FromRoute] string codigoCliente,
        [FromBody] AdicionarItemCarrinhoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.AdicionarItemAsync(codigoCliente, request, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Altera a quantidade de um item no carrinho, recalculando a reserva de estoque.
    /// Se a quantidade for <= 0, remove o item.
    /// </summary>
    [HttpPut("{codigoCliente}/itens/{produtoVariacaoId:int}")]
    [ProducesResponseType(typeof(CarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AtualizarQuantidade(
        [FromRoute] string codigoCliente,
        [FromRoute] int produtoVariacaoId,
        [FromBody] AtualizarQuantidadeCarrinhoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.AtualizarQuantidadeItemAsync(
                codigoCliente,
                produtoVariacaoId,
                request?.Quantidade ?? 0,
                cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Remove um item específico do carrinho e libera imediatamente a reserva correspondente.
    /// </summary>
    [HttpDelete("{codigoCliente}/itens/{produtoVariacaoId:int}")]
    [ProducesResponseType(typeof(CarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoverItem(
        [FromRoute] string codigoCliente,
        [FromRoute] int produtoVariacaoId,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.RemoverItemAsync(codigoCliente, produtoVariacaoId, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Limpa todos os itens do carrinho e libera imediatamente todas as reservas de estoque.
    /// </summary>
    [HttpDelete("{codigoCliente}")]
    [ProducesResponseType(typeof(CarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LimparCarrinho(
        [FromRoute] string codigoCliente,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.LimparCarrinhoAsync(codigoCliente, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Consulta leve para acompanhamento do cronômetro de expiração e indicador de alerta (RN0044).
    /// </summary>
    [HttpGet("{codigoCliente}/expiracao")]
    [ProducesResponseType(typeof(ExpiracaoCarrinhoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterExpiracao(
        [FromRoute] string codigoCliente,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _carrinhoService.ObterExpiracaoAsync(codigoCliente, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }
}
