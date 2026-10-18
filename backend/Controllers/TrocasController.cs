using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Trocas;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrocasController : ControllerBase
{
    private readonly ITrocaService _trocaService;

    public TrocasController(ITrocaService trocaService)
    {
        _trocaService = trocaService;
    }

    /// <summary>
    /// RF0041 / RN0041 / RN0043: Solicitar troca de itens de um pedido ENTREGUE.
    /// Valida elegibilidade, quantidades, gera registro em EM TROCA e altera pedido se total.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TrocaResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SolicitarTroca(
        [FromBody] SolicitarTrocaRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.SolicitarTrocaAsync(request, cancellationToken);
            return Created($"/api/trocas/{response.Codigo}", response);
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
                erro = "Falha ao registrar a solicitação de troca.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0043: Visualização de trocas do cliente autenticado.
    /// </summary>
    [HttpGet("cliente/{codigoCliente}")]
    [ProducesResponseType(typeof(List<TrocaResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ListarPorCliente(
        string codigoCliente,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ListarTrocasPorClienteAsync(codigoCliente, cancellationToken);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao consultar as trocas do cliente.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0043: Consulta administrativa de todas as trocas cadastradas, com filtro opcional por status.
    /// </summary>
    [HttpGet("admin")]
    [ProducesResponseType(typeof(List<TrocaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarAdmin(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ListarTrocasAdminAsync(status, cancellationToken);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao consultar as trocas administrativas.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0043: Consulta detalhada de uma troca específica por código.
    /// </summary>
    [HttpGet("{codigo}")]
    [ProducesResponseType(typeof(TrocaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterPorCodigo(
        string codigo,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ObterTrocaPorCodigoAsync(codigo, cancellationToken);
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
                erro = "Falha ao consultar os detalhes da troca.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0042 / RN0046: Autorização administrativa de solicitação de troca.
    /// Gera notificação persistida interna para o cliente e avança status para TROCA AUTORIZADA.
    /// </summary>
    [HttpPost("{codigo}/autorizar")]
    [ProducesResponseType(typeof(TrocaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AutorizarTroca(
        string codigo,
        [FromBody] AutorizarTrocaRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.AutorizarTrocaAsync(codigo, request ?? new AutorizarTrocaRequestDto(), cancellationToken);
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
                erro = "Falha ao processar a autorização da troca.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RF0044 / RF0045 / RF0054 / RN0042: Confirmação de recebimento dos itens.
    /// Processa decisão de retorno ao estoque, gera cupom de troca e altera status para TROCADO.
    /// </summary>
    [HttpPost("{codigo}/recebimento")]
    [ProducesResponseType(typeof(TrocaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmarRecebimento(
        string codigo,
        [FromBody] ConfirmarRecebimentoTrocaRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ConfirmarRecebimentoAsync(codigo, request, cancellationToken);
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
                erro = "Falha ao processar a confirmação de recebimento da troca.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// RN0046: Consulta da notificação persistida gerada na autorização da troca.
    /// </summary>
    [HttpGet("{codigo}/notificacao")]
    [ProducesResponseType(typeof(NotificacaoTrocaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObterNotificacao(
        string codigo,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ObterNotificacaoTrocaAsync(codigo, cancellationToken);
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
                erro = "Falha ao consultar a notificação da troca.",
                detalhe = ex.Message
            });
        }
    }

    /// <summary>
    /// Consulta os itens de um pedido e suas quantidades ainda elegíveis para troca.
    /// </summary>
    [HttpGet("elegibilidade/{codigoPedido}")]
    [ProducesResponseType(typeof(ElegibilidadeTrocaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConsultarElegibilidade(
        string codigoPedido,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _trocaService.ConsultarElegibilidadeTrocaAsync(codigoPedido, cancellationToken);
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
                erro = "Falha ao consultar a elegibilidade de troca do pedido.",
                detalhe = ex.Message
            });
        }
    }
}
