namespace RunWay.Api.Models;

public class Cliente
{
    public int Id { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public string Nome { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Cpf { get; set; } = string.Empty;

    public string Genero { get; set; } = string.Empty;

    public DateOnly DataNascimento { get; set; }

    public string SenhaHash { get; set; } = string.Empty;

    public int Ranking { get; set; } = 1;

    public bool Ativo { get; set; } = true;

    public Telefone? Telefone { get; set; }

    public ICollection<Endereco> Enderecos { get; set; } = new List<Endereco>();

    public ICollection<Cartao> Cartoes { get; set; } = new List<Cartao>();
}