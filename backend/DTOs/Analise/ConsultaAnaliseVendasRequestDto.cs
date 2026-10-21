using Microsoft.AspNetCore.Mvc;

namespace RunWay.Api.DTOs.Analise;

/// <summary>
/// Parâmetros de consulta da Análise Gerencial de Vendas (Cartão 03 / RF0055, RF0056, RF0057, RN0071, RN0072).
/// </summary>
public class ConsultaAnaliseVendasRequestDto
{
    /// <summary>
    /// Data inicial no formato YYYY-MM ou YYYY-MM-DD.
    /// </summary>
    [FromQuery(Name = "dataInicio")]
    public string? DataInicio { get; set; }

    /// <summary>
    /// Data final no formato YYYY-MM ou YYYY-MM-DD.
    /// </summary>
    [FromQuery(Name = "dataFim")]
    public string? DataFim { get; set; }

    /// <summary>
    /// Lista de categorias a consultar (RF0057). Aceita múltiplos parâmetros ou valores separados por vírgula.
    /// </summary>
    [FromQuery(Name = "categorias")]
    public List<string>? Categorias { get; set; }
}
