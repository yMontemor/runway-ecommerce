namespace RunWay.Api.DTOs.Cupons;

public class CupomResponseDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public int? ClienteId { get; set; }
}
