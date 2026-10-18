using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Cupons;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CuponsController : ControllerBase
{
    private readonly ICupomService _cupomService;

    public CuponsController(ICupomService cupomService)
    {
        _cupomService = cupomService;
    }

    [HttpGet("troca/{codigoCliente}")]
    [ProducesResponseType(typeof(List<CupomResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListarCuponsTrocaCliente(string codigoCliente, CancellationToken cancellationToken)
    {
        try
        {
            var cupons = await _cupomService.ListarCuponsTrocaClienteAsync(codigoCliente, cancellationToken);
            return Ok(cupons);
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
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao listar cupons de troca.", detalhe = ex.Message });
        }
    }

    [HttpGet("cliente/{codigoCliente}")]
    [ProducesResponseType(typeof(List<CupomResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListarCuponsCliente(string codigoCliente, CancellationToken cancellationToken)
    {
        try
        {
            var cupons = await _cupomService.ListarTodosCuponsClienteAsync(codigoCliente, cancellationToken);
            return Ok(cupons);
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
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao listar cupons do cliente.", detalhe = ex.Message });
        }
    }

    [HttpGet("promocionais")]
    [ProducesResponseType(typeof(List<CupomResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarCuponsPromocionais(CancellationToken cancellationToken)
    {
        try
        {
            var cupons = await _cupomService.ListarCuponsPromocionaisAsync(cancellationToken);
            return Ok(cupons);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao listar cupons promocionais.", detalhe = ex.Message });
        }
    }

    [HttpPost("consultar")]
    [ProducesResponseType(typeof(CupomResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConsultarCupom([FromBody] ConsultarCupomRequestDto request, CancellationToken cancellationToken)
    {
        try
        {
            var cupom = await _cupomService.ConsultarCupomAsync(request, cancellationToken);
            return Ok(cupom);
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
            return StatusCode(StatusCodes.Status500InternalServerError, new { erro = "Falha ao consultar cupom.", detalhe = ex.Message });
        }
    }
}
