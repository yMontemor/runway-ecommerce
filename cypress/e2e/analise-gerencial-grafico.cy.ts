/**
 * Suíte E2E: Testes Funcionais da Análise Gerencial por Categoria (Cartão 07).
 * Cenários Oficiais 1 a 4:
 * - Cenário 1: Seleção de uma única categoria (RF0055, RF0057)
 * - Cenário 2: Seleção de múltiplas categorias (RF0055, RF0057)
 * - Cenário 3: Exibição mensal, valores monetários, eixos, linhas, legenda e tooltip (RF0055, RN0071, RNF0043, RNF0044, RNF0045, RNF0046)
 * - Cenário 4: Alteração dinâmica do período da consulta e validações de intervalo (RF0056, RN0071, RN0072)
 * 
 * Regras Obrigatórias:
 * 1. Opera exclusivamente no banco PostgreSQL "runway_test" com a massa oficial do Cartão 02.
 * 2. Utiliza cy.intercept() exclusivamente como observador/espião das requisições reais à API (SEM mocks).
 * 3. Validação dos gabaritos financeiros oficiais e correspondência estrita entre API e interface.
 * 4. Independência e idempotência dos testes: preparação e restauração via cy.task().
 */

describe('Cartão 07 — Testes Funcionais da Análise Gerencial (Cenários 1 a 4)', () => {
  let adminKey = '';

  before(() => {
    // 1. Garantir preparação inicial da massa de testes determinística do Cartão 02
    cy.task('prepararMassaAnalise');

    // 2. Obter credencial administrativa exclusivamente de variável de ambiente (sem valores fixos no código)
    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'Variável de ambiente RUNWAY_ADMIN_KEY deve estar configurada no ambiente').to.be.a('string').and.not.be.empty;
    });
  });

  after(() => {
    // Restauração obrigatória da massa determinística do Cartão 02 ao concluir a suíte
    cy.task('prepararMassaAnalise');
  });

  beforeEach(() => {
    // Limpeza rigorosa de sessão antes de cada teste
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  /**
   * Procedimento reutilizável para autenticar o modo Administrador e acessar o módulo de Análise
   */
  const desbloquearModoAdmin = () => {
    cy.visit('/admin');
    cy.get('[data-cy="admin-analise"]').click();

    // Alternar para Administrador se estiver como Cliente
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="btn-alternar-admin"]').length > 0) {
        cy.get('[data-cy="btn-alternar-admin"]').click();
      }
    });

    // Informar a credencial administrativa com { log: false } para não expor segredo em logs
    cy.get('[data-cy="input-chave-admin"]').should('be.visible').type(adminKey, { log: false });
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    // Confirmar que o painel e os filtros estão prontos
    cy.get('[data-cy="admin-auth-status"]').should('be.visible');
    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
  };

  // =========================================================================================
  // CENÁRIO 1 — SELEÇÃO DE UMA ÚNICA CATEGORIA (RF0055, RF0057)
  // =========================================================================================
  it('Cenário 1 — Seleção de uma única categoria (Treino Diário) com validação de API real, legenda e faturamento', () => {
    desbloquearModoAdmin();

    // 1. Configurar período histórico oficial (2025-11-01 a 2026-03-31)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    // 2. Limpar todas as categorias e selecionar exclusivamente TREINO DIÁRIO
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('.category-toggle-btn.active').should('have.length', 0);

    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').should('have.class', 'active');
    cy.get('.category-toggle-btn.active').should('have.length', 1);

    // 3. Registrar cy.intercept() exclusivamente como espião da chamada real (sem mocks)
    cy.intercept('GET', '**/api/analise/vendas*').as('consultaCategoriaUnica');

    // 4. Acionar a consulta
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    // 5. Validar requisição real à API
    cy.wait('@consultaCategoriaUnica').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);

      const url = decodeURIComponent(interception.request.url).replace(/\+/g, ' ');
      expect(url).to.include('dataInicio=2025-11-01');
      expect(url).to.include('dataFim=2026-03-31');
      expect(url).to.include('categorias=TREINO DIÁRIO');
      expect(url).to.not.include('COMPETIÇÃO');

      // Conferir dados retornados pela API real
      expect(interception.response?.body).to.have.property('totalGeral', 2350.59);
      expect(interception.response?.body.series).to.have.length(1);
      expect(interception.response?.body.series[0].categoria).to.eq('TREINO DIÁRIO');
      expect(interception.response?.body.series[0].total).to.eq(2350.59);
    });

    // 6. Validar apresentação visual no SVG: somente a série TREINO DIÁRIO deve estar presente
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');
    cy.get('[data-cy="serie-TREINO DIÁRIO"]').should('exist');
    cy.get('[data-cy="serie-TREINO DIÁRIO"] polyline').should('exist').and('have.attr', 'points').and('not.be.empty');
    cy.get('[data-cy="serie-COMPETIÇÃO"]').should('not.exist');

    // 7. Validar legenda: corresponde estritamente à categoria selecionada com subtotal
    cy.get('[data-cy="analytics-legend"]').should('be.visible');
    cy.get('[data-cy="legend-TREINO DIÁRIO"]').should('be.visible').and('contain.text', '2.350,59');
    cy.get('[data-cy="legend-COMPETIÇÃO"]').should('not.exist');

    // 8. Validar faturamento exibido no card de sumário: R$ 2.350,59
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '2.350,59');
  });

  // =========================================================================================
  // CENÁRIO 2 — SELEÇÃO DE MÚLTIPLAS CATEGORIAS (RF0055, RF0057)
  // =========================================================================================
  it('Cenário 2 — Seleção de múltiplas categorias (Treino Diário e Competição) com identificação visual distinta e subtotais', () => {
    desbloquearModoAdmin();

    // 1. Configurar período de 5 meses (2025-11-01 a 2026-03-31)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    // 2. Selecionar simultaneamente TREINO DIÁRIO e COMPETIÇÃO (garantindo que nenhuma outra esteja ativa)
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click().should('have.class', 'active');
    cy.get('[data-cy="toggle-cat-competicao"]').click().should('have.class', 'active');
    cy.get('.category-toggle-btn.active').should('have.length', 2);

    // 3. Espionar chamada real à API
    cy.intercept('GET', '**/api/analise/vendas*').as('consultaMultiplasCategorias');

    // 4. Acionar a consulta
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    // 5. Validar resposta real da API
    cy.wait('@consultaMultiplasCategorias').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);

      const url = decodeURIComponent(interception.request.url).replace(/\+/g, ' ');
      expect(url).to.include('categorias=TREINO DIÁRIO');
      expect(url).to.include('categorias=COMPETIÇÃO');

      expect(interception.response?.body).to.have.property('totalGeral', 7850.09);
      expect(interception.response?.body.series).to.have.length(2);

      const treinoSerie = interception.response?.body.series.find((s: any) => s.categoria === 'TREINO DIÁRIO');
      const compSerie = interception.response?.body.series.find((s: any) => s.categoria === 'COMPETIÇÃO');
      expect(treinoSerie, 'Série Treino Diário deve existir').to.exist;
      expect(treinoSerie.total).to.eq(2350.59);
      expect(compSerie, 'Série Competição deve existir').to.exist;
      expect(compSerie.total).to.eq(5499.50);
    });

    // 6. Validar que ambas as séries aparecem no gráfico com identificação visual distinta (strokes diferentes)
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');
    cy.get('[data-cy="serie-TREINO DIÁRIO"]').should('exist');
    cy.get('[data-cy="serie-COMPETIÇÃO"]').should('exist');

    cy.get('[data-cy="serie-TREINO DIÁRIO"] polyline').invoke('attr', 'stroke').then((strokeTreino) => {
      cy.get('[data-cy="serie-COMPETIÇÃO"] polyline').invoke('attr', 'stroke').then((strokeComp) => {
        expect(strokeTreino, 'Polilinhas devem possuir identificação de cor visualmente distinta').to.not.eq(strokeComp);
      });
    });

    // 7. Validar legenda com as duas categorias e subtotais oficiais
    cy.get('[data-cy="analytics-legend"]').should('be.visible');
    cy.get('[data-cy="legend-TREINO DIÁRIO"]')
      .should('be.visible')
      .and('contain.text', '2.350,59');
    cy.get('[data-cy="legend-COMPETIÇÃO"]')
      .should('be.visible')
      .and('contain.text', '5.499,50');

    // 8. Validar Total Geral consolidado no sumário = R$ 7.850,09
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '7.850,09');

    // 9. Validar que nenhuma categoria não selecionada aparece indevidamente
    cy.get('[data-cy="serie-LONGA DISTÂNCIA"]').should('not.exist');
    cy.get('[data-cy="serie-VELOCIDADE"]').should('not.exist');
    cy.get('[data-cy="serie-TRAIL"]').should('not.exist');
    cy.get('[data-cy="legend-LONGA DISTÂNCIA"]').should('not.exist');
  });

  // =========================================================================================
  // CENÁRIO 3 — EXIBIÇÃO MENSAL, VALORES MONETÁRIOS, EIXOS, LINHAS, LEGENDA E TOOLTIP
  // =========================================================================================
  it('Cenário 3 — Exibição mensal das cinco competências, matriz dos dez valores do gabarito, eixos X/Y, legenda e tooltip', () => {
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    cy.intercept('GET', '**/api/analise/vendas*').as('consultaCenario3');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();
    cy.wait('@consultaCenario3').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body).to.have.property('totalGeral', 7850.09);
      expect(interception.response?.body.periodos).to.deep.eq(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    });

    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // 1. Eixo horizontal X: validar a representação das cinco competências mensais
    const mesesEsperados = ['Nov/25', 'Dez/25', 'Jan/26', 'Fev/26', 'Mar/26'];
    mesesEsperados.forEach((mes) => {
      cy.get('.svg-line-chart').contains('text', mes).should('exist');
    });

    // 2. Eixo vertical Y: validar apresentação de valores monetários com símbolo R$
    cy.get('.svg-line-chart text')
      .filter((_, el) => el.textContent?.includes('R$') ?? false)
      .should('have.length.at.least', 4);

    // 3. Validar linhas contínuas (polyline) conectando os nós para cada série (RNF0043)
    cy.get('[data-cy="serie-TREINO DIÁRIO"] polyline')
      .should('exist')
      .and('have.attr', 'points')
      .and('not.be.empty');
    cy.get('[data-cy="serie-COMPETIÇÃO"] polyline')
      .should('exist')
      .and('have.attr', 'points')
      .and('not.be.empty');

    // 4. Conferência rigorosa dos 10 pontos mensais da matriz oficial do gabarito:
    // 2025-11: Treino R$ 449,90 | Competição R$ 1.099,90
    cy.get('[data-cy="chart-point"][data-periodo="2025-11"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '449.9');
    cy.get('[data-cy="chart-point"][data-periodo="2025-11"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '1099.9');

    // 2025-12: Treino R$ 899,80 | Competição R$ 1.099,90
    cy.get('[data-cy="chart-point"][data-periodo="2025-12"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '899.8');
    cy.get('[data-cy="chart-point"][data-periodo="2025-12"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '1099.9');

    // 2026-01: Treino R$ 550,99 | Competição R$ 2.199,80
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '550.99');
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '2199.8');

    // 2026-02: Treino R$ 449,90 | Competição R$ 0,00 (mês sem vendas - RN0073)
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '449.9');
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '0');

    // 2026-03: Treino R$ 0,00 (mês sem vendas - RN0073) | Competição R$ 1.099,90
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '0');
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '1099.9');

    // 5. Validar que a legenda fica posicionada abaixo do gráfico (RNF0045)
    cy.get('.svg-chart-wrapper').within(() => {
      cy.get('.svg-line-chart').should('exist');
      cy.get('[data-cy="analytics-legend"]').should('exist');
    });

    // 6. Validar Tooltip com categoria, mês/ano e valor financeiro exato (RNF0046)
    // Teste 6.1: Pico de Competição em Jan/26 (R$ 2.199,80)
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'COMPETIÇÃO')
      .and('contain.text', 'Jan/26')
      .and('contain.text', '2.199,80');

    // Teste 6.2: Mês com zero de Treino Diário em Mar/26 (R$ 0,00)
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'TREINO DIÁRIO')
      .and('contain.text', 'Mar/26')
      .and('contain.text', '0,00');

    // Teste 6.3: Mês com zero de Competição em Fev/26 (R$ 0,00)
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="COMPETIÇÃO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'COMPETIÇÃO')
      .and('contain.text', 'Fev/26')
      .and('contain.text', '0,00');
  });

  // =========================================================================================
  // CENÁRIO 4 — ALTERAÇÃO DINÂMICA DO PERÍODO DA CONSULTA E VALIDAÇÕES (RF0056, RN0071, RN0072)
  // =========================================================================================
  it('Cenário 4 — Alterações consecutivas de período sem recarregar página (SPA), recálculo pela API e validações', () => {
    desbloquearModoAdmin();

    // 1. Assegurar que as duas categorias da massa estão selecionadas
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    // 2. Garantir observador para validar que a página NÃO sofre reload durante as alterações (SPA)
    cy.window().then((win) => {
      win.addEventListener('beforeunload', () => {
        throw new Error('A página não deveria ter sido recarregada durante a alteração dos filtros!');
      });
    });

    // ---------------------------------------------------------------------------------------
    // Etapa 4.1: Consulta Inicial — Período Histórico Completo (5 meses)
    // ---------------------------------------------------------------------------------------
    cy.intercept('GET', '**/api/analise/vendas*').as('consulta41');
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consulta41').its('response.statusCode').should('eq', 200);
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '7.850,09');

    // ---------------------------------------------------------------------------------------
    // Etapa 4.2: Alteração Dinâmica para Janeiro/2026 (1 mês) -> R$ 2.750,79
    // ---------------------------------------------------------------------------------------
    cy.intercept('GET', '**/api/analise/vendas*').as('consulta42');
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-01-31');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consulta42').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(decodeURIComponent(interception.request.url)).to.include('dataInicio=2026-01-01');
      expect(decodeURIComponent(interception.request.url)).to.include('dataFim=2026-01-31');
      expect(interception.response?.body).to.have.property('totalGeral', 2750.79);
      expect(interception.response?.body.periodos).to.deep.eq(['2026-01']);
    });

    // Validar recálculo na interface (Janeiro/2026: 550,99 + 2199,80 = 2.750,79)
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '2.750,79');
    cy.get('.svg-line-chart').contains('text', 'Jan/26').should('exist');
    cy.get('.svg-line-chart').contains('text', 'Nov/25').should('not.exist');

    // Validar consistência dos inputs de filtro após consulta
    cy.get('[data-cy="input-data-inicio"]').should('have.value', '2026-01-01');
    cy.get('[data-cy="input-data-fim"]').should('have.value', '2026-01-31');

    // Validação do Limite Mínimo Válido de 1 Mês (RN0072): pontos renderizados sem erros
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="TREINO DIÁRIO"]').should('exist');
    cy.get('[data-cy="chart-point"][data-periodo="2026-01"][data-categoria="COMPETIÇÃO"]').should('exist');

    // ---------------------------------------------------------------------------------------
    // Etapa 4.3: Alteração Dinâmica para Fevereiro e Março/2026 (2 meses) -> R$ 1.549,80
    // ---------------------------------------------------------------------------------------
    cy.intercept('GET', '**/api/analise/vendas*').as('consulta43');
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-02-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consulta43').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body).to.have.property('totalGeral', 1549.80);
      expect(interception.response?.body.periodos).to.deep.eq(['2026-02', '2026-03']);
    });

    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '1.549,80');
    cy.get('.svg-line-chart').contains('text', 'Fev/26').should('exist');
    cy.get('.svg-line-chart').contains('text', 'Mar/26').should('exist');

    // ---------------------------------------------------------------------------------------
    // Etapa 4.4: Retorno ao Período Histórico Completo (5 meses) -> R$ 7.850,09
    // ---------------------------------------------------------------------------------------
    cy.intercept('GET', '**/api/analise/vendas*').as('consulta44');
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consulta44').its('response.statusCode').should('eq', 200);
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '7.850,09');
    cy.get('.svg-line-chart').contains('text', 'Nov/25').should('exist');

    // ---------------------------------------------------------------------------------------
    // Etapa 4.5: Validações de Rejeição de Intervalos Inválidos (RF0056, RN0072, RF0057)
    // ---------------------------------------------------------------------------------------
    // Tentativa A: Data final anterior à inicial (RF0056)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-05-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-01-01');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', 'A data final não pode ser anterior à data inicial');

    // Tentativa B: Período com mais de 24 meses (ex: 30 meses) (RN0072)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2024-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-06-01');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', '24 meses');

    // Tentativa C: Nenhuma categoria selecionada (RF0057)
    cy.get('[data-cy="input-data-inicio"]').clear().type('2026-01-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-01');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', 'ao menos uma categoria');

    // Tentativa D: Datas vazias / não preenchidas
    cy.get('[data-cy="input-data-inicio"]').clear();
    cy.get('[data-cy="input-data-fim"]').clear();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click(); // Reativar ao menos uma categoria
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.get('[data-cy="msg-erro-validacao"]')
      .should('be.visible')
      .and('contain.text', 'As datas inicial e final devem ser preenchidas');
  });
});
