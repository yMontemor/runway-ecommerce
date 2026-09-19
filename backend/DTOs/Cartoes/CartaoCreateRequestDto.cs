namespace RunWay.Api.DTOs.Cartoes;

public class CartaoCreateRequestDto
{
    public int BandeiraId { get; set; }
    public string NumeroCartao { get; set; } = string.Empty;
    public string NomeImpresso { get; set; } = string.Empty;
    public string DataValidade { get; set; } = string.Empty;
    public string Cvv { get; set; } = string.Empty;
    public bool Preferencial { get; set; }
}
