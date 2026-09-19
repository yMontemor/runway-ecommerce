namespace RunWay.Api.DTOs.Clientes;

/// <summary>
/// RF0028: DTO exclusivo para alteração de senha do cliente.
/// Atende a RNF0031 (Senha Forte) e RNF0032 (Confirmação de Senha).
/// Contrato de entrada estrito contendo exclusivamente a nova senha e sua confirmação.
/// </summary>
public class ClienteSenhaUpdateRequestDto
{
    public string NovaSenha { get; set; } = string.Empty;

    public string ConfirmacaoNovaSenha { get; set; } = string.Empty;
}
