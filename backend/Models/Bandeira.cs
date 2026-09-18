namespace RunWay.Api.Models;

public class Bandeira
{
    public int Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    public bool Ativo { get; set; } = true;

    public ICollection<Cartao> Cartoes { get; set; } = new List<Cartao>();
}