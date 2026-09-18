namespace RunWay.Api.DTOs.Clientes;

public class ClienteCreateRequestDto
{
    public string Nome { get; set; } = string.Empty;
    public string Cpf { get; set; } = string.Empty;
    public DateOnly DataNascimento { get; set; }
    public string Genero { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Senha { get; set; } = string.Empty;
    public string ConfirmacaoSenha { get; set; } = string.Empty;
    public TelefoneRequestDto Telefone { get; set; } = null!;
    public List<EnderecoRequestDto> Enderecos { get; set; } = new();
}
