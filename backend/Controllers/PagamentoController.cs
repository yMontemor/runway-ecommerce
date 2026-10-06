using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Pagamento;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PagamentoController : ControllerBase
{
    private readonly IPagamentoService _pagamentoService;

    public PagamentoController(IPagamentoService pagamentoService)
    {
        _pagamentoService = pagamentoService;
    }

    [HttpPost("validar")]
    [ProducesResponseType(typeof(ValidarPagamentoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ValidarPagamento(
        [FromBody] ValidarPagamentoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var resultado = await _pagamentoService.ValidarPagamentoAsync(request, cancellationToken);
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
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao validar composição de pagamento.", detalhe = ex.Message });
        }
    }
}
