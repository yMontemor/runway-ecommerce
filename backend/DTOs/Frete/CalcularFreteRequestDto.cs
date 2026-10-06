namespace RunWay.Api.DTOs.Frete;

public class ItemFreteRequestDto
{
    public int ProdutoVariacaoId { get; set; }
    public int Quantidade { get; set; }
}

public class CalcularFreteRequestDto
{
    public string? CodigoCliente { get; set; }
    public int? EnderecoId { get; set; }
    public string? Estado { get; set; }
    public string? Cep { get; set; }
    public List<ItemFreteRequestDto> Itens { get; set; } = new();
}
