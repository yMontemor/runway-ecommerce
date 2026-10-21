namespace RunWay.Api.DTOs.Analise;

/// <summary>
/// Resposta consolidada da Análise Gerencial de Vendas (Cartão 03 / RF0055).
/// </summary>
public class AnaliseVendasResponseDto
{
    /// <summary>
    /// Primeiro mês de competência do período (YYYY-MM).
    /// </summary>
    public string PeriodoInicial { get; set; } = string.Empty;

    /// <summary>
    /// Último mês de competência do período (YYYY-MM).
    /// </summary>
    public string PeriodoFinal { get; set; } = string.Empty;

    /// <summary>
    /// Somatório financeiro geral de todas as categorias consultadas no período.
    /// </summary>
    public decimal TotalGeral { get; set; }

    /// <summary>
    /// Linha do tempo contínua de competências mensais (YYYY-MM).
    /// </summary>
    public List<string> Periodos { get; set; } = new();

    /// <summary>
    /// Séries temporais por categoria consultada.
    /// </summary>
    public List<SerieCategoriaDto> Series { get; set; } = new();
}
