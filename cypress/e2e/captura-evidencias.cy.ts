/**
 * Utilitário Isolado de Captura de Evidências Visuais Reais — Cartão 09
 * RunWay E-Commerce — LES (Entrega 10/11/2026)
 * 
 * Executa os fluxos reais contra backend e banco runway_test,
 * capturando as 6 evidências em alta fidelidade solicitadas no Cartão 09.
 */

describe('Cartão 09 — Captura de Evidências Reais da Análise Gerencial', () => {
  const backendBaseUrl = 'http://localhost:5035';

  before(() => {
    cy.task('confirmarBancoSeguro').then((res: any) => {
      expect(res.banco).to.eq('runway_test');
      expect(res.seguro).to.be.true;
    });

    cy.task('prepararMassaAnalise');
  });

  after(() => {
    cy.task('prepararMassaAnalise');
    cy.task('validarIntegridadeMassaAposTeste').then((res: any) => {
      expect(res.restaurado).to.be.true;
      expect(res.statusPed8).to.eq('EM TRANSPORTE');
      expect(res.totalGeral).to.eq(7850.09);
    });
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
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
  };

  it('Captura 01 e 02: Barreira de Acesso do Perfil Cliente na rota /admin e Painel Administrativo com 4 Seções', () => {
    // 01: Captura da barreira de acesso do perfil Cliente ao tentar navegar para /admin
    cy.visit('/admin');
    cy.get('[data-cy="admin-acesso-restrito-cliente"]').should('be.visible');
    cy.screenshot('01-bloqueio-perfil-cliente', { capture: 'viewport' });

    // Alternar para modo Administrador explicitamente
    cy.get('[data-cy="btn-ativar-admin-explicitamente"]').click();
    cy.url().should('include', '/admin');
    cy.get('[data-cy="admin-clientes"]').should('be.visible');
    cy.get('[data-cy="admin-pedidos"]').should('be.visible');
    cy.get('[data-cy="admin-trocas"]').should('be.visible');
    cy.get('[data-cy="admin-analise"]').should('be.visible');

    // 02: Captura das quatro seções do painel administrativo
    cy.screenshot('02-painel-administrativo-secoes', { capture: 'viewport' });
  });

  it('Captura 03, 04, 05 e 06: Gráfico Inicial, Tooltip, Meses Zerados e Atualização Pós-Entrega', () => {
    desbloquearModoAdmin();

    // 1. Configurar período canônico (2025-11-01 a 2026-03-31)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    // 2. Selecionar exclusivamente TREINO DIÁRIO e COMPETIÇÃO
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click().should('have.class', 'active');
    cy.get('[data-cy="toggle-cat-competicao"]').click().should('have.class', 'active');

    cy.intercept('GET', '**/api/analise/vendas*').as('consultaInicial');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();
    cy.wait('@consultaInicial').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body.totalGeral).to.eq(7850.09);
    });

    // 03: Gráfico completo inicial (Total R$ 7.850,09)
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '7.850,09');
    cy.screenshot('03-grafico-completo-inicial', { capture: 'viewport' });

    // 04: Tooltip Interativo — Pico de Competição em Jan/2026 (R$ 2.199,80)
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .should('exist')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'COMPETIÇÃO')
      .and('contain.text', 'Jan/26')
      .and('contain.text', '2.199,80');
    cy.screenshot('04-tooltip-pico-janeiro', { capture: 'viewport' });

    // 05: Meses Zerados (RN0073) — Treino Diário em Mar/2026 (R$ 0,00)
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('exist')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'TREINO DIÁRIO')
      .and('contain.text', 'Mar/26')
      .and('contain.text', '0,00');
    cy.screenshot('05-meses-zerados-rn0073', { capture: 'viewport' });

    // 06: Transição oficial de PED-ANL-0008 para ENTREGUE e atualização reativa
    cy.request({
      method: 'PATCH',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0008/status`,
      body: { novoStatus: 'ENTREGUE' }
    }).then((patchRes) => {
      expect(patchRes.status).to.eq(200);
    });

    // Reconsultar na interface SPA sem recarregar a página
    cy.intercept('GET', '**/api/analise/vendas*').as('consultaPosEntrega');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();
    cy.wait('@consultaPosEntrega').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body.totalGeral).to.eq(8299.99);
    });

    // Confirmar recálculo: Total Geral = R$ 8.299,99 e Treino Diário Mar/2026 = R$ 449,90
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '8.299,99');
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '449.9')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'TREINO DIÁRIO')
      .and('contain.text', 'Mar/26')
      .and('contain.text', '449,90');

    cy.screenshot('06-atualizacao-pos-entrega-pedido', { capture: 'viewport' });
  });

  it('07 e 08: Captura adicional — Consulta de 12 meses (Janeiro a Dezembro de 2026) com cinco categorias', () => {
    desbloquearModoAdmin();

    // 1. Configurar período de Janeiro a Dezembro de 2026
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-12-31');

    // 2. Selecionar todas as cinco categorias
    cy.get('[data-cy="btn-todas-categorias"]').click();

    cy.intercept('GET', '**/api/analise/vendas*dataInicio=2026-01-01*dataFim=2026-12-31*').as('consulta12Meses');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();
    cy.wait('@consulta12Meses');

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // 3. Capturar tela do gráfico completo de 12 meses com 5 categorias
    cy.screenshot('07-grafico-12-meses-5-categorias', { capture: 'viewport' });

    // 4. Interagir com um ponto de mês com categorias coincidentes zeradas (ex: 2026-06)
    cy.get('[data-cy="chart-point"][data-periodo="2026-06"]').first().click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]').should('be.visible');

    // 5. Capturar tela com tooltip de categorias coincidentes ativo
    cy.screenshot('08-tooltip-coincidentes-12-meses', { capture: 'viewport' });
  });
});
