using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Frete;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FreteController : ControllerBase
{
    private readonly IFreteService _freteService;

    public FreteController(IFreteService freteService)
    {
        _freteService = freteService;
    }

    /// <summary>
    /// Calcula o valor oficial do frete com base na UF de entrega e na quantidade de itens do carrinho.
    /// </summary>
    [HttpPost("calcular")]
    [ProducesResponseType(typeof(CalcularFreteResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CalcularFrete(
        [FromBody] CalcularFreteRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var resultado = await _freteService.CalcularFreteAsync(request, cancellationToken);
            return Ok(resultado);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao calcular frete no servidor.", detalhe = ex.Message });
        }
    }
}
