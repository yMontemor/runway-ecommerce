namespace RunWay.Api.Models;

public class Produto
{
    public int Id { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public string Nome { get; set; } = string.Empty;

    public string Marca { get; set; } = string.Empty;

    public string Categoria { get; set; } = string.Empty;

    public decimal Preco { get; set; }

    public string Descricao { get; set; } = string.Empty;

    public string ImagemUrl { get; set; } = string.Empty;

    public bool Ativo { get; set; } = true;

    public ICollection<ProdutoVariacao> Variacoes { get; set; } = new List<ProdutoVariacao>();
}
