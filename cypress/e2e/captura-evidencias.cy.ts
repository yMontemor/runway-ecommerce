/**
 * Utilitário Isolado de Captura de Evidências Visuais Reais — Cartão 09
 * RunWay E-Commerce — LES (Entrega 10/11/2026)
 * 
 * Executa os fluxos reais contra backend e banco runway_test,
 * capturando as 6 evidências em alta fidelidade solicitadas no Cartão 09.
 */

describe('Cartão 09 — Captura de Evidências Reais da Análise Gerencial', () => {
  const backendBaseUrl = 'http://localhost:5035';
  let adminKey = '';

  before(() => {
    cy.task('confirmarBancoSeguro').then((res: any) => {
      expect(res.banco).to.eq('runway_test');
      expect(res.seguro).to.be.true;
    });

    cy.task('prepararMassaAnalise');

    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'RUNWAY_ADMIN_KEY deve estar configurada').to.be.a('string').and.not.be.empty;
    });
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
    cy.visit('/admin');
    cy.get('[data-cy="admin-analise"]').click();

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="btn-alternar-admin"]').length > 0) {
        cy.get('[data-cy="btn-alternar-admin"]').click();
      }
    });

    cy.get('[data-cy="input-chave-admin"]').should('be.visible').type(adminKey, { log: false });
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    cy.get('[data-cy="admin-auth-status"]').should('be.visible');
    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
  };

  it('Captura 01 e 02: Bloqueio do Perfil Cliente e Formulário de Desbloqueio Administrativo', () => {
    cy.visit('/admin');
    cy.get('[data-cy="admin-analise"]').click();

    // Se estiver em Administrador, alternar para Cliente
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="btn-alternar-admin"]').length === 0 && $body.find('[data-cy="admin-auth-status"]').length > 0) {
        cy.get('[data-cy="btn-bloquear-sessao"]').click();
      }
    });

    // 01: Captura da barreira de acesso do perfil Cliente
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="analise-acesso-bloqueado-cliente"]').length > 0) {
        cy.get('[data-cy="analise-acesso-bloqueado-cliente"]').should('be.visible');
        cy.screenshot('01-bloqueio-perfil-cliente', { capture: 'viewport' });

        // Alternar para perfil Administrador
        cy.get('[data-cy="btn-alternar-admin"]').click();
      }
    });

    // 02: Captura do prompt de chave administrativa sob demanda (com campo limpo)
    cy.get('[data-cy="analise-prompt-chave"]').should('be.visible');
    cy.get('[data-cy="input-chave-admin"]').should('be.visible').and('have.value', '');
    cy.screenshot('02-desbloqueio-chave-admin', { capture: 'viewport' });
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
});
