using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Pedidos;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly IPedidoService _pedidoService;

    public PedidosController(IPedidoService pedidoService)
    {
        _pedidoService = pedidoService;
    }

    /// <summary>
    /// RF0024: Criar Pedido
    /// Revalida a compra, gera código público sequencial RW-2026-XXXX,
    /// persiste Pedido, ItemPedido, PagamentoPedido, eventual Cupom de Troca por excedente,
    /// e registra logs de auditoria atômicos para todos os 4 escopos.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PedidoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CriarPedido(
        [FromBody] CriarPedidoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _pedidoService.CriarPedidoAsync(request, cancellationToken);
            return Created($"/api/pedidos/{response.Codigo}", response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao processar e persistir o pedido.",
                detalhe = ex.Message
            });
        }
    }
}
