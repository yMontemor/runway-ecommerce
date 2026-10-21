namespace RunWay.Api.DTOs.Analise;

/// <summary>
/// Série temporal de vendas para uma categoria selecionada (RF0055, RF0057, RN0073).
/// </summary>
public class SerieCategoriaDto
{
    /// <summary>
    /// Nome canônico da categoria.
    /// </summary>
    public string Categoria { get; set; } = string.Empty;

    /// <summary>
    /// Total financeiro acumulado da categoria no período consultado.
    /// </summary>
    public decimal Total { get; set; }

    /// <summary>
    /// Dados mensais contínuos da série temporal (meses sem venda preenchidos com 0,00).
    /// </summary>
    public List<PontoAnaliseDto> Dados { get; set; } = new();
}
