namespace RunWay.Api.Models;

public class Telefone
{
    public int Id { get; set; }

    public int ClienteId { get; set; }

    public string Tipo { get; set; } = string.Empty;

    public string Ddd { get; set; } = string.Empty;

    public string Numero { get; set; } = string.Empty;

    public Cliente Cliente { get; set; } = null!;
}