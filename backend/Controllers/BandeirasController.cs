using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Bandeiras;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/bandeiras")]
public class BandeirasController : ControllerBase
{
    private readonly IBandeiraService _bandeiraService;

    public BandeirasController(IBandeiraService bandeiraService)
    {
        _bandeiraService = bandeiraService;
    }

    /// <summary>
    /// RN0025: Lista todas as bandeiras de cartão de crédito ativas e previamente cadastradas.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<BandeiraResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken cancellationToken)
    {
        var bandeiras = await _bandeiraService.ListarAtivasAsync(cancellationToken);
        return Ok(bandeiras);
    }
}
