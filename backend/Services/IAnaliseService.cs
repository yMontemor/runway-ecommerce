using RunWay.Api.DTOs.Analise;

namespace RunWay.Api.Services;

public interface IAnaliseService
{
    /// <summary>
    /// Consulta o histórico financeiro de vendas agrupado por mês e categoria (RF0055, RF0056, RF0057, RN0071, RN0072, RN0073, RN0074).
    /// </summary>
    Task<AnaliseVendasResponseDto> ConsultarVendasPorPeriodoECategoriaAsync(
        ConsultaAnaliseVendasRequestDto request,
        CancellationToken cancellationToken = default);
}
