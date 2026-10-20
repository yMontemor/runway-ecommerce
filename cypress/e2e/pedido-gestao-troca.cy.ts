describe('Suíte E2E: Gestão Administrativa de Pedidos e Ciclo de Trocas (Cenários 7 a 11)', () => {
  let clienteCodigo = '';
  let clienteId = 0;
  let ultimoCupomTrocaGerado = '';

  beforeEach(() => {
    // Restaurar estoque original das variações de teste
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });
    cy.task('ajustarEstoqueVariacao', { variacaoId: 5, quantidade: 20 });
    cy.task('ajustarEstoqueVariacao', { variacaoId: 10, quantidade: 20 });
    cy.request({ method: 'DELETE', url: 'http://localhost:5035/api/carrinho/CLI-0005', failOnStatusCode: false });

    // Intercepts de APIs reais do RunWay
    cy.intercept('GET', '**/api/clientes').as('getClientes');
    cy.intercept('GET', '**/api/produtos*').as('getProdutos');
    cy.intercept('POST', '**/api/frete/calcular').as('calcularFrete');
    cy.intercept('POST', '**/api/pagamento/validar').as('validarPagamento');
    cy.intercept('POST', '**/api/pedidos').as('postPedido');
    cy.intercept('POST', '**/api/pedidos/*/processar-pagamento').as('processarPagamento');
    cy.intercept('PATCH', '**/api/pedidos/*/status').as('atualizarStatusPedido');
    cy.intercept('POST', '**/api/trocas').as('solicitarTroca');
    cy.intercept('POST', '**/api/trocas/*/autorizar').as('autorizarTroca');
    cy.intercept('POST', '**/api/trocas/*/recebimento').as('confirmarRecebimentoTroca');

    // Localiza dinamicamente o cliente principal do seed
    cy.obterClientePrincipal().then((cliente) => {
      clienteCodigo = cliente.codigo;
      clienteId = cliente.id;

      // Acessa home e seleciona cliente ativo
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]', { timeout: 15000 }).should('be.visible').click();
      cy.get(`[data-cy="select-customer-${clienteCodigo}"]`, { timeout: 10000 }).scrollIntoView().should('be.visible').click();
      cy.get('[data-cy="user-dropdown"]').should('contain.text', cliente.nome.split(' ')[0]);

      // Limpar carrinho prévio do cliente (persistido e localStorage)
      cy.request({
        method: 'DELETE',
        url: `http://localhost:5035/api/carrinho/${clienteCodigo}`,
        failOnStatusCode: false
      });
      cy.window().then((win) => {
        win.localStorage.removeItem(`runway_cart_${clienteCodigo}`);
      });
    });
  });

  afterEach(() => {
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });
    cy.task('ajustarEstoqueVariacao', { variacaoId: 5, quantidade: 20 });
    cy.task('ajustarEstoqueVariacao', { variacaoId: 10, quantidade: 20 });
    cy.request({ method: 'DELETE', url: 'http://localhost:5035/api/carrinho/CLI-0005', failOnStatusCode: false });
  });

  /**
   * Helper para adicionar produto e ir até o Step 1 do checkout
   */
  function adicionarProdutoEIrAoCheckout(produtoId: string, tamanho: number) {
    cy.get('[data-cy="nav-catalogo"]').click({ force: true });
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid', { timeout: 20000 }).should('be.visible');

    cy.get(`[data-cy="product-card-${produtoId}"]`).should('be.visible');
    cy.get(`[data-cy="product-card-${produtoId}"]`).find('[data-cy="btn-card-adicionar"]').scrollIntoView().click();
    cy.get(`[data-cy="btn-tamanho-${tamanho}"]`).should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').should('not.exist');

    cy.get('[data-cy="nav-carrinho"]').click({ force: true });
    cy.url().should('include', '/carrinho');
    cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled').click();

    cy.url().should('include', '/checkout');
    cy.get('[data-cy="checkout-step-1"]').should('be.visible');
  }

  /**
   * Helper para concluir o fluxo de checkout com 1 cartão
   */
  function concluirCheckoutComUmCartao(): Cypress.Chainable<{ codigoPedido: string; itens: any[] }> {
    // Step 1: Avançar endereço
    cy.get('[data-cy="checkout-addresses-list"]').should('be.visible');
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

    // Step 2: Selecionar 1 cartão existente
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');
    cy.get('[data-cy="checkout-cards-list"]').should('be.visible');
    cy.get('[data-cy^="chk-card-"]').first().check();
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // Step 3: Revisão e confirmação
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').click();

    return cy.wait('@postPedido').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const resBody = interception.response?.body;
      const codigoPedido = resBody.codigo;

      return cy.get('[data-cy="order-confirmed-screen"]').should('be.visible').then(() => {
        cy.get('[data-cy="confirmed-order-code"]').should('contain.text', codigoPedido);
        return cy.wrap({
          codigoPedido,
          itens: resBody.itens as any[]
        });
      });
    });
  }

  /**
   * Helper para avançar o pedido pelo painel administrativo até o status ENTREGUE
   */
  function avancarPedidoAdminAteEntregue(codigoPedido: string) {
    cy.visit('/admin');
    cy.get('[data-cy="admin-pedidos"]').click();
    cy.get(`[data-cy="order-code-${codigoPedido}"]`).scrollIntoView().should('be.visible');

    // 1. Processar Pagamento: EM PROCESSAMENTO -> APROVADA
    cy.get(`[data-cy="btn-processar-pagamento-${codigoPedido}"]`).click();
    cy.wait('@processarPagamento');
    cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'APROVADA');

    // 2. Despachar: APROVADA -> EM TRANSPORTE
    cy.get(`[data-cy="btn-despachar-${codigoPedido}"]`).click();
    cy.wait('@atualizarStatusPedido');
    cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'EM TRANSPORTE');

    // 3. Confirmar Entrega: EM TRANSPORTE -> ENTREGUE
    cy.get(`[data-cy="btn-confirmar-entrega-${codigoPedido}"]`).click();
    cy.wait('@atualizarStatusPedido');
    cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'ENTREGUE');
  }

  // =========================================================================
  // CENÁRIO 7: Fluxo administrativo completo
  // EM PROCESSAMENTO -> APROVADA -> EM TRANSPORTE -> ENTREGUE
  // =========================================================================
  it('Cenário 7: Fluxo administrativo completo: EM PROCESSAMENTO -> APROVADA -> EM TRANSPORTE -> ENTREGUE com persistência no PostgreSQL', () => {
    // 1. Criar pedido real pelo checkout
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
    concluirCheckoutComUmCartao().then(({ codigoPedido }) => {
      // 2. Comprovar que o pedido nasce como EM PROCESSAMENTO na interface e no banco
      cy.get('[data-cy="confirmed-order-status"]').should('have.text', 'EM PROCESSAMENTO');

      cy.task<any>('obterPedidoPorCodigo', { codigoPedido }).then((pedidoDb) => {
        expect(pedidoDb).to.not.be.null;
        expect(pedidoDb.status).to.eq('EM PROCESSAMENTO');
      });

      // 3. Acessar o Painel Administrativo de Pedidos
      cy.visit('/admin');
      cy.get('[data-cy="admin-pedidos"]').click();
      cy.get(`[data-cy="order-code-${codigoPedido}"]`).scrollIntoView().should('be.visible');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'EM PROCESSAMENTO');

      // 4. Executar transição 1: EM PROCESSAMENTO -> APROVADA
      cy.get(`[data-cy="btn-processar-pagamento-${codigoPedido}"]`).click();
      cy.wait('@processarPagamento');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'APROVADA');

      cy.task<any>('obterPedidoPorCodigo', { codigoPedido }).then((pedidoDb) => {
        expect(pedidoDb.status).to.eq('APROVADA');
      });

      // 5. Executar transição 2: APROVADA -> EM TRANSPORTE
      cy.get(`[data-cy="btn-despachar-${codigoPedido}"]`).click();
      cy.wait('@atualizarStatusPedido');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'EM TRANSPORTE');

      cy.task<any>('obterPedidoPorCodigo', { codigoPedido }).then((pedidoDb) => {
        expect(pedidoDb.status).to.eq('EM TRANSPORTE');
      });

      // 6. Executar transição 3: EM TRANSPORTE -> ENTREGUE
      cy.get(`[data-cy="btn-confirmar-entrega-${codigoPedido}"]`).click();
      cy.wait('@atualizarStatusPedido');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'ENTREGUE');
      cy.get('.action-completed-text').should('contain.text', 'Entregue com sucesso');

      cy.task<any>('obterPedidoPorCodigo', { codigoPedido }).then((pedidoDb) => {
        expect(pedidoDb.status).to.eq('ENTREGUE');
      });
    });
  });

  // =========================================================================
  // CENÁRIO 8: Bloqueio de troca antes da entrega
  // =========================================================================
  it('Cenário 8: Bloqueio de solicitação de troca quando o pedido não está ENTREGUE (interface ausente/bloqueada e rejeição no backend)', () => {
    // 1. Criar pedido real pelo checkout
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
    concluirCheckoutComUmCartao().then(({ codigoPedido, itens }) => {
      const itemPedidoId = itens[0].id;

      // 2. Verificar na Área do Cliente quando pedido está EM PROCESSAMENTO
      cy.visit('/cliente?tab=pedidos');
      cy.get(`[data-cy="btn-solicitar-troca-${codigoPedido}"]`).should('not.exist');

      // 3. Testar rejeição pelo backend via POST /api/trocas para status EM PROCESSAMENTO
      cy.request({
        method: 'POST',
        url: 'http://localhost:5035/api/trocas',
        failOnStatusCode: false,
        body: {
          codigoCliente: clienteCodigo,
          codigoPedido,
          motivo: 'Tentativa indevida de troca com pedido em processamento',
          itens: [{ itemPedidoId, quantidade: 1 }]
        }
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body.erro || JSON.stringify(res.body)).to.include('RN0043');
        expect(res.body.erro || JSON.stringify(res.body)).to.include('ENTREGUE');
      });

      // 4. Avançar para APROVADA no Admin e verificar novamente
      cy.visit('/admin');
      cy.get('[data-cy="admin-pedidos"]').click();
      cy.get(`[data-cy="btn-processar-pagamento-${codigoPedido}"]`).click();
      cy.wait('@processarPagamento');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'APROVADA');

      cy.visit('/cliente?tab=pedidos');
      cy.get(`[data-cy="btn-solicitar-troca-${codigoPedido}"]`).should('not.exist');

      cy.request({
        method: 'POST',
        url: 'http://localhost:5035/api/trocas',
        failOnStatusCode: false,
        body: {
          codigoCliente: clienteCodigo,
          codigoPedido,
          motivo: 'Tentativa indevida de troca com pedido aprovado',
          itens: [{ itemPedidoId, quantidade: 1 }]
        }
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body.erro || JSON.stringify(res.body)).to.include('ENTREGUE');
      });

      // 5. Avançar para EM TRANSPORTE e verificar novamente
      cy.visit('/admin');
      cy.get('[data-cy="admin-pedidos"]').click();
      cy.get(`[data-cy="btn-despachar-${codigoPedido}"]`).click();
      cy.wait('@atualizarStatusPedido');
      cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'EM TRANSPORTE');

      cy.visit('/cliente?tab=pedidos');
      cy.get(`[data-cy="btn-solicitar-troca-${codigoPedido}"]`).should('not.exist');

      cy.request({
        method: 'POST',
        url: 'http://localhost:5035/api/trocas',
        failOnStatusCode: false,
        body: {
          codigoCliente: clienteCodigo,
          codigoPedido,
          motivo: 'Tentativa indevida de troca com pedido em transporte',
          itens: [{ itemPedidoId, quantidade: 1 }]
        }
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body.erro || JSON.stringify(res.body)).to.include('ENTREGUE');
      });
    });
  });

  // =========================================================================
  // CENÁRIO 9: Troca parcial e troca integral
  // =========================================================================
  it('Cenário 9: Troca parcial (mantém pedido ENTREGUE) e troca integral (altera pedido para EM TROCA) com validação de persistência', () => {
    // -----------------------------------------------------------------------
    // CASO A: Troca Parcial de pedido com múltiplos itens
    // -----------------------------------------------------------------------
    // Navegar ao catálogo via navbar
    cy.get('[data-cy="nav-catalogo"]').click({ force: true });
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid', { timeout: 20000 }).should('be.visible');

    // Adicionar item 1: Corre 4 tam 41
    cy.get('[data-cy="product-card-olympikus_corre_4"]').should('be.visible');
    cy.get('[data-cy="product-card-olympikus_corre_4"]').find('[data-cy="btn-card-adicionar"]').scrollIntoView().click();
    cy.get('[data-cy="btn-tamanho-41"]').should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').should('not.exist');

    // Aguardar o recarregamento reativo do catálogo após a adição do primeiro item
    cy.get('.products-grid', { timeout: 20000 }).should('be.visible');

    // Adicionar item 2: Corre 4 tam 42 (segundo item para compor pedido multi-item)
    cy.get('[data-cy="product-card-olympikus_corre_4"]').should('be.visible');
    cy.get('[data-cy="product-card-olympikus_corre_4"]').find('[data-cy="btn-card-adicionar"]').scrollIntoView().click();
    cy.get('[data-cy="btn-tamanho-42"]').should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').should('not.exist');

    // Ir ao carrinho e checkout
    cy.get('[data-cy="nav-carrinho"]').click({ force: true });
    cy.url().should('include', '/carrinho');
    cy.get('[data-cy="cart-item-row"]').should('have.length', 2);
    cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled').click();

    concluirCheckoutComUmCartao().then(({ codigoPedido: pedidoParcialCod, itens }) => {
      expect(itens).to.have.length(2);

      // Avançar pedido até ENTREGUE pelo Admin
      avancarPedidoAdminAteEntregue(pedidoParcialCod);

      // Cliente acessa pedidos para solicitar troca PARCIAL
      cy.visit('/cliente?tab=pedidos');
      cy.get(`[data-cy="btn-solicitar-troca-${pedidoParcialCod}"]`).scrollIntoView().should('be.visible').click();

      // Modal de troca: selecionar apenas o primeiro item
      cy.get('[data-cy="form-solicitar-troca"]').should('be.visible');
      const primeiroItem = itens[0];
      cy.get(`[data-cy="exchange-item-checkbox-${primeiroItem.id}"]`).check();

      cy.get('[data-cy="exchange-reason-input"]').type('Troca parcial: apenas um dos pares ficou largo');
      cy.get('[data-cy="btn-confirmar-solicitar-troca"]').click();

      cy.wait('@solicitarTroca').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        const trocaRes = interception.response?.body;
        const codigoTrocaParcial = trocaRes.codigo;

        // Comprovar na interface: pedido principal permanece ENTREGUE
        cy.get(`[data-cy="order-exchange-card-${codigoTrocaParcial}"]`).should('be.visible');
        cy.get(`[data-cy="customer-exchange-status-${codigoTrocaParcial}"]`).should('contain.text', 'EM TROCA');

        // Comprovar no PostgreSQL
        cy.task<any>('obterTrocaPorCodigo', { codigoTroca: codigoTrocaParcial }).then((trocaDb) => {
          expect(trocaDb.status).to.eq('EM TROCA');
          expect(trocaDb.tipo).to.eq('PARCIAL');
        });

        cy.task<any>('obterPedidoPorCodigo', { codigoPedido: pedidoParcialCod }).then((pedDb) => {
          // Mantém pedido principal como ENTREGUE
          expect(pedDb.status).to.eq('ENTREGUE');
        });
      });
    });

    // -----------------------------------------------------------------------
    // CASO B: Troca Integral de pedido
    // -----------------------------------------------------------------------
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
    concluirCheckoutComUmCartao().then(({ codigoPedido: pedidoTotalCod, itens }) => {
      // Avançar pedido até ENTREGUE pelo Admin
      avancarPedidoAdminAteEntregue(pedidoTotalCod);

      // Cliente acessa pedidos para solicitar troca INTEGRAL
      cy.visit('/cliente?tab=pedidos');
      cy.get(`[data-cy="btn-solicitar-troca-${pedidoTotalCod}"]`).scrollIntoView().should('be.visible').click();

      // Modal de troca: selecionar a totalidade dos itens
      cy.get('[data-cy="form-solicitar-troca"]').should('be.visible');
      cy.get(`[data-cy="exchange-item-checkbox-${itens[0].id}"]`).check();

      cy.get('[data-cy="exchange-reason-input"]').type('Troca integral de todos os itens do pedido');
      cy.get('[data-cy="btn-confirmar-solicitar-troca"]').click();

      cy.wait('@solicitarTroca').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        const trocaRes = interception.response?.body;
        const codigoTrocaTotal = trocaRes.codigo;

        // Comprovar na interface: pedido e troca exibem EM TROCA
        cy.get(`[data-cy="order-exchange-card-${codigoTrocaTotal}"]`).should('be.visible');
        cy.get(`[data-cy="customer-exchange-status-${codigoTrocaTotal}"]`).should('contain.text', 'EM TROCA');

        // Comprovar no PostgreSQL: pedido principal passou para EM TROCA
        cy.task<any>('obterTrocaPorCodigo', { codigoTroca: codigoTrocaTotal }).then((trocaDb) => {
          expect(trocaDb.status).to.eq('EM TROCA');
          expect(trocaDb.tipo).to.eq('TOTAL');
        });

        cy.task<any>('obterPedidoPorCodigo', { codigoPedido: pedidoTotalCod }).then((pedDb) => {
          expect(pedDb.status).to.eq('EM TROCA');
        });
      });
    });
  });

  // =========================================================================
  // CENÁRIO 10: Ciclo completo de troca
  // =========================================================================
  it('Cenário 10: Ciclo completo de troca: solicitação -> visualização admin -> autorização -> notificação cliente -> recebimento -> reentrada no estoque -> cupom gerado', () => {
    // 1. Registrar estoque inicial da variação 4 (Corre 4 tam 41) via PostgreSQL
    cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).then((qtdInicialEstoque) => {
      // 2. Realizar compra de 1 par Corre 4 tam 41
      adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
      concluirCheckoutComUmCartao().then(({ codigoPedido, itens }) => {
        // Estoque após compra e processamento diminui 1
        avancarPedidoAdminAteEntregue(codigoPedido);

        cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).should('eq', qtdInicialEstoque - 1);

        // PASSO 1: Cliente solicita troca de pedido ENTREGUE
        cy.visit('/cliente?tab=pedidos');
        cy.get(`[data-cy="btn-solicitar-troca-${codigoPedido}"]`).scrollIntoView().should('be.visible').click();

        cy.get('[data-cy="form-solicitar-troca"]').should('be.visible');
        cy.get(`[data-cy="exchange-item-checkbox-${itens[0].id}"]`).check();
        cy.get('[data-cy="exchange-reason-input"]').type('Produto com pequeno defeito na palmilha');
        cy.get('[data-cy="btn-confirmar-solicitar-troca"]').click();

        cy.wait('@solicitarTroca').then((solicitarInterception) => {
          expect(solicitarInterception.response?.statusCode).to.eq(201);
          const codigoTroca = solicitarInterception.response?.body.codigo;

          // PASSO 2: Administrador visualiza a solicitação EM TROCA
          cy.visit('/admin');
          cy.get('[data-cy="admin-trocas"]').click();
          cy.get(`[data-cy="exchange-code-${codigoTroca}"]`).scrollIntoView().should('be.visible');
          cy.get(`[data-cy="exchange-status-${codigoTroca}"]`).should('contain.text', 'EM TROCA');

          // PASSO 3: Administrador autoriza a troca
          cy.get(`[data-cy="btn-aceitar-troca-${codigoTroca}"]`).click();
          cy.wait('@autorizarTroca');
          cy.get(`[data-cy="exchange-status-${codigoTroca}"]`).should('contain.text', 'TROCA AUTORIZADA');

          // PASSO 4: Cliente visualiza a notificação de autorização na área do cliente
          cy.visit('/cliente?tab=pedidos');
          cy.get(`[data-cy="exchange-notif-${codigoTroca}"]`)
            .scrollIntoView()
            .should('be.visible')
            .and('contain.text', 'foi AUTORIZADA com sucesso');

          // PASSO 5 e 6: Administrador confirma recebimento e determina reentrada no estoque
          cy.visit('/admin');
          cy.get('[data-cy="admin-trocas"]').click();
          cy.get(`[data-cy="btn-confirmar-recebimento-${codigoTroca}"]`).scrollIntoView().click();

          // Modal de confirmação: escolher reentrada no estoque
          cy.get('[data-cy="btn-sim-retornar-estoque"]').should('be.visible').click();
          cy.wait('@confirmarRecebimentoTroca');

          // PASSO 7: Troca muda para TROCADO
          cy.get(`[data-cy="exchange-status-${codigoTroca}"]`).should('contain.text', 'TROCADO');

          // PASSO 8: Cupom é gerado e disponibilizado ao cliente
          const cupomEsperado = `TROCA-${codigoTroca}`;
          ultimoCupomTrocaGerado = cupomEsperado;

          cy.get(`[data-cy="exchange-coupon-${codigoTroca}"]`).should('contain.text', cupomEsperado);

          // Verificar disponibilização do cupom na Área do Cliente -> Meus Cupons
          cy.visit('/cliente?tab=cupons');
          cy.get(`[data-cy="coupon-card-${cupomEsperado}"]`).should('be.visible');
          cy.get(`[data-cy="coupon-card-${cupomEsperado}"] .coupon-code-badge`).should('contain.text', cupomEsperado);

          // PASSO 9: Conferir no PostgreSQL o aumento exato da quantidade devolvida
          cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).should('eq', qtdInicialEstoque);

          cy.task<any>('obterTrocaPorCodigo', { codigoTroca }).then((trocaDb) => {
            expect(trocaDb.status).to.eq('TROCADO');
            expect(trocaDb.retornouAoEstoque).to.be.true;
            expect(trocaDb.cupomCodigo).to.eq(cupomEsperado);
            expect(Number(trocaDb.cupomValor)).to.eq(449.90);
          });
        });
      });
    });
  });

  // =========================================================================
  // CENÁRIO 11: Utilização do cupom de troca em nova compra e bloqueio de reúso
  // =========================================================================
  it('Cenário 11: Utilização do cupom de troca gerado em uma nova compra, abatimento financeiro e bloqueio de reutilização indevida', () => {
    // Garantir disponibilidade de um cupom de troca gerado pelo fluxo de troca se executado isoladamente
    cy.wrap(null).then(() => {
      if (!ultimoCupomTrocaGerado) {
        return cy.task<string>('gerarCupomTrocaParaCenario11', { clienteCodigo }).then((codigoCupom) => {
          ultimoCupomTrocaGerado = codigoCupom;
        });
      }
    });

    cy.then(() => {
      const cupomTrocaCodigo = ultimoCupomTrocaGerado;

      // 1. Cliente adiciona novo produto ao carrinho (Corre 4 tam 41) e inicia checkout
      adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

      // Step 1: Confirmar endereço e frete (R$ 20,00)
      cy.get('[data-cy="checkout-addresses-list"]').should('be.visible');
      cy.get('[data-cy="btn-go-to-payment"]').click();

      // Step 2: Seleção de Pagamento com o Cupom de Troca
      cy.get('[data-cy="checkout-step-2"]').should('be.visible');

      // Selecionar o cupom de troca na lista
      cy.get(`[data-cy="chk-coupon-${cupomTrocaCodigo}"]`).scrollIntoView().check();

      // Complementar o valor residual (R$ 20,00 de frete) com 1 cartão de crédito
      cy.get('[data-cy="checkout-cards-list"]').should('be.visible');
      cy.get('[data-cy^="chk-card-"]').first().check();

      cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

      // Step 3: Revisão do Pedido comprovando abatimento financeiro
      cy.get('[data-cy="checkout-step-3"]').should('be.visible');
      cy.get('.review-pay-item').should('contain.text', cupomTrocaCodigo);

      // Concluir compra
      cy.get('[data-cy="btn-confirm-order"]').click();

      cy.wait('@postPedido').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        const novoPedidoCodigo = interception.response?.body.codigo;

        cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
        cy.get('[data-cy="confirmed-order-code"]').should('contain.text', novoPedidoCodigo);

        // Comprovar registro do cupom no PostgreSQL (tabela PAGAMENTO_PEDIDO)
        cy.task<any>('obterPagamentoCupom', { cupomCodigo: cupomTrocaCodigo, pedidoCodigo: novoPedidoCodigo }).then((pgCupom) => {
          expect(pgCupom).to.not.be.null;
          expect(pgCupom.formaPagamento).to.eq('CUPOM_TROCA');
          expect(Number(pgCupom.valor)).to.be.greaterThan(0);
        });

        // 2. Comprovar impossibilidade de reutilização indevida do cupom de troca
        // A. O cupom não deve mais estar disponível na lista de cupons de troca
        cy.visit('/cliente?tab=cupons');
        cy.contains('.tab-section-title', 'Meus Cupons', { timeout: 10000 }).should('be.visible');
        cy.get(`[data-cy="coupon-card-${cupomTrocaCodigo}"]`).should('not.exist');

        // B. Tentar usar o mesmo cupom em novo checkout e validar rejeição
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
        cy.get('[data-cy="btn-go-to-payment"]').click();

        // No Step 2, o checkbox do cupom não existe mais
        cy.get(`[data-cy="chk-coupon-${cupomTrocaCodigo}"]`).should('not.exist');

        // Tentativa de inclusão manual do código utilizado
        cy.get('[data-cy="input-coupon-code"]').type(cupomTrocaCodigo);
        cy.get('[data-cy="btn-apply-coupon"]').click();

        // Validação da mensagem de bloqueio por reutilização indevida
        cy.get('[data-cy="coupon-error-message"]')
          .should('be.visible')
          .and('contain.text', 'já foi utilizado em outra compra');
      });
    });
  });
});
