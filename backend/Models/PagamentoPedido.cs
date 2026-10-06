namespace RunWay.Api.Models;

public class PagamentoPedido
{
    public const string FormaCartaoCredito = "CARTAO_CREDITO";
    public const string FormaCupomPromocional = "CUPOM_PROMOCIONAL";
    public const string FormaCupomTroca = "CUPOM_TROCA";

    public int Id { get; set; }

    public int PedidoId { get; set; }

    public string FormaPagamento { get; set; } = string.Empty;

    public decimal Valor { get; set; }

    // Origem 1: Cartão cadastrado no perfil do cliente
    public int? CartaoId { get; set; }

    // Origem 2: Cartão avulso utilizado somente nesta compra (snapshot não sensível - sem CVV)
    public int? BandeiraId { get; set; }

    public string? CartaoUltimosDigitos { get; set; }

    public string? CartaoNomeImpresso { get; set; }

    // Origem 3: Cupom (Promocional ou Troca)
    public int? CupomId { get; set; }

    public Pedido Pedido { get; set; } = null!;

    public Cartao? Cartao { get; set; }

    public Bandeira? Bandeira { get; set; }

    public Cupom? Cupom { get; set; }
}
