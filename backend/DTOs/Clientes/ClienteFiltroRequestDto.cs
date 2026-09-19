namespace RunWay.Api.DTOs.Clientes;

/// <summary>
/// RF0024 / RNF0011: DTO para recebimento dos parâmetros opcionais de filtro na consulta de clientes.
/// </summary>
public class ClienteFiltroRequestDto
{
    public string? Codigo { get; set; }
    public string? Nome { get; set; }
    public string? Cpf { get; set; }
    public string? Email { get; set; }
    public string? Genero { get; set; }
    public DateOnly? DataNascimento { get; set; }
    public string? Telefone { get; set; }
    public bool? Ativo { get; set; }
}
