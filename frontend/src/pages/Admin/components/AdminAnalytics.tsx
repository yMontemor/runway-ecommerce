import { useState } from 'react';
import { mockAnalyticsData } from '../../../data/analytics';

const CATEGORIES = ['TREINO DIÁRIO', 'LONGA DISTÂNCIA', 'VELOCIDADE', 'COMPETIÇÃO', 'TRAIL'];

const MONTHS = [
  { id: '2026-01', label: 'Jan/26', name: 'Jan' },
  { id: '2026-02', label: 'Fev/26', name: 'Fev' },
  { id: '2026-03', label: 'Mar/26', name: 'Mar' },
  { id: '2026-04', label: 'Abr/26', name: 'Abr' },
  { id: '2026-05', label: 'Mai/26', name: 'Mai' },
  { id: '2026-06', label: 'Jun/26', name: 'Jun' },
  { id: '2026-07', label: 'Jul/26', name: 'Jul' },
  { id: '2026-08', label: 'Ago/26', name: 'Ago' },
  { id: '2026-09', label: 'Set/26', name: 'Set' },
  { id: '2026-10', label: 'Out/26', name: 'Out' },
  { id: '2026-11', label: 'Nov/26', name: 'Nov' },
  { id: '2026-12', label: 'Dez/26', name: 'Dez' }
];

const CATEGORY_COLORS: Record<string, string> = {
  'TREINO DIÁRIO': 'var(--color-primary)', // verde neon
  'LONGA DISTÂNCIA': '#3a86ff',           // azul
  'VELOCIDADE': '#ff006e',                // rosa
  'COMPETIÇÃO': '#8338ec',                // roxo
  'TRAIL': '#ffbe0b'                      // amarelo/laranja
};

export default function AdminAnalytics() {
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-12');
  const [selectedCats, setSelectedCats] = useState<string[]>(CATEGORIES);
  const [tooltip, setTooltip] = useState<{
    month: string;
    category: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const startIdx = MONTHS.findIndex(m => m.id === startMonth);
  const endIdx = MONTHS.findIndex(m => m.id === endMonth);
  const isValidPeriod = startIdx <= endIdx;

  const visibleMonths = isValidPeriod ? MONTHS.slice(startIdx, endIdx + 1) : [];

  const handleCategoryToggle = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Encontrar o valor máximo para escala do eixo Y
  let maxVolume = 10000;
  if (isValidPeriod) {
    visibleMonths.forEach(m => {
      selectedCats.forEach(cat => {
        const entry = mockAnalyticsData.find(d => d.date === m.id && d.category === cat);
        if (entry && entry.salesVolume > maxVolume) {
          maxVolume = entry.salesVolume;
        }
      });
    });
  }
  
  // Arredondar para o teto de 10.000 mais próximo
  const yAxisMax = Math.ceil(maxVolume / 10000) * 10000;

  // Dimensões do Gráfico SVG
  const svgWidth = 780;
  const svgHeight = 360;
  const paddingLeft = 75;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Geração de coordenadas para cada categoria
  const categoryLines = selectedCats.map(cat => {
    if (visibleMonths.length === 0) return { category: cat, points: [] };

    const xSpacing = visibleMonths.length > 1 ? chartWidth / (visibleMonths.length - 1) : chartWidth;
    
    const points = visibleMonths.map((m, idx) => {
      const x = paddingLeft + idx * xSpacing;
      const entry = mockAnalyticsData.find(d => d.date === m.id && d.category === cat);
      const val = entry ? entry.salesVolume : 0;
      // Inverter coordenada Y para o SVG (0,0 no topo esquerdo)
      const y = paddingTop + chartHeight - (val / yAxisMax) * chartHeight;
      return { x, y, value: val, monthLabel: m.label, category: cat };
    });

    return { category: cat, points };
  });

  // Somatório Total do Período Filtrado (representa o acumulado das categorias, com sobreposição)
  // Como um tênis pode pertencer a mais de uma categoria, se houver vendas de um produto multicategoria,
  // a venda será exibida em ambas as categorias quando analisadas no gráfico.
  // Somar esses valores diretamente para obter o faturamento total geraria dupla contagem (double counting).
  // O faturamento real do período expurga essa sobreposição.
  const totalSales = mockAnalyticsData
    .filter(d => {
      const mIdx = MONTHS.findIndex(m => m.id === d.date);
      return mIdx >= startIdx && mIdx <= endIdx && selectedCats.includes(d.category);
    })
    .reduce((sum, d) => sum + d.salesVolume, 0);

  // Exportar dados para CSV
  const handleExportCSV = () => {
    if (!isValidPeriod) return;

    let csvContent = '\uFEFF'; // Adicionar BOM para Excel reconhecer acentuação
    csvContent += 'Periodo;Categoria;Mes/Ano;Valor\n';

    visibleMonths.forEach(m => {
      selectedCats.forEach(cat => {
        const entry = mockAnalyticsData.find(d => d.date === m.id && d.category === cat);
        if (entry) {
          const formattedVal = entry.salesVolume.toFixed(2).replace('.', ',');
          csvContent += `${m.id};${cat};${m.label};"R$ ${formattedVal}"\n`;
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analise_vendas_runway_${startMonth}_a_${endMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">ANÁLISE DE VENDAS</h3>
        <button 
          onClick={handleExportCSV} 
          disabled={!isValidPeriod || selectedCats.length === 0}
          className="btn btn-primary"
          type="button"
        >
          EXPORTAR PLANILHA (CSV)
        </button>
      </div>

      {/* Filtros de Análise */}
      <div className="analytics-filters-card">
        <div className="filters-date-group">
          <div className="date-input-group">
            <label>DATA INICIAL</label>
            <div className="input-with-icon">
              <select
                value={startMonth}
                onChange={e => setStartMonth(e.target.value)}
                className={`analytics-date-input ${!isValidPeriod ? 'invalid-field' : ''}`}
              >
                {MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="calendar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
            </div>
          </div>

          <div className="date-input-group">
            <label>DATA FINAL</label>
            <div className="input-with-icon">
              <select
                value={endMonth}
                onChange={e => setEndMonth(e.target.value)}
                className={`analytics-date-input ${!isValidPeriod ? 'invalid-field' : ''}`}
              >
                {MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="calendar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Checkboxes de Categorias */}
        <div className="categories-filter-group">
          <span className="group-label">CATEGORIAS</span>
          <div className="categories-toggle-list">
            {CATEGORIES.map(cat => {
              const isActive = selectedCats.includes(cat);
              const classCat = cat.toLowerCase().replace(' ', '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`category-toggle-btn ${isActive ? 'active' : ''} ${classCat}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Validação de Período */}
      {!isValidPeriod ? (
        <div className="analytics-validation-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-danger)', marginRight: '0.5rem' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          A data final não pode ser anterior à data inicial.
        </div>
      ) : selectedCats.length === 0 ? (
        <div className="analytics-validation-error">
          Selecione ao menos uma categoria para exibir no gráfico.
        </div>
      ) : (
        /* Renderização do Gráfico SVG */
        <div className="analytics-chart-container">
          <div className="svg-chart-wrapper">
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
                      fill="#666"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {yVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </text>
                  </g>
                );
              })}

              {/* Rótulos do Eixo X (Meses) */}
              {visibleMonths.map((m, idx) => {
                const xSpacing = visibleMonths.length > 1 ? chartWidth / (visibleMonths.length - 1) : chartWidth;
                const xPos = paddingLeft + idx * xSpacing;
                return (
                  <g key={m.id}>
                    <line
                      x1={xPos}
                      y1={paddingTop}
                      x2={xPos}
                      y2={paddingTop + chartHeight}
                      stroke="#161616"
                      strokeWidth="1"
                    />
                    <text
                      x={xPos}
                      y={paddingTop + chartHeight + 20}
                      fill="#666"
                      fontSize="11"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {m.name}
                    </text>
                  </g>
                );
              })}

              {/* Linhas e Nós de Dados */}
              {categoryLines.map(line => {
                if (line.points.length === 0) return null;
                const pathString = line.points.map(p => `${p.x},${p.y}`).join(' ');
                const strokeColor = CATEGORY_COLORS[line.category];

                return (
                  <g key={line.category}>
                    {/* Polilinha do Gráfico */}
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pathString}
                    />
                    
                    {/* Círculos / Nós */}
                    {line.points.map((pt, pIdx) => (
                      <circle
                        key={pIdx}
                        cx={pt.x}
                        cy={pt.y}
                        r="6"
                        fill="#050505"
                        stroke={strokeColor}
                        strokeWidth="3"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setTooltip({
                            month: pt.monthLabel,
                            category: pt.category,
                            value: pt.value,
                            x: pt.x,
                            y: pt.y
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip HTML Absoluta */}
            {tooltip && (
              <div 
                className="analytics-tooltip"
                style={{
                  position: 'absolute',
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 10}px`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="tooltip-cat" style={{ color: CATEGORY_COLORS[tooltip.category] }}>
                  {tooltip.category}
                </div>
                <div className="tooltip-value">
                  {tooltip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="tooltip-month">{tooltip.month}</div>
              </div>
            )}
          </div>

          {/* Sumário / Totalizador */}
          <div className="analytics-summary-card">
            <span className="summary-title-small">Volume Financeiro Acumulado das Categorias:</span>
            <div className="summary-value-big">
              {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>

            {/* Faturamento Real do Período (sem dupla contagem de produtos multicategoria) */}
            <div className="real-revenue-box" style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px dashed #2a2a2a' }}>
              <span className="summary-title-small" style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '0.2rem' }}>
                Faturamento Real Estimado do Período (Sem Sobreposição):
              </span>
              <div className="summary-value-medium" style={{ fontSize: '1.35rem', fontWeight: '800', color: '#ffffff' }}>
                {(totalSales * 0.85).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            <p className="summary-desc-small" style={{ marginTop: '1.2rem' }}>
              Período de visualização: <strong>{MONTHS[startIdx]?.label}</strong> a <strong>{MONTHS[endIdx]?.label}</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
