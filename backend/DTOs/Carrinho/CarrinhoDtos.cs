namespace RunWay.Api.DTOs.Carrinho;

public class AdicionarItemCarrinhoRequestDto
{
    public int ProdutoVariacaoId { get; set; }
    public int Quantidade { get; set; }
}

public class AtualizarQuantidadeCarrinhoRequestDto
{
    public int Quantidade { get; set; }
}

public class ItemCarrinhoResponseDto
{
    public int Id { get; set; }
    public int ProdutoVariacaoId { get; set; }
    public int ProdutoId { get; set; }
    public string CodigoProduto { get; set; } = string.Empty;
    public string NomeProduto { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public string ImagemUrl { get; set; } = string.Empty;
    public int Tamanho { get; set; }
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal => PrecoUnitario * Quantidade;
    public DateTimeOffset DataAdicionado { get; set; }
}

public class ItemExpiradoResponseDto
{
    public int ProdutoVariacaoId { get; set; }
    public string NomeProduto { get; set; } = string.Empty;
    public int Tamanho { get; set; }
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public string ImagemUrl { get; set; } = string.Empty;
    public string Motivo { get; set; } = string.Empty;
}

public class CarrinhoResponseDto
{
    public int Id { get; set; }
    public string CodigoCliente { get; set; } = string.Empty;
    public DateTimeOffset DataCriacao { get; set; }
    public DateTimeOffset DataAtualizacao { get; set; }
    public DateTimeOffset DataExpiracao { get; set; }
    public int TempoRestanteSegundos { get; set; }
    public bool AlertaExpirando { get; set; }
    public bool Expirado { get; set; }
    public string? MensagemExpiracao { get; set; }
    public int QuantidadeTotalItens { get; set; }
    public decimal Subtotal { get; set; }
    public List<ItemCarrinhoResponseDto> Itens { get; set; } = new();
    public List<ItemExpiradoResponseDto> ItensExpirados { get; set; } = new();
    public List<string> AvisosEstoque { get; set; } = new();
}

public class ExpiracaoCarrinhoResponseDto
{
    public DateTimeOffset? DataExpiracao { get; set; }
    public int TempoRestanteSegundos { get; set; }
    public bool AlertaExpirando { get; set; }
    public bool Expirado { get; set; }
    public string? Mensagem { get; set; }
}
