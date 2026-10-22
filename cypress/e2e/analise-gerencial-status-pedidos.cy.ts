/**
 * Suíte E2E: Cenários Funcionais 5 e 6 da Análise Gerencial de Vendas (Cartão 08).
 * Requisitos: RF0055, RF0056, RF0057, RN0071, RN0073, Regra Oficial do Status ENTREGUE.
 * 
 * - Cenário 5: Pedidos não entregues (APROVADA, EM TRANSPORTE) não devem integrar o faturamento,
 *              mesmo estando dentro do período e das categorias consultadas.
 * - Cenário 6: Pedidos que passam ao status ENTREGUE via PATCH oficial devem ser recalculados
 *              na próxima consulta real da interface React sem reload de página, com restauração garantida.
 * 
 * Regras Obrigatórias:
 * 1. Opera exclusivamente no banco PostgreSQL "runway_test" com a massa determinística do Cartão 02.
 * 2. Utiliza cy.intercept() exclusivamente como observador/espião das requisições reais à API (SEM mocks).
 * 3. Validação do contrato oficial de transição: PATCH /api/pedidos/{codigo}/status.
 * 4. Independência, idempotência e integridade: restauração fatal em caso de divergência.
 * 5. Credencial administrativa obtida exclusivamente do ambiente, sem exibição em logs.
 */

describe('Cartão 08 — Cenários Funcionais 5 e 6 (Status ENTREGUE e Atualização Reativa)', () => {
  const backendBaseUrl = 'http://localhost:5035';
  let adminKey = '';

  before(() => {
    // 1. Confirmar que a conexão do ambiente está estritamente vinculada a runway_test
    cy.task('confirmarBancoSeguro').then((res: any) => {
      expect(res.banco, 'Banco de testes obrigatório deve ser runway_test').to.eq('runway_test');
      expect(res.seguro).to.be.true;
    });

    // 2. Garantir preparação inicial da massa de testes determinística do Cartão 02
    cy.task('prepararMassaAnalise');

    // 3. Obter credencial administrativa exclusivamente de variável de ambiente
    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'Variável de ambiente RUNWAY_ADMIN_KEY deve estar configurada no ambiente').to.be.a('string').and.not.be.empty;
    });
  });

  afterEach(() => {
    // Restauração obrigatória da massa determinística após cada teste
    cy.task('prepararMassaAnalise');

    // Validação fatal de integridade: comprovar que o banco runway_test retornou ao estado original canônico
    cy.task('validarIntegridadeMassaAposTeste').then((res: any) => {
      expect(res.restaurado, 'A base runway_test deve ser restaurada após a execução do teste').to.be.true;
      expect(res.statusPed8, 'PED-ANL-0008 deve retornar para EM TRANSPORTE').to.eq('EM TRANSPORTE');
      expect(res.totalGeral, 'Total financeiro canônico da massa deve ser R$ 7.850,09').to.eq(7850.09);
    });
  });

  after(() => {
    // Restauração final obrigatória ao concluir a suíte inteira
    cy.task('prepararMassaAnalise');
  });

  beforeEach(() => {
    // Limpeza de sessão antes de cada teste
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

    // Informar a credencial administrativa com { log: false } para segurança
    cy.get('[data-cy="input-chave-admin"]').should('be.visible').type(adminKey, { log: false });
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    // Confirmar que o painel e os filtros estão prontos
    cy.get('[data-cy="admin-auth-status"]').should('be.visible');
    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
  };

  // =========================================================================================
  // CENÁRIO 5 — EXCLUSÃO DE PEDIDOS NÃO ENTREGUES (RF0055, RN0071, RN0073)
  // =========================================================================================
  it('Cenário 5 — Comprova que pedidos não entregues (APROVADA e EM TRANSPORTE) dentro do período/categorias são excluídos do faturamento', () => {
    // ---------------------------------------------------------------------------------------
    // Etapa 5.1: Auditoria prévia na API dos pedidos não entregues da massa do Cartão 02
    // ---------------------------------------------------------------------------------------
    // Pedido PED-ANL-0007: 2026-02-25, APROVADA, 1x VaporFly 4 (COMPETIÇÃO) = R$ 1.099,90
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0007`
    }).then((resPed7) => {
      expect(resPed7.status).to.eq(200);
      expect(resPed7.body.codigo).to.eq('PED-ANL-0007');
      expect(resPed7.body.status).to.eq('APROVADA');
      expect(resPed7.body.dataPedido).to.include('2026-02');
      expect(resPed7.body.subtotal).to.eq(1099.90);
    });

    // Pedido PED-ANL-0008: 2026-03-05, EM TRANSPORTE, 1x Corre 4 (TREINO DIÁRIO) = R$ 449,90
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0008`
    }).then((resPed8) => {
      expect(resPed8.status).to.eq(200);
      expect(resPed8.body.codigo).to.eq('PED-ANL-0008');
      expect(resPed8.body.status).to.eq('EM TRANSPORTE');
      expect(resPed8.body.dataPedido).to.include('2026-03');
      expect(resPed8.body.subtotal).to.eq(449.90);
    });

    // Constatação formal:
    // Ambos os pedidos estão rigorosamente dentro do intervalo 2025-11-01 a 2026-03-31 e pertencem
    // às categorias consultadas (COMPETIÇÃO e TREINO DIÁRIO).
    // Se fossem considerados, o total seria R$ 7.850,09 + R$ 1.099,90 + R$ 449,90 = R$ 9.399,89.

    // ---------------------------------------------------------------------------------------
    // Etapa 5.2: Consulta na interface React com observação da API real
    // ---------------------------------------------------------------------------------------
    desbloquearModoAdmin();

    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');

    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click().should('have.class', 'active');
    cy.get('[data-cy="toggle-cat-competicao"]').click().should('have.class', 'active');

    cy.intercept('GET', '**/api/analise/vendas*').as('consultaExclusaoNaoEntregues');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    // ---------------------------------------------------------------------------------------
    // Etapa 5.3: Validação da resposta da API real e do gabarito oficial independente
    // ---------------------------------------------------------------------------------------
    cy.wait('@consultaExclusaoNaoEntregues').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const corpo = interception.response?.body;

      // 1. Total Geral deve ser R$ 7.850,09 (e NÃO R$ 9.399,89)
      expect(corpo).to.have.property('totalGeral', 7850.09);

      // 2. Subtotais oficiais
      const serieTreino = corpo.series.find((s: any) => s.categoria === 'TREINO DIÁRIO');
      const serieComp = corpo.series.find((s: any) => s.categoria === 'COMPETIÇÃO');
      expect(serieTreino.total).to.eq(2350.59);
      expect(serieComp.total).to.eq(5499.50);

      // 3. Validação dos pontos mensais onde os pedidos não entregues atuariam:
      // Em 2026-02, COMPETIÇÃO possui apenas PED-ANL-0007 (APROVADA). Como não está ENTREGUE, valor = 0.00 (RN0073)
      const pontoFevComp = serieComp.dados.find((d: any) => d.periodo === '2026-02');
      expect(pontoFevComp.valor, 'Competição em Fev/26 deve ser 0.00 pois PED-ANL-0007 está APROVADA').to.eq(0);

      // Em 2026-03, TREINO DIÁRIO possui apenas PED-ANL-0008 (EM TRANSPORTE). Como não está ENTREGUE, valor = 0.00 (RN0073)
      const pontoMarTreino = serieTreino.dados.find((d: any) => d.periodo === '2026-03');
      expect(pontoMarTreino.valor, 'Treino Diário em Mar/26 deve ser 0.00 pois PED-ANL-0008 está EM TRANSPORTE').to.eq(0);
    });

    // ---------------------------------------------------------------------------------------
    // Etapa 5.4: Validação visual no SVG, legenda e tooltips da interface
    // ---------------------------------------------------------------------------------------
    cy.get('[data-cy="painel-grafico-analise"]').should('be.visible');

    // Total Geral no Card
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '7.850,09');

    // Legenda com os subtotais que excluem pedidos não entregues
    cy.get('[data-cy="legend-TREINO DIÁRIO"]').should('contain.text', '2.350,59');
    cy.get('[data-cy="legend-COMPETIÇÃO"]').should('contain.text', '5.499,50');

    // Pontos do SVG comprovando zero nos meses dos pedidos não entregues
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="COMPETIÇÃO"]')
      .should('have.attr', 'data-valor', '0');
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '0');

    // Tooltips confirmam valor zero
    cy.get('[data-cy="chart-point"][data-periodo="2026-02"][data-categoria="COMPETIÇÃO"]').click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]').should('contain.text', '0,00');

    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]').click({ force: true });
    cy.get('[data-cy="analytics-tooltip"]').should('contain.text', '0,00');
  });

  // =========================================================================================
  // CENÁRIO 6 — ATUALIZAÇÃO APÓS PEDIDO ENTREGUE (RF0055, RF0056, RF0057, RN0071, RN0073)
  // =========================================================================================
  it('Cenário 6 — Transição oficial de PED-ANL-0008 para ENTREGUE via PATCH, atualização reativa do gráfico sem reload e restauração', () => {
    // ---------------------------------------------------------------------------------------
    // Etapa A: Antes da entrega — confirmar estado inicial de PED-ANL-0008 e faturamento
    // ---------------------------------------------------------------------------------------
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0008`
    }).then((resPed) => {
      expect(resPed.status).to.eq(200);
      expect(resPed.body.status).to.eq('EM TRANSPORTE');
      expect(resPed.body.subtotal).to.eq(449.90);
    });

    desbloquearModoAdmin();

    // Configurar o período de novembro de 2025 a março de 2026 com ambas as categorias
    cy.get('[data-cy="input-data-inicio"]').clear().type('2025-11-01');
    cy.get('[data-cy="input-data-fim"]').clear().type('2026-03-31');
    cy.get('[data-cy="btn-limpar-categorias"]').click();
    cy.get('[data-cy="toggle-cat-treino_diario"]').click();
    cy.get('[data-cy="toggle-cat-competicao"]').click();

    // Garantir que a página NÃO sofre reload durante a atualização (SPA)
    cy.window().then((win) => {
      win.addEventListener('beforeunload', () => {
        throw new Error('A página não deveria ter sido recarregada durante a atualização dinâmica do gráfico!');
      });
    });

    cy.intercept('GET', '**/api/analise/vendas*').as('consultaInicial');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@consultaInicial').its('response.statusCode').should('eq', 200);

    // Validação 6.A: Valores financeiros antes da entrega
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '7.850,09');
    cy.get('[data-cy="legend-TREINO DIÁRIO"]').should('contain.text', '2.350,59');
    cy.get('[data-cy="legend-COMPETIÇÃO"]').should('contain.text', '5.499,50');
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('have.attr', 'data-valor', '0');

    // ---------------------------------------------------------------------------------------
    // Etapa B: Confirmar a entrega utilizando o fluxo oficial da API: PATCH /api/pedidos/{codigo}/status
    // ---------------------------------------------------------------------------------------
    cy.request({
      method: 'PATCH',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0008/status`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        novoStatus: 'ENTREGUE',
        motivo: 'Entrega confirmada no teste funcional E2E do Cenário 6',
        usuarioResponsavel: 'Administrador'
      }
    }).then((patchRes) => {
      expect(patchRes.status).to.eq(200);
      expect(patchRes.body.codigo).to.eq('PED-ANL-0008');
      expect(patchRes.body.status).to.eq('ENTREGUE');
    });

    // Confirmar diretamente no PostgreSQL runway_test que a alteração de status foi persistida
    cy.task('obterPedidoDb', { codigoPedido: 'PED-ANL-0008' }).then((pedidoDb: any) => {
      expect(pedidoDb, 'Registro de PED-ANL-0008 deve existir no banco').to.exist;
      expect(pedidoDb.status, 'Status persistido no banco deve ser ENTREGUE').to.eq('ENTREGUE');
    });

    // ---------------------------------------------------------------------------------------
    // Etapa C: Atualizar a análise na interface React sem recarregar a página
    // ---------------------------------------------------------------------------------------
    cy.intercept('GET', '**/api/analise/vendas*').as('reconsultaPosEntrega');

    // Re-aplicar a consulta pela interface React
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    // Validar requisição real à API após a entrega
    cy.wait('@reconsultaPosEntrega').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const corpo = interception.response?.body;

      // 1. Total Geral passou de R$ 7.850,09 para R$ 8.299,99 (+ R$ 449,90)
      expect(corpo.totalGeral).to.eq(8299.99);

      // 2. Subtotal de TREINO DIÁRIO passou de R$ 2.350,59 para R$ 2.800,49
      const serieTreino = corpo.series.find((s: any) => s.categoria === 'TREINO DIÁRIO');
      expect(serieTreino.total).to.eq(2800.49);

      // 3. Subtotal de COMPETIÇÃO permaneceu inalterado em R$ 5.499,50
      const serieComp = corpo.series.find((s: any) => s.categoria === 'COMPETIÇÃO');
      expect(serieComp.total).to.eq(5499.50);

      // 4. Março/2026 de TREINO DIÁRIO passou de 0.00 para 449.90
      const pontoMarTreino = serieTreino.dados.find((d: any) => d.periodo === '2026-03');
      expect(pontoMarTreino.valor).to.eq(449.90);
    });

    // Validar atualização reativa de todos os componentes da interface:
    // Total Geral Atualizado: R$ 8.299,99
    cy.get('[data-cy="total-geral-vendas"]')
      .should('be.visible')
      .and('contain.text', '8.299,99');

    // Legenda Atualizada: Treino Diário R$ 2.800,49 e Competição R$ 5.499,50
    cy.get('[data-cy="legend-TREINO DIÁRIO"]')
      .should('be.visible')
      .and('contain.text', '2.800,49');
    cy.get('[data-cy="legend-COMPETIÇÃO"]')
      .should('be.visible')
      .and('contain.text', '5.499,50');

    // Ponto no SVG atualizado com o valor de R$ 449,90 em Mar/26
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .should('exist')
      .and('have.attr', 'data-valor', '449.9');

    // Tooltip interativo reflete o novo valor financeiro exato
    cy.get('[data-cy="chart-point"][data-periodo="2026-03"][data-categoria="TREINO DIÁRIO"]')
      .click({ force: true });

    cy.get('[data-cy="analytics-tooltip"]')
      .should('be.visible')
      .and('contain.text', 'TREINO DIÁRIO')
      .and('contain.text', 'Mar/26')
      .and('contain.text', '449,90');

    // ---------------------------------------------------------------------------------------
    // Etapa D: Restauração explícita da massa e validação do retorno ao estado canônico
    // ---------------------------------------------------------------------------------------
    cy.task('prepararMassaAnalise');

    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/pedidos/PED-ANL-0008`
    }).then((resRestaurado) => {
      expect(resRestaurado.status).to.eq(200);
      expect(resRestaurado.body.status, 'PED-ANL-0008 deve retornar para EM TRANSPORTE').to.eq('EM TRANSPORTE');
    });

    // Reconsulta pós-restauração na interface: confirma retorno para R$ 7.850,09
    cy.intercept('GET', '**/api/analise/vendas*').as('reconsultaRestaurada');
    cy.get('[data-cy="btn-aplicar-filtros"]').click();

    cy.wait('@reconsultaRestaurada').its('response.body.totalGeral').should('eq', 7850.09);
    cy.get('[data-cy="total-geral-vendas"]').should('contain.text', '7.850,09');
    cy.get('[data-cy="legend-TREINO DIÁRIO"]').should('contain.text', '2.350,59');
  });
});
