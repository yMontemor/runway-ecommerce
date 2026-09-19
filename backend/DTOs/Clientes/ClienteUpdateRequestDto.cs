namespace RunWay.Api.DTOs.Clientes;

/// <summary>
/// RF0022: DTO para alteração dos dados cadastrais do cliente.
/// Não inclui CPF (imutável por decisão do projeto RunWay), Código (chave pública de negócio),
/// Senha (RF0028 / Card #56), Ranking (Card #59), Situação Cadastral (RF0023 / Card #57),
/// Endereços (RF0026 / RNF0034) ou Cartões (RF0027).
/// </summary>
public class ClienteUpdateRequestDto
{
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Genero { get; set; } = string.Empty;
    public DateOnly DataNascimento { get; set; }
    public TelefoneRequestDto Telefone { get; set; } = null!;
}
