using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Clientes;
using RunWay.Api.Exceptions;
using RunWay.Api.Services;

namespace RunWay.Api.Controllers;

[ApiController]
[Route("api/clientes")]
public class ClientesController : ControllerBase
{
    private readonly IClienteService _clienteService;

    public ClientesController(IClienteService clienteService)
    {
        _clienteService = clienteService;
    }

    /// <summary>
    /// RF0021: Cadastrar Cliente
    /// Realiza o cadastro de um novo cliente com telefone e endereços no RunWay.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cadastrar(
        [FromBody] ClienteCreateRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.CadastrarAsync(request, cancellationToken);
            
            // Retorna 201 Created apontando para a URI REST lógica do cliente recém-criado (/api/clientes/{codigo})
            return Created($"/api/clientes/{response.Codigo}", response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }
}
