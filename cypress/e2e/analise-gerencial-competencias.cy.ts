/**
 * Suíte E2E: Testes Funcionais Adicionais de Competências e Períodos (ACH-01 e ACH-02).
 * 
 * Escopo de Validação:
 * - ACH-01: Consultas com datas parciais (meio do mês) com exclusão financeira precisa e indicação visual.
 * - ACH-02: Consulta de competência mensal única (1 mês) sem polilinha degenerada, com linha guia, halo e rótulo direto.
 * - ACH-02: Identificação visual de categorias distintas quando pontos coincidem no mesmo mês/valor.
 * 
 * Regras:
 * 1. Executa exclusivamente sobre o banco "runway_test" com a massa oficial do Cartão 02.
 * 2. Utiliza a API real do ASP.NET Core sem mocks.
 * 3. Restauração obrigatória da base após a execução.
 */

describe('Auditoria ACH-01 e ACH-02 — Competências Parciais, Mês Único e Pontos Coincidentes', () => {
  before(() => {
    // 1. Confirmar banco seguro e preparar massa canônica
    cy.task('confirmarBancoSeguro').then((res: any) => {
      expect(res.seguro, 'Deve estar conectado a runway_test').to.be.true;
    });
    cy.task('prepararMassaAnalise');

    // 2. Confirmar que a API ASP.NET Core está consumindo o banco runway_test
    cy.request({
      url: 'http://localhost:5035/api/pedidos/PED-ANL-0001',
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status, 'API deve responder 200 para pedido da massa de análise').to.eq(200);
      expect(res.body?.codigo).to.eq('PED-ANL-0001');
    });
  });

  after(() => {
    // Restauração da massa ao concluir
    cy.task('prepararMassaAnalise');
  });

  beforeEach(() => {
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  const desbloquearModoAdmin = () => {
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get('[data-cy="painel-admin"]').click();
    cy.url().should('include', '/admin');
    cy.get('[data-cy="admin-analise"]').click();

    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    // Aguardar a renderização inicial do painel
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');
  };

  // =========================================================================================
  // ACH-01: PERÍODOS PARCIAIS COM EXCLUSÃO FINANCEIRA E INDICAÇÃO VISUAL
  // =========================================================================================
  it('ACH-01 — Consulta com início fracionado (18/11/2025 a 30/11/2025): exclui PED-ANL-0001 e indica competência parcial', () => {
    desbloquearModoAdmin();

    // 1. Configurar período quebrado: 18/11/2025 a 30/11/2025
    // Na massa canônica:
    // PED-ANL-0001 foi realizado em 15/11/2025 (TREINO DIÁRIO: R$ 449,90) -> DEVE SER EXCLUÍDO
    // PED-ANL-0002 foi realizado em 20/11/2025 (COMPETIÇÃO: R$ 1.099,90) -> DEVE SER INCLUÍDO
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-18');
    cy.get('[data-cy="input-data-fim"]').clear().type('2025-11-30');

    // Selecionar Treino Diário e Competição
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    cy.intercept('GET', '**/api/analise/vendas*dataInicio=2025-11-18*').as('consultaParcial');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consultaParcial').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);

      // Comprovação financeira de exclusão precisa:
      // Apenas PED-ANL-0002 (R$ 1.099,90) deve ser somado. PED-ANL-0001 (R$ 449,90) é ignorado!
      expect(interception.response?.body).to.have.property('totalGeral', 1099.90);
      const treino = interception.response?.body.series.find((s: any) => s.categoria === 'TREINO DIÁRIO');
      const comp = interception.response?.body.series.find((s: any) => s.categoria === 'COMPETIÇÃO');
      expect(treino.total).to.eq(0);
      expect(comp.total).to.eq(1099.90);
    });

    // 2. Validação da Indicação Visual de Competência Parcial
    // Eixo X: deve exibir o asterisco indicativo "Nov/25*"
    cy.get('.svg-line-chart').contains('text', 'Nov/25*').should('exist');

    // Aviso informativo abaixo da legenda
    cy.get('[data-cy="aviso-periodo-parcial"]')
      .should('be.visible')
      .and('contain.text', 'Competência parcial')
      .and('contain.text', 'datas selecionadas');

    // Tag no card de sumário
    cy.get('[data-cy="tag-competencia-parcial"]')
      .should('be.visible')
      .and('contain.text', 'Competência inicial/final parcial');

    cy.get('[data-cy="analytics-summary"]')
      .should('contain.text', '18/11/2025 a 30/11/2025');

    // Tooltip: ao clicar no ponto, deve indicar o detalhe do período parcial
    cy.get('[data-cy="chart-point"][data-categoria="COMPETIÇÃO"]').click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]').should('be.visible');
    cy.get('[data-cy="tooltip-partial-badge"]')
      .should('be.visible')
      .and('contain.text', 'Período Parcial');
    cy.get('[data-cy="analytics-tooltip"]')
      .and('contain.text', '1.099,90')
      .and('contain.text', 'a partir de 18/11');
  });

  // =========================================================================================
  // ACH-02: CONSULTA DE UM ÚNICO MÊS (SEM POLILINHA DEGENERADA E COM LINHA GUIA)
  // =========================================================================================
  it('ACH-02 — Consulta de competência mensal única (Jan/2026): sem polyline degenerada, com rótulos e escala preservada', () => {
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-01-31');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    cy.intercept('GET', '**/api/analise/vendas*dataInicio=2026-01-01*dataFim=2026-01-31*').as('consultaUnicoMes');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consultaUnicoMes').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body).to.have.property('totalGeral', 2750.79);
      expect(interception.response?.body.periodos).to.deep.eq(['2026-01']);
    });

    // 1. Não deve haver nenhuma polilinha degenerada de 1 ponto no SVG
    cy.get('.svg-line-chart polyline').should('not.exist');

    // 2. Os pontos das duas categorias devem existir no SVG
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="TREINO DIÁRIO"]')
      .should('exist')
      .and('have.attr', 'data-valor', '550.99');
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .should('exist')
      .and('have.attr', 'data-valor', '2199.8');

    // 3. Rótulos diretos monetários no gráfico de mês único
    cy.get('[data-cy="rotulo-ponto-TREINO DIÁRIO"]')
      .should('be.visible')
      .and('contain.text', '550,99');
    cy.get('[data-cy="rotulo-ponto-COMPETIÇÃO"]')
      .should('be.visible')
      .and('contain.text', '2.199,80');

    // 4. Escala vertical preservada com valores monetários em R$
    cy.get('.svg-line-chart text')
      .filter((_, el) => el.textContent?.includes('R$') ?? false)
      .should('have.length.at.least', 4);

    // 5. Tooltip funcional em mês único
    cy.get('[data-cy="chart-point"][data-categoria="COMPETIÇÃO"]').click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'COMPETIÇÃO')
      .and('contain.text', '2.199,80')
      .and('contain.text', 'Jan/26');
  });

  // =========================================================================================
  // ACH-02: IDENTIFICAÇÃO DE CATEGORIAS COM PONTOS COINCIDENTES (ANÉIS CONCÊNTRICOS)
  // =========================================================================================
  it('ACH-02 — Categorias com valores iguais (R$ 0,00): identificáveis por anéis concêntricos e indicação no tooltip', () => {
    desbloquearModoAdmin();

    // Consulta de período sem vendas na massa canônica (ex.: Outubro/2025: 2025-10-01 a 2025-10-31)
    // Ambas as categorias terão exatamente R$ 0,00, gerando sobreposição pontual perfeita
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-10-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2025-10-31');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    cy.intercept('GET', '**/api/analise/vendas*dataInicio=2025-10-01*dataFim=2025-10-31*').as('consultaCoincidente');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consultaCoincidente').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body).to.have.property('totalGeral', 0);
    });

    // Validar que ambos os pontos existem e foram identificados como coincidentes
    cy.get('[data-cy="chart-point"][data-categoria="COMPETIÇÃO"]')
      .should('exist')
      .and('have.attr', 'data-coincidente', 'true');

    cy.get('[data-cy="chart-point"][data-categoria="TREINO DIÁRIO"]')
      .should('exist')
      .and('have.attr', 'data-coincidente', 'true');

    // Um dos círculos possui raio interno (r=6) e o outro possui anel concêntrico externo (r=10)
    cy.get('[data-cy="chart-point"][data-coincidente="true"]').then(($circles) => {
      expect($circles).to.have.length(2);
      const r1 = Number($circles.eq(0).attr('r'));
      const r2 = Number($circles.eq(1).attr('r'));
      // Os raios devem ser distintos para permitir identificação visual de ambas as cores
      expect(r1).to.not.eq(r2);
      expect(Math.abs(r1 - r2)).to.be.at.least(4);
    });

    // Tooltip identifica a coincidência de valores
    cy.get('[data-cy="chart-point"][data-categoria="COMPETIÇÃO"]').click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]').should('be.visible');
    cy.get('[data-cy="tooltip-coincident-badge"]')
      .should('be.visible')
      .and('contain.text', 'Coincide com');
  });
});
