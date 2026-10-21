using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Analise;
using RunWay.Api.Exceptions;
using RunWay.Api.Filters;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

/// <summary>
/// Controller responsável pelos endpoints da Análise Gerencial de Vendas (Cartão 03 e Cartão 04 / RF0055, RNF0011).
/// Acesso restrito ao perfil ADMINISTRADOR mediante credencial administrativa configurada (RF0055).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AnaliseController : ControllerBase
{
    private readonly IAnaliseService _analiseService;

    public AnaliseController(IAnaliseService analiseService)
    {
        _analiseService = analiseService;
    }

    /// <summary>
    /// Consulta o histórico de vendas por período e categoria de produto (RF0055, RF0056, RF0057, RN0071, RN0072, RN0073, RN0074).
    /// Exige credencial administrativa no cabeçalho Authorization ou X-Admin-Key.
    /// </summary>
    /// <param name="request">Filtros de data inicial, data final e categorias.</param>
    /// <param name="cancellationToken">Token de cancelamento da requisição HTTP.</param>
    /// <returns>Dados consolidados da análise gerencial com séries temporais e totais por categoria.</returns>
    [HttpGet("vendas")]
    [AdminAuthorize]
    [ProducesResponseType(typeof(AnaliseVendasResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ConsultarVendas(
        [FromQuery] ConsultaAnaliseVendasRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var resultado = await _analiseService.ConsultarVendasPorPeriodoECategoriaAsync(request, cancellationToken);
            return Ok(resultado);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                erro = "Falha ao processar a análise gerencial de vendas.",
                detalhe = ex.Message
            });
        }
    }
}
