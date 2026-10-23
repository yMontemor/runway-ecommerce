import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { analiseService } from '../../../services/analiseService';
import type { AnaliseVendasResponseDto } from '../../../services/analiseService';

const CATEGORY_COLORS: Record<string, string> = {
  'TREINO DIÁRIO': 'var(--color-primary)', // Verde neon
  'COMPETIÇÃO': '#ff9f40',                // Laranja vibrante
  'LONGA DISTÂNCIA': '#3a86ff',           // Azul
  'VELOCIDADE': '#ff006e',                // Rosa
  'TRAIL': '#2ecc71'                      // Verde esmeralda
};

const DYNAMIC_PALETTE = ['#8338ec', '#00d2d3', '#ffbe0b', '#f368e0', '#54a0ff'];

function formatMonthLabel(periodo: string): string {
  if (!periodo || !periodo.includes('-')) return periodo;
  const [ano, mes] = periodo.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(mes, 10) - 1;
  const anoCurto = ano.slice(-2);
  return `${nomes[idx] || mes}/${anoCurto}`;
}

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularMesesAbrangidos(dInicioStr: string, dFimStr: string): number {
  if (!dInicioStr || !dFimStr) return 0;
  const [y1, m1] = dInicioStr.split('-').map(Number);
  const [y2, m2] = dFimStr.split('-').map(Number);
  if (isNaN(y1) || isNaN(m1) || isNaN(y2) || isNaN(m2)) return 0;
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

function parseDataIso(dStr: string): { ano: number; mes: number; dia?: number } | null {
  if (!dStr) return null;
  const parts = dStr.split('-').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return {
      ano: parts[0],
      mes: parts[1],
      dia: parts.length >= 3 && !isNaN(parts[2]) ? parts[2] : undefined
    };
  }
  return null;
}

function formatDisplayDate(dStr?: string): string {
  if (!dStr) return '';
  const info = parseDataIso(dStr);
  if (!info) return dStr;
  if (info.dia) {
    return `${String(info.dia).padStart(2, '0')}/${String(info.mes).padStart(2, '0')}/${info.ano}`;
  }
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Dez'];
  return `${meses[info.mes - 1] || info.mes}/${info.ano}`;
}

function verificarParcialidadeCompetencia(
  periodo: string,
  applied: { startDate: string; endDate: string } | null
): {
  isParcial: boolean;
  detalhe?: string;
  isInicioParcial: boolean;
  isFimParcial: boolean;
} {
  if (!applied || !periodo) {
    return { isParcial: false, isInicioParcial: false, isFimParcial: false };
  }

  const startInfo = parseDataIso(applied.startDate);
  const endInfo = parseDataIso(applied.endDate);
  if (!startInfo || !endInfo) {
    return { isParcial: false, isInicioParcial: false, isFimParcial: false };
  }

  const [anoPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  let isInicioParcial = false;
  let isFimParcial = false;
  let detalhe = '';

  // Início parcial: se for o primeiro mês da consulta e dia > 1
  if (startInfo.dia && startInfo.dia > 1 && startInfo.ano === anoPeriodo && startInfo.mes === mesPeriodo) {
    isInicioParcial = true;
    detalhe = `a partir de ${String(startInfo.dia).padStart(2, '0')}/${String(startInfo.mes).padStart(2, '0')}`;
  }

  // Fim parcial: se for o último mês da consulta e dia < último dia do mês
  if (endInfo.dia && endInfo.ano === anoPeriodo && endInfo.mes === mesPeriodo) {
    const ultimoDia = new Date(endInfo.ano, endInfo.mes, 0).getDate();
    if (endInfo.dia < ultimoDia) {
      isFimParcial = true;
      const detalheFim = `até ${String(endInfo.dia).padStart(2, '0')}/${String(endInfo.mes).padStart(2, '0')}`;
      detalhe = detalhe ? `${detalhe} e ${detalheFim}` : detalheFim;
    }
  }

  const isParcial = isInicioParcial || isFimParcial;
  return {
    isParcial,
    detalhe: isParcial ? `(${detalhe})` : undefined,
    isInicioParcial,
    isFimParcial
  };
}

export default function AdminAnalytics() {
  const { products, isLoadingProducts } = useApp();

  // Período padrão: Ano corrente (2026-01-01 a 2026-12-31, 12 meses)
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [catsInitialized, setCatsInitialized] = useState(false);

  // Filtros efetivamente aplicados na última consulta retornada (ACH-01)
  const [appliedFilters, setAppliedFilters] = useState<{
    startDate: string;
    endDate: string;
    categories: string[];
  } | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analiseData, setAnaliseData] = useState<AnaliseVendasResponseDto | null>(null);

  const [tooltip, setTooltip] = useState<{
    month: string;
    category: string;
    value: number;
    x: number;
    y: number;
    color?: string;
    isPartial?: boolean;
    partialDetail?: string;
    coincidentCats?: string[];
    coincidentItems?: { categoria: string; valor: number; cor: string }[];
  } | null>(null);

  const activeAbortRef = useRef<AbortController | null>(null);

  // Categorias canônicas extraídas exclusivamente do catálogo real de produtos (Condição 3)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim().length > 0) {
        cats.add(p.category.trim().toUpperCase());
      }
    });
    return Array.from(cats).sort();
  }, [products]);

  // Inicializar seleção de categorias assim que os produtos do backend forem carregados
  useEffect(() => {
    if (!catsInitialized && availableCategories.length > 0) {
      setSelectedCats(availableCategories);
      setCatsInitialized(true);
    }
  }, [availableCategories, catsInitialized]);

  // Função central de consulta à API
  const fetchVendas = useCallback(async (start: string, end: string, cats: string[]) => {
    if (!start || !end) {
      setValidationError('As datas inicial e final devem ser preenchidas.');
      return;
    }

    if (start > end) {
      setValidationError('A data final não pode ser anterior à data inicial.');
      return;
    }

    const meses = calcularMesesAbrangidos(start, end);
    if (meses < 1 || meses > 24) {
      setValidationError(`O período selecionado abrange ${meses} meses. O limite permitido é de 1 a 24 meses.`);
      return;
    }

    if (cats.length === 0) {
      setValidationError('Selecione ao menos uma categoria para exibir no gráfico.');
      return;
    }

    setValidationError(null);
    setApiError(null);

    // Cancelar requisição anterior em andamento para evitar race conditions (Condição 13)
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortRef.current = abortController;

    setIsLoading(true);

    try {
      const res = await analiseService.consultarVendas(
        { dataInicio: start, dataFim: end, categorias: cats },
        abortController.signal
      );

      if (abortController.signal.aborted) return;

      if (res.sucesso && res.dados) {
        setAnaliseData(res.dados);
        setAppliedFilters({ startDate: start, endDate: end, categories: [...cats] });
        setApiError(null);
      } else {
        setApiError(res.mensagem || 'Erro ao consultar análise de vendas.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setApiError(err.message || 'Falha de comunicação com o servidor ao consultar análise.');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Consulta automática inicial ao carregar as categorias
  useEffect(() => {
    if (selectedCats.length > 0 && !analiseData && !isLoading) {
      fetchVendas(startDate, endDate, selectedCats);
    }
  }, [selectedCats, analiseData, isLoading, startDate, endDate, fetchVendas]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
    };
  }, []);

  const handleCategoryToggle = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAllCats = () => {
    setSelectedCats([...availableCategories]);
  };

  const handleClearCats = () => {
    setSelectedCats([]);
  };

  const handleConsultar = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendas(startDate, endDate, selectedCats);
  };

  // Cálculo da geometria do gráfico SVG baseado nos dados reais retornados
  const periodos = analiseData?.periodos || [];
  const series = analiseData?.series || [];

  const svgWidth = 780;
  const svgHeight = 380;
  const paddingLeft = 75;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 55;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Encontrar o maior valor pontual entre todas as séries retornadas para a escala vertical
  let maxValorPontual = 0;
  series.forEach(s => {
    s.dados.forEach(d => {
      if (d.valor > maxValorPontual) {
        maxValorPontual = d.valor;
      }
    });
  });

  // Escala dinâmica inteligente para o eixo financeiro (RNF0044)
  let yAxisMax = 1000;
  if (maxValorPontual > 0) {
    if (maxValorPontual <= 2000) {
      yAxisMax = Math.ceil(maxValorPontual / 500) * 500;
    } else if (maxValorPontual <= 10000) {
      yAxisMax = Math.ceil(maxValorPontual / 1000) * 1000;
    } else {
      yAxisMax = Math.ceil(maxValorPontual / 5000) * 5000;
    }
  }

  // Espaçamento entre meses
  const xSpacing = periodos.length > 1 ? chartWidth / (periodos.length - 1) : 0;

  // Obter cor da categoria com fallback na paleta dinâmica
  const getCategoryColor = (cat: string, index: number) => {
    return CATEGORY_COLORS[cat] || DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length];
  };

  // Mapeamento de sobreposição de pontos: (periodo_valor) -> lista de categorias e detalhes estruturados
  // Garante que categorias com valores iguais no mesmo mês permaneçam visualmente identificáveis e consultáveis
  interface CoincidentItem {
    categoria: string;
    valor: number;
    cor: string;
  }
  const coincidentMap: Record<string, string[]> = {};
  const coincidentItemsMap: Record<string, CoincidentItem[]> = {};

  series.forEach((s, sIdx) => {
    const cor = getCategoryColor(s.categoria, sIdx);
    s.dados.forEach(d => {
      const key = `${d.periodo}_${d.valor.toFixed(2)}`;
      if (!coincidentMap[key]) {
        coincidentMap[key] = [];
        coincidentItemsMap[key] = [];
      }
      coincidentMap[key].push(s.categoria);
      coincidentItemsMap[key].push({
        categoria: s.categoria,
        valor: d.valor,
        cor
      });
    });
  });

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">ANÁLISE DE VENDAS</h3>
      </div>

      {/* Formulário de Filtros de Período e Categorias */}
      <form onSubmit={handleConsultar} className="analytics-filters-card" data-cy="form-filtros-analise">
        <div className="filters-date-group">
          <div className="date-input-group">
            <label htmlFor="input-data-inicio">DATA INICIAL</label>
            <input
              id="input-data-inicio"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="analytics-date-input"
              data-cy="input-data-inicio"
            />
          </div>

          <div className="date-input-group">
            <label htmlFor="input-data-fim">DATA FINAL</label>
            <input
              id="input-data-fim"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="analytics-date-input"
              data-cy="input-data-fim"
            />
          </div>
        </div>

        {/* Seleção de Categorias Reais do Catálogo */}
        <div className="categories-filter-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span className="group-label">CATEGORIAS DE PRODUTOS</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSelectAllCats}
                className="btn-cat-quick-toggle"
                data-cy="btn-todas-categorias"
              >
                Selecionar Todas
              </button>
              <button
                type="button"
                onClick={handleClearCats}
                className="btn-cat-quick-toggle"
                data-cy="btn-limpar-categorias"
              >
                Limpar
              </button>
            </div>
          </div>

          {isLoadingProducts ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              Carregando categorias do catálogo...
            </div>
          ) : availableCategories.length === 0 ? (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>
              Nenhuma categoria encontrada no catálogo de produtos.
            </div>
          ) : (
            <div className="categories-toggle-list" data-cy="lista-categorias-filtro">
              {availableCategories.map((cat) => {
                const isActive = selectedCats.includes(cat);
                const classCat = cat.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryToggle(cat)}
                    className={`category-toggle-btn ${isActive ? 'active' : ''} ${classCat}`}
                    data-cy={`toggle-cat-${classCat}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Linha de Ação do Filtro */}
        <div className="filter-actions-row">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-consultar-analise"
            data-cy="btn-aplicar-filtros"
          >
            {isLoading ? 'Consultando...' : 'CONSULTAR VENDAS'}
          </button>
        </div>
      </form>

      {/* Mensagens de Validação e Erro */}
      {validationError && (
        <div className="analytics-validation-error" data-cy="msg-erro-validacao">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {validationError}
        </div>
      )}

      {apiError && (
        <div className="analytics-validation-error" data-cy="msg-erro-api">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem', flexShrink: 0 }}>
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {apiError}
        </div>
      )}

      {/* Banner de Ausência de Vendas (RN0073) */}
      {analiseData && analiseData.totalGeral === 0 && !isLoading && (
        <div className="analytics-empty-banner" data-cy="msg-sem-vendas">
          Nenhum pedido entregue foi registrado no período e categorias selecionados.
        </div>
      )}

      {/* Renderização do Gráfico SVG e Totais */}
      {analiseData && (
        <div className="analytics-chart-container" data-cy="painel-grafico-analise">
          <div className="svg-chart-wrapper">
            {isLoading && (
              <div className="analytics-loading-overlay" data-cy="loading-overlay">
                <span>Atualizando dados da análise...</span>
              </div>
            )}

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="svg-line-chart">
              {/* Linhas de Grade e Eixo Y */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const yVal = yAxisMax * ratio;
                const yPos = paddingTop + chartHeight - ratio * chartHeight;
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={svgWidth - paddingRight}
                      y2={yPos}
                      stroke="#1d1d1d"
                      strokeWidth="1"
                      strokeDasharray={idx === 0 ? 'none' : '4 4'}
                    />
                    <text
                      x={paddingLeft - 10}
                      y={yPos + 4}
                      fill="#888888"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {yVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </text>
                  </g>
                );
              })}

              {/* Rótulos do Eixo X (Meses) */}
              {periodos.map((p, idx) => {
                const xPos = periodos.length > 1
                  ? paddingLeft + idx * xSpacing
                  : paddingLeft + chartWidth / 2;

                // Evitar sobreposição de texto caso haja mais de 12 meses
                const shouldDisplayLabel = periodos.length <= 12 || idx % 2 === 0 || idx === periodos.length - 1;
                const partialInfo = verificarParcialidadeCompetencia(p, appliedFilters);

                return (
                  <g key={p}>
                    <line
                      x1={xPos}
                      y1={paddingTop}
                      x2={xPos}
                      y2={paddingTop + chartHeight}
                      stroke="#161616"
                      strokeWidth="1"
                    />
                    {/* Traço de demarcação (tick) na linha de base */}
                    <line
                      x1={xPos}
                      y1={paddingTop + chartHeight}
                      x2={xPos}
                      y2={paddingTop + chartHeight + 4}
                      stroke="#333333"
                      strokeWidth="1"
                    />
                    {shouldDisplayLabel && (
                      <text
                        x={xPos}
                        y={paddingTop + chartHeight + 28}
                        fill="#888888"
                        fontSize={periodos.length > 16 ? '9' : '10.5'}
                        fontWeight="600"
                        textAnchor="middle"
                        data-cy="rotulo-eixo-x"
                      >
                        {partialInfo.isParcial ? `${formatMonthLabel(p)}*` : formatMonthLabel(p)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Séries Temporais por Categoria (RF0055, RNF0043, RN0073) */}
              {series.map((serie, sIdx) => {
                const strokeColor = getCategoryColor(serie.categoria, sIdx);

                // Mapear pontos para coordenadas SVG
                const points = serie.dados.map((d, dIdx) => {
                  const x = periodos.length > 1
                    ? paddingLeft + dIdx * xSpacing
                    : paddingLeft + chartWidth / 2;
                  
                  // Meses sem venda com valor zero representados na base inferior (RN0073)
                  const y = paddingTop + chartHeight - (d.valor / yAxisMax) * chartHeight;

                  const coincidentCats = coincidentMap[`${d.periodo}_${d.valor.toFixed(2)}`] || [];
                  const coincidentTotal = coincidentCats.length;
                  const coincidentIndex = coincidentCats.indexOf(serie.categoria);

                  return {
                    x,
                    y,
                    valor: d.valor,
                    periodo: d.periodo,
                    categoria: serie.categoria,
                    coincidentTotal,
                    coincidentIndex: coincidentIndex >= 0 ? coincidentIndex : 0,
                    coincidentCats
                  };
                });

                if (points.length === 0) return null;
                const pathString = points.map(pt => `${pt.x},${pt.y}`).join(' ');

                return (
                  <g key={serie.categoria} data-cy={`serie-${serie.categoria}`}>
                    {/* Polilinha contínua da categoria apenas quando houver 2 ou mais pontos (ACH-02) */}
                    {points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pathString}
                      />
                    )}

                    {/* Se período for de 1 único mês, renderizar linha guia vertical e traço de nível (ACH-02) */}
                    {periodos.length === 1 && points.map((pt, pIdx) => (
                      <g key={`single-guide-${pIdx}`}>
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={pt.x}
                          y2={paddingTop + chartHeight}
                          stroke="#2c2c2c"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1={pt.x - 24}
                          y1={pt.y}
                          x2={pt.x + 24}
                          y2={pt.y}
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeDasharray="3 3"
                          opacity="0.75"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={14 + pt.coincidentIndex * 4}
                          fill={strokeColor}
                          opacity="0.18"
                          pointerEvents="none"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 14 - pt.coincidentIndex * 15}
                          fill={strokeColor}
                          fontSize="11"
                          fontWeight="700"
                          textAnchor="middle"
                          data-cy={`rotulo-ponto-${serie.categoria}`}
                        >
                          {series.length > 1 ? `${serie.categoria}: ${formatCurrency(pt.valor)}` : formatCurrency(pt.valor)}
                        </text>
                      </g>
                    ))}

                    {/* Círculos / Nós em cada mês */}
                    {points.map((pt, pIdx) => {
                      const isSingleMonth = periodos.length === 1;

                      // Cálculo do raio e preenchimento respeitando o tipo de período e valor
                      let circleRadius: number;
                      let circleFill: string;
                      let circleStrokeWidth: number;

                      if (isSingleMonth) {
                        // Preserva integralmente o destaque de 1 único mês e a diferenciação concêntrica ACH-02
                        circleRadius = pt.coincidentTotal > 1 ? 6 + pt.coincidentIndex * 4 : 6;
                        circleFill = pt.coincidentIndex === 0 ? '#050505' : 'none';
                        circleStrokeWidth = 3;
                      } else {
                        // Múltiplos meses (redução de marcadores e eliminação de halos concêntricos excessivos)
                        if (pt.valor === 0) {
                          // Linha de base R$ 0,00: raio uniforme compacto de 3.5px sem halos gigantes
                          circleRadius = 3.5;
                          circleFill = pt.coincidentIndex === 0 ? '#0a0a0a' : 'none';
                          circleStrokeWidth = 1.8;
                        } else {
                          // Valor > 0: compacto, com anel concêntrico suave se coincidente (limitado a max 6.5px)
                          circleRadius = pt.coincidentTotal > 1
                            ? Math.min(6.5, 4.0 + pt.coincidentIndex * 1.0)
                            : 4.0;
                          circleFill = pt.coincidentIndex === 0 ? '#0a0a0a' : 'none';
                          circleStrokeWidth = 2;
                        }
                      }

                      const handlePointInteraction = () => {
                        const partialInfo = verificarParcialidadeCompetencia(pt.periodo, appliedFilters);
                        const key = `${pt.periodo}_${pt.valor.toFixed(2)}`;
                        const cItems = coincidentItemsMap[key] || [];
                        setTooltip({
                          month: partialInfo.isParcial ? `${formatMonthLabel(pt.periodo)} ${partialInfo.detalhe}` : formatMonthLabel(pt.periodo),
                          category: pt.categoria,
                          value: pt.valor,
                          x: pt.x,
                          y: pt.y,
                          color: strokeColor,
                          isPartial: partialInfo.isParcial,
                          partialDetail: partialInfo.detalhe,
                          coincidentCats: pt.coincidentCats.length > 1 ? pt.coincidentCats : undefined,
                          coincidentItems: cItems.length > 1 ? cItems : undefined
                        });
                      };

                      return (
                        <circle
                          key={pIdx}
                          cx={pt.x}
                          cy={pt.y}
                          r={circleRadius}
                          fill={circleFill}
                          stroke={strokeColor}
                          strokeWidth={circleStrokeWidth}
                          style={{ cursor: 'pointer', pointerEvents: 'all' }}
                          data-cy="chart-point"
                          data-periodo={pt.periodo}
                          data-categoria={pt.categoria}
                          data-valor={pt.valor}
                          data-coincidente={pt.coincidentTotal > 1 ? 'true' : 'false'}
                          onMouseEnter={handlePointInteraction}
                          onMouseOver={handlePointInteraction}
                          onClick={handlePointInteraction}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip HTML Dinâmico (RNF0046) */}
            {tooltip && (
              <div
                className="analytics-tooltip"
                data-cy="analytics-tooltip"
                style={{
                  position: 'absolute',
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 12}px`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="tooltip-cat" style={{ color: tooltip.color || getCategoryColor(tooltip.category, 0) }}>
                  {tooltip.category}
                </div>
                <div className="tooltip-value">
                  {formatCurrency(tooltip.value)}
                </div>
                <div className="tooltip-month">{tooltip.month}</div>
                {tooltip.isPartial && (
                  <div className="tooltip-partial-badge" data-cy="tooltip-partial-badge">
                    * Período Parcial
                  </div>
                )}
                {tooltip.coincidentItems && tooltip.coincidentItems.length > 1 ? (
                  <div className="tooltip-coincident-badge" data-cy="tooltip-coincident-badge">
                    <div className="tooltip-coincident-header">
                      Coincide com:
                    </div>
                    <div className="tooltip-coincident-list" data-cy="tooltip-coincident-list">
                      {tooltip.coincidentItems.map((item) => (
                        <div
                          key={item.categoria}
                          className={`tooltip-coincident-item ${item.categoria === tooltip.category ? 'active' : ''}`}
                          data-cy={`tooltip-item-${item.categoria}`}
                        >
                          <span
                            className="tooltip-coincident-dot"
                            style={{ backgroundColor: item.cor }}
                          />
                          <span className="tooltip-item-cat">{item.categoria}:</span>
                          <span className="tooltip-item-val">{formatCurrency(item.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  tooltip.coincidentCats && tooltip.coincidentCats.length > 1 && (
                    <div className="tooltip-coincident-badge" data-cy="tooltip-coincident-badge">
                      Coincide com: {tooltip.coincidentCats.filter(c => c !== tooltip.category).join(', ')}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Legenda das Categorias Posicionada Abaixo do Gráfico (RNF0045) */}
            <div className="analytics-legend-container" data-cy="analytics-legend">
              {series.map((s, idx) => (
                <div key={s.categoria} className="legend-item" data-cy={`legend-${s.categoria}`}>
                  <span
                    className="legend-color-dot"
                    style={{ backgroundColor: getCategoryColor(s.categoria, idx) }}
                  />
                  <span className="legend-name">{s.categoria}:</span>
                  <span className="legend-subtotal">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>

            {/* Aviso de Competência Parcial (ACH-01) */}
            {periodos.some(p => verificarParcialidadeCompetencia(p, appliedFilters).isParcial) && (
              <div className="analytics-partial-notice" data-cy="aviso-periodo-parcial">
                * Competência parcial: o faturamento contabiliza apenas os pedidos entregues nas datas selecionadas pelo administrador.
              </div>
            )}
          </div>

          {/* Card de Sumário Financeiro Geral (Totalizador Consolidado) */}
          <div className="analytics-summary-card" data-cy="analytics-summary">
            <span className="summary-title-small">Volume Financeiro no Período:</span>
            <div className="summary-value-big" data-cy="total-geral-vendas">
              {formatCurrency(analiseData.totalGeral)}
            </div>

            <p className="summary-desc-small" style={{ marginTop: '1rem' }}>
              Competência abrangida: <strong>{formatMonthLabel(analiseData.periodoInicial)}</strong> a <strong>{formatMonthLabel(analiseData.periodoFinal)}</strong>.
            </p>
            {appliedFilters && (
              <p className="summary-desc-small" style={{ marginTop: '0.4rem', color: '#999', fontSize: '0.75rem' }}>
                Período aplicado: <strong>{formatDisplayDate(appliedFilters.startDate)}</strong> a <strong>{formatDisplayDate(appliedFilters.endDate)}</strong>.
              </p>
            )}
            {periodos.some(p => verificarParcialidadeCompetencia(p, appliedFilters).isParcial) && (
              <div className="summary-partial-tag" data-cy="tag-competencia-parcial" style={{ color: '#ffbe0b', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                ⚠ Competência inicial/final parcial
              </div>
            )}

            <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid #1f1f1f', fontSize: '0.75rem', color: '#888' }}>
              Total de meses: <strong>{periodos.length}</strong><br />
              Categorias exibidas: <strong>{series.length}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
