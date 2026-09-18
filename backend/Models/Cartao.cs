namespace RunWay.Api.Models;

public class Cartao
{
    public int Id { get; set; }

    public int ClienteId { get; set; }

    public int BandeiraId { get; set; }

    public string NumeroCartao { get; set; } = string.Empty;

    public string NomeImpresso { get; set; } = string.Empty;

    public string DataValidade { get; set; } = string.Empty;

    public string Cvv { get; set; } = string.Empty;

    public bool Preferencial { get; set; } = false;

    public Cliente Cliente { get; set; } = null!;

    public Bandeira Bandeira { get; set; } = null!;
}