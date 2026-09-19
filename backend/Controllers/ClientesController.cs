using Microsoft.AspNetCore.Mvc;
using RunWay.Api.DTOs.Cartoes;
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

    /// <summary>
    /// RF0022: Alterar Cliente
    /// Atualiza os dados cadastrais editáveis do cliente identificado pelo seu código público CLI-XXXX.
    /// Retorna 200 OK, 400 Bad Request, 404 Not Found ou 409 Conflict.
    /// </summary>
    [HttpPut("{codigo}")]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Alterar(
        [FromRoute] string codigo,
        [FromBody] ClienteUpdateRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.AlterarAsync(codigo, request, cancellationToken);
            return Ok(response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
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

    /// <summary>
    /// RF0024: Consulta persistente de clientes utilizando query parameters opcionais.
    /// RNF0011: Execução direta no banco sem materialização excessiva.
    /// Retorna 200 OK com array vazio [] quando nenhum cliente é encontrado.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ClienteListItemResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Consultar(
        [FromQuery] ClienteFiltroRequestDto filtro,
        CancellationToken cancellationToken)
    {
        var response = await _clienteService.ConsultarAsync(filtro, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// RF0026: Lista os endereços cadastrados de um cliente pelo seu código único.
    /// </summary>
    [HttpGet("{codigo}/enderecos")]
    [ProducesResponseType(typeof(List<EnderecoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListarEnderecos(
        [FromRoute] string codigo,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.ListarEnderecosAsync(codigo, cancellationToken);
            return Ok(response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// RF0026 / RNF0034: Cadastra um novo endereço para o cliente de forma independente.
    /// </summary>
    [HttpPost("{codigo}/enderecos")]
    [ProducesResponseType(typeof(EnderecoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdicionarEndereco(
        [FromRoute] string codigo,
        [FromBody] EnderecoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.AdicionarEnderecoAsync(codigo, request, cancellationToken);
            return Created($"/api/clientes/{codigo}/enderecos/{response.Id}", response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// RF0026 / RNF0034 / RN0021 / RN0022 / RN0026: Altera um endereço existente do cliente.
    /// </summary>
    [HttpPut("{codigo}/enderecos/{enderecoId:int}")]
    [ProducesResponseType(typeof(EnderecoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AlterarEndereco(
        [FromRoute] string codigo,
        [FromRoute] int enderecoId,
        [FromBody] EnderecoRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.AlterarEnderecoAsync(codigo, enderecoId, request, cancellationToken);
            return Ok(response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// RF0027: Lista os cartões de crédito cadastrados de um cliente pelo seu código único.
    /// </summary>
    [HttpGet("{codigo}/cartoes")]
    [ProducesResponseType(typeof(List<CartaoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListarCartoes(
        [FromRoute] string codigo,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.ListarCartoesAsync(codigo, cancellationToken);
            return Ok(response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// RF0027 / RN0024 / RN0025: Cadastra um novo cartão de crédito para o cliente de forma independente.
    /// </summary>
    [HttpPost("{codigo}/cartoes")]
    [ProducesResponseType(typeof(CartaoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdicionarCartao(
        [FromRoute] string codigo,
        [FromBody] CartaoCreateRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.AdicionarCartaoAsync(codigo, request, cancellationToken);
            return Created($"/api/clientes/{codigo}/cartoes/{response.Id}", response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// RF0027: Define um cartão existente como o preferencial do cliente informado.
    /// </summary>
    [HttpPatch("{codigo}/cartoes/{cartaoId:int}/preferencial")]
    [ProducesResponseType(typeof(CartaoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DefinirCartaoPreferencial(
        [FromRoute] string codigo,
        [FromRoute] int cartaoId,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _clienteService.DefinirCartaoPreferencialAsync(codigo, cartaoId, cancellationToken);
            return Ok(response);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}

