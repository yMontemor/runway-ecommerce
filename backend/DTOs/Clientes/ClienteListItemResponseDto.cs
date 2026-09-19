namespace RunWay.Api.DTOs.Clientes;

/// <summary>
/// RF0024 / RNF0011: DTO enxuto para projeção e retorno de itens na listagem e consulta de clientes.
/// Não expõe dados sensíveis como senha/hash, cartões ou coleção completa de endereços.
/// </summary>
public class ClienteListItemResponseDto
{
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Genero { get; set; } = string.Empty;
    public DateOnly DataNascimento { get; set; }
    public int Ranking { get; set; }
    public bool Ativo { get; set; }
    public TelefoneResponseDto? Telefone { get; set; }
}
