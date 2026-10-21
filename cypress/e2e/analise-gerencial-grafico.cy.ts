/**
 * Suíte E2E: Filtros e Gráfico de Linhas da Análise Gerencial por Categoria (Cartão 05).
 * Requisitos: RF0055, RF0056, RF0057, RN0071, RN0072, RN0073, RNF0043, RNF0044, RNF0045, RNF0046.
 * 
 * Validações:
 * 1. Visualização do gráfico SVG integrado com os dados reais persistidos da massa do Cartão 02.
 * 2. Conferência dos valores financeiros oficiais do gabarito:
 *    - TREINO DIÁRIO: R$ 2.350,59
 *    - COMPETIÇÃO: R$ 5.499,50
 *    - TOTAL GERAL: R$ 7.850,09
 * 3. Validação de meses sem vendas representados com R$ 0,00 (RN0073).
 * 4. Validação da legenda de categorias posicionada abaixo do gráfico (RNF0045).
 * 5. Validação do tooltip interativo ao passar o mouse ou clicar sobre os pontos do gráfico (RNF0046).
 * 6. Validação dos filtros de período (RF0056, RN0072) com campos YYYY-MM-DD e validação de 1 a 24 meses.
 * 7. Validação do filtro de categorias com seleção múltipla e botão explícito de consulta (RF0057).
 * 8. Consulta de período com apenas 1 mês (limite inferior da RN0072).
 */

describe('Cartão 05 — Filtros e Gráfico de Linhas por Categoria', () => {
  let adminKey = '';

  before(() => {
    // Obter credencial administrativa do processo Node (definida via ambiente RUNWAY_ADMIN_KEY)
    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'Variável de ambiente RUNWAY_ADMIN_KEY deve estar configurada').to.be.a('string').and.not.be.empty;
    });
  });

  beforeEach(() => {
    // Limpeza de sessão antes de cada teste
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  // Função auxiliar para desbloquear a análise no modo administrador
  const desbloquearModoAdmin = () => {
    cy.visit('/admin');
    cy.get('[data-cy="admin-analise"]').click();

    // Alternar para Administrador se estiver como Cliente
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="btn-alternar-admin"]').length > 0) {
        cy.get('[data-cy="btn-alternar-admin"]').click();
      }
    });

    // Aguardar o campo de chave administrativa estar visível e preencher
    cy.get('[data-cy="input-chave-admin"]').should('be.visible').type(adminKey);
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    // Confirmar que a barra de autenticação e os filtros estão presentes
    cy.get('[data-cy="admin-auth-status"]').should('be.visible');
    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
  };

  it('5.1 — Renderiza o gráfico SVG com dados reais da massa histórica e totais financeiros do gabarito oficial', () => {
    desbloquearModoAdmin();

    // Configurar o período histórico oficial da massa (2025-11-01 a 2026-03-31)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    // Garantir que as categorias TREINO DIÁRIO e COMPETIÇÃO estão selecionadas
    cy.get('[data-cy="btn-todas-categorias"]').click();

    // Disparar a consulta via botão explícito
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    // Aguardar renderização do painel do gráfico
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // Validação 1: Total Geral Acumulado Oficial = R$ 7.850,09
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '7.850,09');

    // Validação 2: Legenda das categorias posicionada abaixo do gráfico (RNF0045)
    cy.get('[data-cy="analytics-legend"]').should('be.visible');
    cy.get('[data-cy="legend-TREINO DIÁRIO"]')
      .should('be.visible')
      .and('contain.text', '2.350,59');
    cy.get('[data-cy="legend-COMPETIÇÃO"]')
      .should('be.visible')
      .and('contain.text', '5.499,50');

    // Validação 3: Existência das séries temporais no SVG (RNF0043)
    cy.get('[data-cy="serie-TREINO DIÁRIO"]').should('exist');
    cy.get('[data-cy="serie-COMPETIÇÃO"]').should('exist');
  });

  it('5.2 — Valida que meses sem vendas são apresentados com valor R$ 0,00 no gráfico (RN0073)', () => {
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-todas-categorias"]').click();
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // Em 2026-02: COMPETIÇÃO tem 0 vendas (RN0073)
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="COMPETIÇÃO"]')
      .should('exist')
      .and('have.attr', 'data-valor', '0');

    // Em 2026-03: TREINO DIÁRIO tem 0 vendas (RN0073)
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('exist')
      .and('have.attr', 'data-valor', '0');
  });

  it('5.3 — Tooltip exibe a categoria, o mês/ano e o valor financeiro exato ao interagir com os pontos (RNF0046)', () => {
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-todas-categorias"]').click();
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // Interagir com o ponto de pico de COMPETIÇÃO (2026-01: R$ 2.199,80)
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'COMPETIÇÃO')
      .and('contain.text', '2.199,80')
      .and('contain.text', 'Jan/26');

    // Interagir com o ponto com R$ 0,00 de TREINO DIÁRIO em Mar/26
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'TREINO DIÁRIO')
      .and('contain.text', '0,00')
      .and('contain.text', 'Mar/26');
  });

  it('5.4 — Filtro de categorias: permite filtrar exclusivamente uma categoria selecionada (RF0057)', () => {
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    // Limpar todas as categorias e certificar que foram desmarcadas
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('.category-toggle-btn.active').should('have.length', 0);

    // Selecionar apenas TREINO DIÁRIO
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').should('have.class', 'active');

    // Disparar a consulta com a categoria única
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // O total exibido deve ser apenas o subtotal oficial de TREINO DIÁRIO = R$ 2.350,59
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '2.350,59');

    // A série COMPETIÇÃO não deve estar presente no gráfico
    cy.get('[data-cy="serie-TREINO DIÁRIO"]').should('exist');
    cy.get('[data-cy="serie-COMPETIÇÃO"]').should('not.exist');
  });

  it('5.5 — Validação de período: rejeita data final anterior à inicial e período superior a 24 meses (RF0056, RN0072)', () => {
    desbloquearModoAdmin();

    // Tentativa 1: Data final anterior à inicial
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-05-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-01-01');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', 'A data final não pode ser anterior à data inicial');

    // Tentativa 2: Período com mais de 24 meses (ex: 2024-01-01 a 2026-06-01 = 30 meses)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2024-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-06-01');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', '24 meses');

    // Tentativa 3: Nenhuma categoria selecionada
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-01');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', 'ao menos uma categoria');
  });

  it('5.6 — Limite mínimo de 1 mês: renderiza corretamente período de mês único (RN0072)', () => {
    desbloquearModoAdmin();

    // Consulta de 1 único mês (2026-01-01 a 2026-01-31)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-01-31');
    cy.get('[data-cy="btn-todas-categorias"]').click();
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // Total de Janeiro/2026: TREINO DIÁRIO (550,99) + COMPETIÇÃO (2.199,80) = 2.750,79
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '2.750,79');

    // Gráfico de 1 mês deve renderizar os pontos centralizados sem erros de NaN
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="TREINO DIÁRIO"]')
      .should('exist');
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .should('exist');
  });
});
