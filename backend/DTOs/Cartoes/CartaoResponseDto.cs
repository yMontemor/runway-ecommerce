namespace RunWay.Api.DTOs.Cartoes;

public class CartaoResponseDto
{
    public int Id { get; set; }
    public int BandeiraId { get; set; }
    public string BandeiraNome { get; set; } = string.Empty;
    public string NomeImpresso { get; set; } = string.Empty;
    public string UltimosQuatroDigitos { get; set; } = string.Empty;
    public string DataValidade { get; set; } = string.Empty;
    public bool Preferencial { get; set; }
}
