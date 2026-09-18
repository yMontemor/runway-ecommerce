namespace RunWay.Api.DTOs.Clientes;

public class ClienteResponseDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public string Genero { get; set; } = string.Empty;
    public DateOnly DataNascimento { get; set; }
    public int Ranking { get; set; }
    public bool Ativo { get; set; }
    public TelefoneResponseDto Telefone { get; set; } = null!;
    public List<EnderecoResponseDto> Enderecos { get; set; } = new();
}
