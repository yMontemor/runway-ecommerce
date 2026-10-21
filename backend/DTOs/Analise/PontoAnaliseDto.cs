namespace RunWay.Api.DTOs.Analise;

/// <summary>
/// Ponto financeiro em um período mensal para uma categoria (RN0071, RN0073).
/// </summary>
public class PontoAnaliseDto
{
    /// <summary>
    /// Identificador do mês no formato YYYY-MM.
    /// </summary>
    public string Periodo { get; set; } = string.Empty;

    /// <summary>
    /// Valor financeiro total dos itens vendidos na categoria e mês (Quantidade × Preço Unitário).
    /// </summary>
    public decimal Valor { get; set; }
}
