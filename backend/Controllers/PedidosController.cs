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

    /// <summary>
    /// Consulta administrativa de todos os pedidos persistidos.
    /// Permite filtragem opcional por status.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<PedidoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarTodos(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var response = await _pedidoService.ListarTodosAsync(status, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Consulta de pedidos de um cliente específico pelo código público (ex: CLI-0001).
    /// </summary>
    [HttpGet("cliente/{codigoCliente}")]
    [ProducesResponseType(typeof(List<PedidoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListarPorCliente(
        [FromRoute] string codigoCliente,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _pedidoService.ListarPorClienteAsync(codigoCliente, cancellationToken);
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
    /// Detalhamento de um pedido específico pelo código público sequencial (ex: RW-2026-0001).
    /// </summary>
    [HttpGet("{codigo}")]
    [ProducesResponseType(typeof(PedidoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterPorCodigo(
        [FromRoute] string codigo,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _pedidoService.ObterPorCodigoAsync(codigo, cancellationToken);
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
    /// RN0037 / RN0038: Processamento determinístico do pagamento de um pedido em "EM PROCESSAMENTO".
    /// Quando aprovado: altera para APROVADA, realiza baixa definitiva de estoque (RF0053 / RN0028), confirma cupons.
    /// Quando reprovado: altera para REPROVADA, não baixa estoque, libera cupons reservados.
    /// </summary>
    [HttpPost("{codigo}/processar-pagamento")]
    [ProducesResponseType(typeof(PedidoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ProcessarPagamento(
        [FromRoute] string codigo,
        [FromBody] ProcessarPagamentoPedidoRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _pedidoService.ProcessarPagamentoAsync(codigo, request, cancellationToken);
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
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao processar pagamento do pedido.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0039 / RF0040 / RN0038 / RN0039 / RN0040: Atualização controlada do status do pedido.
    /// Transições permitidas:
    /// - EM PROCESSAMENTO -> APROVADA / REPROVADA
    /// - APROVADA -> EM TRANSPORTE
    /// - EM TRANSPORTE -> ENTREGUE
    /// Bloqueia qualquer transição fora da sequência oficial.
    /// </summary>
    [HttpPatch("{codigo}/status")]
    [ProducesResponseType(typeof(PedidoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AtualizarStatus(
        [FromRoute] string codigo,
        [FromBody] AtualizarStatusPedidoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _pedidoService.AtualizarStatusAsync(codigo, request, cancellationToken);
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
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao atualizar status do pedido.",
                detalhe = ex.Message
            });
        }
    }
}
