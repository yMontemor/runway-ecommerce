namespace RunWay.Api.DTOs.Frete;

public class CalcularFreteResponseDto
{
    public decimal ValorFrete { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string Regiao { get; set; } = string.Empty;
    public int QuantidadeItens { get; set; }
}
