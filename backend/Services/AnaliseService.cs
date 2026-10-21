using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RunWay.Api.Data;
using RunWay.Api.DTOs.Analise;
using RunWay.Api.Exceptions;
using RunWay.Api.Models;

namespace RunWay.Api.Services;

/// <summary>
/// Serviço responsável pela Análise Gerencial de Vendas por Período e Categoria.
/// Atende aos requisitos: RF0055, RF0056, RF0057, RN0071, RN0072, RN0073, RN0074.
/// </summary>
public class AnaliseService : IAnaliseService
{
    private readonly RunWayDbContext _context;

    public AnaliseService(RunWayDbContext context)
    {
        _context = context;
    }

    public async Task<AnaliseVendasResponseDto> ConsultarVendasPorPeriodoECategoriaAsync(
        ConsultaAnaliseVendasRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // 1. Validação de presença das datas (RF0055, RF0056)
        if (request == null || string.IsNullOrWhiteSpace(request.DataInicio) || string.IsNullOrWhiteSpace(request.DataFim))
        {
            throw new ValidationException("As datas inicial e final do período devem ser informadas obrigatoriamente.");
        }

        // 2. Validação e normalização de categorias (RF0057)
        var categoriasSolicitadas = (request.Categorias ?? new List<string>())
            .SelectMany(c => c.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (categoriasSolicitadas.Count == 0)
        {
            throw new ValidationException("Pelo menos uma categoria deve ser informada (RF0057).");
        }

        var categoriasExistentesNoBanco = await _context.Produtos
            .AsNoTracking()
            .Where(p => p.Ativo)
            .Select(p => p.Categoria)
            .Distinct()
            .ToListAsync(cancellationToken);

        var categoriasInvalidas = categoriasSolicitadas
            .Where(c => !categoriasExistentesNoBanco.Any(valida => string.Equals(valida, c, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        if (categoriasInvalidas.Count > 0)
        {
            throw new ValidationException(
                $"As seguintes categorias informadas são inexistentes ou inválidas: {string.Join(", ", categoriasInvalidas)}.");
        }

        // Preserva os nomes canônicos das categorias conforme persistidos no banco
        var categoriasCanonicas = categoriasExistentesNoBanco
            .Where(valida => categoriasSolicitadas.Any(solicitada => string.Equals(solicitada, valida, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(c => c)
            .ToList();

        // 3. Resolução do Fuso Horário de Negócio: America/Sao_Paulo (UTC-3 / Horário de Brasília)
        var fusoSaoPaulo = ObterFusoHorarioSaoPaulo();

        // 4. Decomposição das datas de entrada (aceita YYYY-MM ou YYYY-MM-DD)
        var inicioInfo = InterpretarData(request.DataInicio, "data inicial");
        var fimInfo = InterpretarData(request.DataFim, "data final");

        // Construção dos limites locais no fuso horário America/Sao_Paulo
        // Se informado YYYY-MM, o início é o 1º dia do mês às 00:00:00
        // Se informado YYYY-MM-DD, preserva o dia informado às 00:00:00
        var inicioLocal = inicioInfo.Dia.HasValue
            ? new DateTime(inicioInfo.Ano, inicioInfo.Mes, inicioInfo.Dia.Value, 0, 0, 0, DateTimeKind.Unspecified)
            : new DateTime(inicioInfo.Ano, inicioInfo.Mes, 1, 0, 0, 0, DateTimeKind.Unspecified);

        // Limite superior EXCLUSIVO:
        // Se informado YYYY-MM, o limite exclusivo é o 1º dia do mês seguinte às 00:00:00
        // Se informado YYYY-MM-DD, preserva o dia informado e define o limite exclusivo como o início do dia seguinte (dia + 1 às 00:00:00)
        var fimExclusivoLocal = fimInfo.Dia.HasValue
            ? new DateTime(fimInfo.Ano, fimInfo.Mes, fimInfo.Dia.Value, 0, 0, 0, DateTimeKind.Unspecified).AddDays(1)
            : new DateTime(fimInfo.Ano, fimInfo.Mes, 1, 0, 0, 0, DateTimeKind.Unspecified).AddMonths(1);

        // 5. Validação de ordem cronológica (RF0056)
        if (inicioLocal >= fimExclusivoLocal)
        {
            throw new ValidationException("A data inicial não pode ser posterior à data final (RF0056).");
        }

        // 6. Validação do intervalo permitido: 1 a 24 meses de calendário (RN0072)
        // Decisão Técnica: O cálculo de competências conta os meses de calendário abrangidos pelo intervalo.
        // Meses = (AnoFim - AnoInicio) * 12 + (MesFim - MesInicio) + 1.
        int mesesAbrangidos = (fimInfo.Ano - inicioInfo.Ano) * 12 + (fimInfo.Mes - inicioInfo.Mes) + 1;
        if (mesesAbrangidos < 1 || mesesAbrangidos > 24)
        {
            throw new ValidationException(
                $"O período selecionado abrange {mesesAbrangidos} meses. O intervalo permitido é de 1 a 24 meses (RN0072).");
        }

        // 7. Conversão dos limites locais de America/Sao_Paulo para UTC para consulta ao PostgreSQL
        var inicioUtc = TimeZoneInfo.ConvertTimeToUtc(inicioLocal, fusoSaoPaulo);
        var fimExclusivoUtc = TimeZoneInfo.ConvertTimeToUtc(fimExclusivoLocal, fusoSaoPaulo);
        var inicioUtcOffset = new DateTimeOffset(inicioUtc, TimeSpan.Zero);
        var fimExclusivoUtcOffset = new DateTimeOffset(fimExclusivoUtc, TimeSpan.Zero);

        var categoriasArray = categoriasCanonicas.ToArray();

        // 8. Agrupamento e agregação financeira direta no PostgreSQL via Entity Framework Core
        // - Exclusivamente pedidos ENTREGUE (RN0074)
        // - Intervalo com limite final exclusivo [inicioUtc, fimExclusivoUtc)
        // - Cálculo financeiro histórico: Quantidade × Preço Unitário do item, sem frete (Decisão Cartão 02 / RN0071)
        // - Fuso de negócio: agrupa estritamente por mês/ano em America/Sao_Paulo (evitando desvios de competência UTC)
        var dadosAgrupadosDb = await _context.Database.SqlQuery<DadoAgrupadoDb>($@"
            SELECT 
                date_part('year', p.dt_pedido AT TIME ZONE 'America/Sao_Paulo')::int AS ""Ano"",
                date_part('month', p.dt_pedido AT TIME ZONE 'America/Sao_Paulo')::int AS ""Mes"",
                pr.categoria AS ""Categoria"",
                COALESCE(SUM(i.quantidade * i.preco_unitario), 0.00)::numeric(10,2) AS ""Total""
            FROM ""ITEM_PEDIDO"" i
            INNER JOIN ""PEDIDO"" p ON i.pedido_id = p.id
            INNER JOIN ""PRODUTO_VARIACAO"" pv ON i.produto_variacao_id = pv.id
            INNER JOIN ""PRODUTO"" pr ON pv.produto_id = pr.id
            WHERE p.status = 'ENTREGUE'
              AND p.dt_pedido >= {inicioUtcOffset}
              AND p.dt_pedido < {fimExclusivoUtcOffset}
              AND pr.categoria = ANY({categoriasArray})
            GROUP BY 1, 2, 3
        ").ToListAsync(cancellationToken);

        // 9. Montagem da linha do tempo mensal contínua (RN0071, RN0073)
        var periodos = new List<string>();
        var mesIterador = new DateTime(inicioInfo.Ano, inicioInfo.Mes, 1);
        var mesFinal = new DateTime(fimInfo.Ano, fimInfo.Mes, 1);

        while (mesIterador <= mesFinal)
        {
            periodos.Add(mesIterador.ToString("yyyy-MM", CultureInfo.InvariantCulture));
            mesIterador = mesIterador.AddMonths(1);
        }

        // Indexa os totais obtidos do banco por chave composta: (Periodo "YYYY-MM", Categoria)
        var mapaValores = dadosAgrupadosDb.ToDictionary(
            d => ($"{d.Ano:D4}-{d.Mes:D2}", d.Categoria),
            d => d.Total,
            EqualityComparer<(string, string)>.Default);

        // 10. Consolidação das séries temporais com preenchimento zero para meses sem vendas (RN0073)
        decimal totalGeral = 0m;
        var series = new List<SerieCategoriaDto>();

        foreach (var cat in categoriasCanonicas)
        {
            decimal totalCategoria = 0m;
            var pontos = new List<PontoAnaliseDto>();

            foreach (var periodo in periodos)
            {
                decimal valorMes = mapaValores.TryGetValue((periodo, cat), out var valor) ? valor : 0.00m;
                pontos.Add(new PontoAnaliseDto
                {
                    Periodo = periodo,
                    Valor = valorMes
                });
                totalCategoria += valorMes;
            }

            totalGeral += totalCategoria;
            series.Add(new SerieCategoriaDto
            {
                Categoria = cat,
                Total = totalCategoria,
                Dados = pontos
            });
        }

        return new AnaliseVendasResponseDto
        {
            PeriodoInicial = periodos.First(),
            PeriodoFinal = periodos.Last(),
            TotalGeral = totalGeral,
            Periodos = periodos,
            Series = series
        };
    }

    private static (int Ano, int Mes, int? Dia) InterpretarData(string valor, string nomeParametro)
    {
        var texto = valor.Trim();

        if (DateTime.TryParseExact(texto, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtMes))
        {
            return (dtMes.Year, dtMes.Month, null);
        }

        if (DateTime.TryParseExact(texto, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtDia))
        {
            return (dtDia.Year, dtDia.Month, dtDia.Day);
        }

        throw new ValidationException(
            $"O parâmetro '{nomeParametro}' com valor '{valor}' está em formato inválido. Utilize o formato YYYY-MM ou YYYY-MM-DD.");
    }

    private static TimeZoneInfo ObterFusoHorarioSaoPaulo()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");
        }
    }

    public class DadoAgrupadoDb
    {
        public int Ano { get; set; }
        public int Mes { get; set; }
        public string Categoria { get; set; } = string.Empty;
        public decimal Total { get; set; }
    }
}
