namespace RunWay.Api.DTOs.Clientes;

public class TelefoneResponseDto
{
    public int Id { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Ddd { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
}
