describe('Suíte E2E: Fluxos de Checkout e Criação de Pedidos (Cenários 1 a 5)', () => {
  let clienteCodigo = '';
  let clienteId = 0;

  beforeEach(() => {
    // Restaurar estoque original da variação 4 (Corre 4 tam 41) para 20
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });
    cy.request({ method: 'DELETE', url: 'http://localhost:5035/api/carrinho/CLI-0005', failOnStatusCode: false });

    // Intercepts de APIs reais do RunWay
    cy.intercept('GET', '**/api/clientes').as('getClientes');
    cy.intercept('GET', '**/api/produtos*').as('getProdutos');
    cy.intercept('POST', '**/api/frete/calcular').as('calcularFrete');
    cy.intercept('POST', '**/api/pagamento/validar').as('validarPagamento');
    cy.intercept('POST', '**/api/pedidos').as('postPedido');

    // Localiza dinamicamente o cliente padrão do seed por e-mail
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
    // Restaurar estoque original da variação 4 (Corre 4 tam 41) para 20
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });
    cy.request({ method: 'DELETE', url: 'http://localhost:5035/api/carrinho/CLI-0005', failOnStatusCode: false });
  });

  before(() => {
    // Garantir cupons promocionais padrão para testes
    cy.task('garantirCuponsPromocionais');
  });

  after(() => {
    // Limpeza de cupons de teste não utilizados
    cy.task('limparCuponsCypressNaoUtilizados');
  });

  /**
   * Helper para adicionar produto ao carrinho e iniciar checkout até o Step 1
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

  // =========================================================================
  // CENÁRIO 1: Compra com 1 cartão, aprovação e comprovação de baixa no estoque
  // =========================================================================
  it('Cenário 1: Compra com um cartão, aprovação administrativa e comprovação de baixa no estoque do PostgreSQL', () => {
    // 1. Obter estoque inicial da variação 4 (Corre 4 tam 41) via consulta real no banco
    cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).then((qtdInicial) => {
      expect(qtdInicial).to.be.greaterThan(0);

      // 2. Adicionar Corre 4 (tam 41) e ir ao checkout
      adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

      // 3. Step 1: Confirmar seleção de endereço existente (SP) e cálculo de frete
      cy.get('[data-cy="checkout-addresses-list"]').should('be.visible');
      cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

      // 4. Step 2: Selecionar 1 cartão existente (o primeiro já é preenchido com o saldo total)
      cy.get('[data-cy="checkout-step-2"]').should('be.visible');
      cy.get('[data-cy="checkout-cards-list"]').should('be.visible');
      cy.get('[data-cy^="chk-card-"]').first().check();
      cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

      // 5. Step 3: Revisão do pedido
      cy.get('[data-cy="checkout-step-3"]').should('be.visible');
      cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

      // 6. Intercept real do POST /api/pedidos: status inicial EM PROCESSAMENTO
      cy.wait('@postPedido').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        const body = interception.response?.body;
        const codigoPedido = body.codigo;
        expect(codigoPedido).to.match(/^RW-2026-\d{4}$/);
        expect(body.status).to.eq('EM PROCESSAMENTO');
        expect(body.valorTotal).to.be.greaterThan(0);

        // Validar tela de confirmação
        cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
        cy.get('[data-cy="confirmed-order-code"]').should('contain.text', codigoPedido);
        cy.get('[data-cy="confirmed-order-status"]').should('contain.text', 'EM PROCESSAMENTO');

        // 7. Navegar até o painel administrativo para aprovar o pagamento
        cy.visit('/admin');
        cy.get('[data-cy="admin-pedidos"]').click();
        cy.get(`[data-cy="order-code-${codigoPedido}"]`).should('be.visible');

        // Clicar em PROCESSAR PAGAMENTO (mecanismo determinístico aprova com sucesso)
        cy.get(`[data-cy="btn-processar-pagamento-${codigoPedido}"]`).click();

        // Comprovar na interface que o status transitou para APROVADA
        cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'APROVADA');

        // 8. Comprovação rigorosa de baixa física no estoque do PostgreSQL
        cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).should('eq', qtdInicial - 1);
      });

      // 9. Validar que o carrinho do cliente foi esvaziado após confirmação
      cy.get('[data-cy="nav-carrinho"]').click();
      cy.url().should('include', '/carrinho');
      cy.contains('Seu carrinho está vazio').should('be.visible');
    });
  });

  // =========================================================================
  // CENÁRIO 3: Compra com Novos Dados Salvos (Novo Endereço + Novo Cartão no Perfil)
  // =========================================================================
  it('Cenário 3: Novo endereço e novo cartão marcados para salvar no perfil são persistidos e aparecem na área do cliente', () => {
    const ts = Date.now().toString().slice(-4);
    const identificacaoEndereco = `Escritorio ${ts}`;
    const logradouroNovo = `Avenida Paulista ${ts}`;
    const titularCartao = `CARLOS TESTE ${ts}`;

    // Intercepts para criação de endereço e cartão no perfil
    cy.intercept('POST', `**/api/clientes/${clienteCodigo}/enderecos`).as('cadastrarEnderecoPerfil');
    cy.intercept('POST', `**/api/clientes/${clienteCodigo}/cartoes`).as('cadastrarCartaoPerfil');

    // 1. Adicionar produto e ir ao checkout
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

    // 2. Step 1: Cadastrar novo endereço com "salvar no perfil"
    cy.get('[data-cy="btn-add-new-address"]').click();
    cy.get('[data-cy="input-addr-label"]').type(identificacaoEndereco);
    cy.get('[data-cy="select-addr-residence-type"]').select('Comercial');
    cy.get('[data-cy="select-addr-street-type"]').select('Avenida');
    cy.get('[data-cy="input-addr-street"]').type(logradouroNovo);
    cy.get('[data-cy="input-addr-number"]').type('1500');
    cy.get('[data-cy="input-addr-neighborhood"]').type('Bela Vista');
    cy.get('[data-cy="input-addr-zip"]').type('01310-100');
    cy.get('[data-cy="input-addr-city"]').type('São Paulo');
    cy.get('[data-cy="select-addr-state"]').select('SP');
    cy.get('[data-cy="chk-save-address-to-profile"]').should('be.checked');
    cy.get('[data-cy="btn-save-address"]').click();

    cy.wait('@cadastrarEnderecoPerfil').its('response.statusCode').should('eq', 201);
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

    // 3. Step 2: Cadastrar novo cartão com "salvar no perfil"
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');
    cy.get('[data-cy="btn-add-new-card"]').click();

    cy.get('[data-cy="input-card-number"]').type('4532 9999 8888 7777');
    cy.get('[data-cy="input-card-holder"]').type(titularCartao);
    cy.get('[data-cy="select-card-brand"]').select('Visa');
    cy.get('[data-cy="input-card-exp"]').type('12/29');
    cy.get('[data-cy="input-card-cvv"]').type('999');
    cy.get('[data-cy="chk-save-card-to-profile"]').should('be.checked');
    cy.get('[data-cy="btn-save-card"]').click();

    cy.wait('@cadastrarCartaoPerfil').its('response.statusCode').should('eq', 201);

    // O novo cartão fica disponível e é selecionado
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // 4. Step 3: Revisão e confirmação
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

    // 5. Step 4: Pedido confirmado
    cy.wait('@postPedido').its('response.statusCode').should('eq', 201);
    cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');

    // 6. Navegar até a Área do Cliente -> Perfil e comprovar persistência real de endereço e cartão
    cy.get('[data-cy="nav-perfil"]').click();
    cy.url().should('include', '/cliente?tab=perfil');

    // Comprovar que o novo endereço consta na lista do perfil
    cy.contains('[data-cy="endereco-card"]', identificacaoEndereco)
      .should('be.visible')
      .and('contain.text', logradouroNovo);

    // Comprovar que o novo cartão (final 7777) consta na lista de cartões do perfil
    cy.contains('[data-cy="cartao-card"]', 'final 7777')
      .should('be.visible');
  });

  // =========================================================================
  // CENÁRIO 2: Pagamento com dois cartões com bloqueio de valor inferior a R$ 10,00
  // =========================================================================
  it('Cenário 2 (RN0034): Pagamento com dois cartões, com tentativa de valor inferior a R$ 10,00 bloqueada e sucesso com distribuição válida', () => {
    // 1. Adicionar Pegasus 41 (R$ 550,99) e ir ao checkout
    // Subtotal R$ 550,99 + Frete R$ 20,00 = Total R$ 570,99
    adicionarProdutoEIrAoCheckout('nike_pegasus_41', 40);

    // 2. Step 1: Avançar para pagamento
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

    // 3. Step 2: Selecionar 2 cartões de crédito
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');
    cy.get('[data-cy^="chk-card-"]').then(($cards) => {
      // Garantir ao menos 2 cartões selecionados
      cy.wrap($cards.eq(0)).check();
      cy.wrap($cards.eq(1)).check();
    });

    // 4. Tentativa de valor inferior a R$ 10,00 (RN0034): Cartão 1 = R$ 5,00
    cy.get('[data-cy^="input-card-amount-"]').first().clear().type('5.00');
    cy.get('[data-cy^="input-card-amount-"]').last().clear().type('565.99');

    // Confirmar bloqueio funcional na interface
    cy.get('[data-cy="payment-validation-warning"]')
      .should('be.visible')
      .and('contain.text', 'pelo menos R$ 10,00');
    cy.get('[data-cy="btn-go-to-review"]').should('be.disabled');

    // 5. Distribuir valores válidos: Cartão 1 = R$ 500,00; Cartão 2 = restante R$ 70,99 (ambos >= R$ 10,00)
    cy.get('[data-cy^="input-card-amount-"]').first().clear().type('500.00');
    cy.get('[data-cy^="btn-use-rest-"]').last().click();

    // Confirmar que o saldo restante foi zerado e o formulário habilita avanço
    cy.contains('[data-cy="payment-validation-warning"]', 'pelo menos R$ 10,00').should('not.exist');
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // 6. Step 3: Confirmar pedido na revisão
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

    // 7. Step 4: Validar tela de confirmação com detalhamento dos cartões
    cy.wait('@postPedido').its('response.statusCode').should('eq', 201);
    cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
    cy.get('.conf-detail-payments').should('be.visible').within(() => {
      cy.contains('500,00').should('be.visible');
      cy.contains('70,99').should('be.visible');
    });
  });

  // =========================================================================
  // RN0033: Apenas um cupom promocional por compra
  // =========================================================================
  it('RN0033: deve bloquear tentativa de aplicar mais de um cupom promocional e exibir mensagem funcional de impedimento', () => {
    // 1. Adicionar Corre 4 e ir ao checkout Step 2
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');

    // 2. Selecionar primeiro cupom promocional (PROMO20)
    cy.get('[data-cy="chk-coupon-PROMO20"]').check();
    cy.wait('@validarPagamento');

    // 3. Tentar selecionar o segundo cupom promocional (BEMVINDO50)
    cy.get('[data-cy="chk-coupon-BEMVINDO50"]').check();
    cy.wait('@validarPagamento');

    // 4. Comprovar bloqueio funcional na UI com a mensagem exata do DRS/backend
    cy.get('[data-cy="payment-validation-warning"]')
      .should('be.visible')
      .and('contain.text', 'É permitido utilizar no máximo um cupom promocional por compra.');

    // 5. Comprovar que o avanço para revisão é impedido
    cy.get('[data-cy="btn-go-to-review"]').should('be.disabled');

    // 6. Desmarcar o segundo cupom e comprovar restauração do fluxo
    cy.get('[data-cy="chk-coupon-BEMVINDO50"]').uncheck();
    cy.wait('@validarPagamento');
    cy.contains('[data-cy="payment-validation-warning"]', 'É permitido utilizar no máximo um cupom promocional').should('not.exist');
  });

  // =========================================================================
  // RN0035: Considerar maior valor dos cupons na ordem de abatimento
  // =========================================================================
  it('RN0035: deve considerar sempre os cupons de maior valor prioritariamente no abatimento do saldo', () => {
    cy.task<{ cupomMenor: string; cupomMaior: string }>('prepararCuponsCypress', { clienteId, clienteCodigo })
      .then(({ cupomMenor, cupomMaior }) => {
        // Corre 4 (R$ 449,90) + Frete SP (R$ 20,00) = R$ 469,90
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
        cy.get('[data-cy="btn-go-to-payment"]').click();
        cy.get('[data-cy="checkout-step-2"]').should('be.visible');

        // Aplicar cupom de menor valor primeiro no input (R$ 50,00)
        cy.get('[data-cy="input-coupon-code"]').type(cupomMenor);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');

        // Aplicar cupom de maior valor (R$ 150,00)
        cy.get('[data-cy="input-coupon-code"]').type(cupomMaior);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');

        // Comprovar na interface o abatimento cumulativo: 469,90 - 200,00 = 269,90
        cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '269,90');

        // Selecionar primeiro cartão disponível para cobrir o saldo restante de R$ 269,90
        cy.get('[data-cy^="chk-card-"]').first().check();

        // Registrar intercept com alias exclusivo para capturar a validação de avanço para revisão
        cy.intercept('POST', '**/api/pagamento/validar').as('validarAvancoRevisao');

        // O formulário valida continuamente e habilita o botão de avanço para revisão
        cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

        // Validar que o avanço para revisão validou com HTTP 200 e ordenou cupons pelo maior valor
        cy.wait('@validarAvancoRevisao').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
          const cuponsUtilizados = interception.response?.body.cuponsUtilizados;
          expect(cuponsUtilizados).to.be.an('array').with.lengthOf(2);
          // O primeiro da lista de processamento deve ser estritamente o de maior valor (R$ 150,00)
          expect(cuponsUtilizados[0].codigo).to.eq(cupomMaior);
          expect(cuponsUtilizados[0].valorOriginal).to.eq(150.00);
          // O segundo deve ser o de menor valor (R$ 50,00)
          expect(cuponsUtilizados[1].codigo).to.eq(cupomMenor);
          expect(cuponsUtilizados[1].valorOriginal).to.eq(50.00);
        });

        // Comprovar que avançou para a revisão com a composição aprovada
        cy.get('[data-cy="checkout-step-3"]').should('be.visible');
      });
  });

  // =========================================================================
  // CENÁRIO 3: Cupom PROMOCIONAL + Cartão com Residual < R$ 10,00 (RN0035)
  // =========================================================================
  it('Cenário 3 (RN0035): Cupom PROMOCIONAL combinado com cartão com residual inferior a R$ 10,00 é aceito e gera pedido', () => {
    // 1. Preparar cupom promocional dinâmico com valor de R$ 464,90
    cy.task<{ cupomPromoResto5: string }>('prepararCuponsCypress', { clienteId, clienteCodigo })
      .then(({ cupomPromoResto5 }) => {
        // 2. Adicionar Corre 4 (R$ 449,90) + Frete SP (R$ 20,00) = R$ 469,90
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

        // 3. Step 1: Avançar para pagamento
        cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

        // 4. Step 2: Aplicar cupom promocional de R$ 464,90
        cy.get('[data-cy="checkout-step-2"]').should('be.visible');
        cy.get('[data-cy="input-coupon-code"]').type(cupomPromoResto5);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');

        // Confirmar saldo restante de exatamente R$ 5,00
        cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '5,00');

        // Selecionar 1 cartão para pagar o residual
        cy.get('[data-cy^="chk-card-"]').first().check();

        // Confirmar que o sistema aceitou o residual de R$ 5,00 sem erro de mínimo (RN0035)
        cy.get('[data-cy="payment-validation-warning"]').should('not.exist');
        cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

        // 5. Step 3: Revisão e confirmação
        cy.get('[data-cy="checkout-step-3"]').should('be.visible');
        cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

        // 6. Step 4: Pedido confirmado
        cy.wait('@postPedido').its('response.statusCode').should('eq', 201);
        cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
        cy.get('[data-cy="confirmed-order-status"]').should('contain.text', 'EM PROCESSAMENTO');
        cy.get('[data-cy="confirmed-order-total"]').should('contain.text', '469,90');
      });
  });

  // =========================================================================
  // CENÁRIO 4: Cupons de troca excedentes gerando diferença e bloqueio de supérfluo (RN0036)
  // =========================================================================
  it('Cenário 4 (RN0036): Cupons de troca excedentes geram cupom de diferença e bloqueiam aplicação de cupons desnecessários', () => {
    // 1. Preparar par de cupons de troca (R$ 300 cada = R$ 600 > R$ 469,90) e cupom supérfluo (R$ 40)
    cy.task<{ cupomTrocaA: string; cupomTrocaB: string; cupomSuperfluo: string }>(
      'prepararCuponsCypress',
      { clienteId, clienteCodigo }
    ).then(({ cupomTrocaA, cupomTrocaB, cupomSuperfluo }) => {
      // 2. Adicionar Corre 4 (R$ 449,90) + Frete SP (R$ 20,00) = R$ 469,90
      // Excedente esperado: R$ 600,00 - R$ 469,90 = R$ 130,10
      adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

      // 3. Step 1: Avançar para pagamento
      cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

      // 4. Step 2: Aplicar primeiro cupom de troca (R$ 300,00)
      cy.get('[data-cy="checkout-step-2"]').should('be.visible');
      cy.get('[data-cy="input-coupon-code"]').clear().type(cupomTrocaA);
      cy.get('[data-cy="btn-apply-coupon"]').click();
      cy.wait('@validarPagamento');
      cy.get('[data-cy="coupon-success-message"]').should('be.visible');
      cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '169,90');

      // Aplicar segundo cupom de troca (R$ 300,00): total R$ 600,00 cobre 100% da compra
      cy.get('[data-cy="input-coupon-code"]').clear().type(cupomTrocaB);
      cy.get('[data-cy="btn-apply-coupon"]').click();
      cy.wait('@validarPagamento');
      cy.get('[data-cy="coupon-success-message"]').should('be.visible');
      cy.get('[data-cy="zero-cards-needed-msg"]').should('be.visible');
      cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '0,00');

      // 5. Tentar aplicar um terceiro cupom supérfluo/desnecessário (R$ 40,00) - RN0036
      cy.get('[data-cy="input-coupon-code"]').clear().type(cupomSuperfluo);
      cy.get('[data-cy="btn-apply-coupon"]').click();
      cy.wait('@validarPagamento');

      // Comprovar rejeição funcional de cupom desnecessário e bloqueio do avanço
      cy.get('[data-cy="payment-validation-warning"]')
        .should('be.visible')
        .and('contain.text', 'é desnecessário, pois o valor da compra já foi totalmente coberto');
      cy.get('[data-cy="btn-go-to-review"]').should('be.disabled');

      // 6. Desmarcar o cupom desnecessário para prosseguir com a composição válida
      cy.get(`[data-cy="chk-coupon-${cupomSuperfluo}"]`).uncheck();
      cy.wait('@validarPagamento');
      cy.contains('[data-cy="payment-validation-warning"]', 'desnecessário').should('not.exist');

      // 7. Avançar para a revisão
      cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

      // 8. Step 3: Revisão e confirmação com prévia do novo cupom de troca
      cy.get('[data-cy="checkout-step-3"]').should('be.visible');
      cy.contains('Prévia de Novo Cupom de Troca a Gerar').should('be.visible');
      cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

      // 9. Step 4: Validar geração real do novo cupom de troca por excedente
      cy.wait('@postPedido').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        const body = interception.response?.body;
        expect(body.novoCupomTroca).to.not.be.null;
        expect(body.novoCupomTroca.valor).to.eq(130.10);
        expect(body.novoCupomTroca.codigo).to.match(/^TROCA-/);

        // Conferir no DOM da tela de confirmação
        cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
        cy.get('[data-cy="surplus-coupon-banner"]').should('be.visible');
        cy.get('[data-cy="surplus-coupon-code"]').should('contain.text', body.novoCupomTroca.codigo);
        cy.get('[data-cy="surplus-coupon-value"]').should('contain.text', '130,10');
      });
    });
  });

  // =========================================================================
  // CENÁRIO 5: Compra REPROVADA (RN0038: não baixa estoque, libera reserva)
  // =========================================================================
  it('Cenário 5: Compra com cartão determinístico de reprovação transita para REPROVADA, não baixa estoque e libera reserva para outro cliente', () => {
    // 1. Selecionar cliente de teste A e cliente de teste B
    cy.obterClientePrincipal('ana.silva@email.com').then((clienteA) => {
      cy.obterClientePrincipal('carlos.mendes@email.com').then((clienteB) => {
        // 2. Calibrar e registrar estoque inicial conhecido (20 unidades) na variação 4 (Corre 4 tam 41)
        cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });
        cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).then((qtdInicial) => {
          expect(qtdInicial).to.eq(20);

          // Limpar carrinhos de A e B
          cy.request({ method: 'DELETE', url: `http://localhost:5035/api/carrinho/${clienteA.codigo}`, failOnStatusCode: false });
          cy.request({ method: 'DELETE', url: `http://localhost:5035/api/carrinho/${clienteB.codigo}`, failOnStatusCode: false });

          // 3. Adicionar produto Corre 4 (tam 41) ao carrinho de Ana pela interface
          adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

          // Step 1: Confirmar endereço existente
          cy.get('[data-cy="checkout-addresses-list"]').should('be.visible');
          cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

          // Step 2: Cadastrar e utilizar cartão que provoca reprovação determinística (final 9999 / titular REPROVAR)
          cy.get('[data-cy="checkout-step-2"]').should('be.visible');
          cy.get('[data-cy="btn-add-new-card"]').click();

          cy.get('[data-cy="input-card-number"]').type('4532 0000 0000 9999');
          cy.get('[data-cy="input-card-holder"]').type('TESTE CARTAO REPROVAR');
          cy.get('[data-cy="select-card-brand"]').select('Visa');
          cy.get('[data-cy="input-card-exp"]').type('12/29');
          cy.get('[data-cy="input-card-cvv"]').type('999');
          cy.get('[data-cy="btn-save-card"]').click();

          // O novo cartão (final 9999) é selecionado com o valor total
          cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

          // Step 3: Revisão do pedido e confirmação
          cy.get('[data-cy="checkout-step-3"]').should('be.visible');
          cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

          // 4. Capturar criação do pedido (status inicial EM PROCESSAMENTO)
          cy.wait('@postPedido').then((interception) => {
            expect(interception.response?.statusCode).to.eq(201);
            const body = interception.response?.body;
            const codigoPedido = body.codigo;
            expect(body.status).to.eq('EM PROCESSAMENTO');

            cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
            cy.get('[data-cy="confirmed-order-code"]').should('contain.text', codigoPedido);

            // 5. Processar o pagamento pelo fluxo real da aplicação no painel administrativo
            cy.visit('/admin');
            cy.get('[data-cy="admin-pedidos"]').click();
            cy.get(`[data-cy="order-code-${codigoPedido}"]`).should('be.visible');

            // Clicar em PROCESSAR PAGAMENTO: motor determinístico avalia cartão final 9999 e reprova
            cy.get(`[data-cy="btn-processar-pagamento-${codigoPedido}"]`).click();

            // 6. Confirmar a transição real de EM PROCESSAMENTO para REPROVADA na interface
            cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'REPROVADA');

            // 7. Verificar que NÃO houve baixa física no estoque do PostgreSQL
            cy.task<number>('obterEstoqueVariacao', { variacaoId: 4 }).should('eq', qtdInicial);

            // 8. Confirmar que a reserva foi liberada e o produto voltou a ficar disponível para outro cliente
            // Trocar para Cliente B (Carlos Mendes)
            cy.visit('/');
            cy.get('[data-cy="user-dropdown"]', { timeout: 15000 }).should('be.visible').click();
            cy.get(`[data-cy="select-customer-${clienteB.codigo}"]`, { timeout: 10000 }).scrollIntoView().should('be.visible').click();
            cy.get('[data-cy="user-dropdown"]').should('contain.text', clienteB.nome.split(' ')[0]);

            // Cliente B adiciona o Corre 4 tam 41 liberado ao carrinho
            cy.get('[data-cy="nav-catalogo"]').click({ force: true });
            cy.url().should('include', '/catalogo');
            cy.get('.products-grid', { timeout: 20000 }).should('be.visible');
            cy.get('[data-cy="product-card-olympikus_corre_4"] [data-cy="btn-card-adicionar"]').click();
            cy.get('[data-cy="btn-tamanho-41"]').should('be.visible').click();
            cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();
            cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').should('not.exist');

            // Acessar carrinho de Carlos: a unidade liberada está reservada com sucesso para ele
            cy.get('[data-cy="nav-carrinho"]').click();
            cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
            cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
            cy.get('[data-cy="cart-timer-badge"]').should('be.visible');
            cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled');

            // 9. Confirmar que os dados continuam corretos após atualizar a página
            cy.reload();
            cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
            cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
            cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled');

            // Acessar o admin e verificar que o pedido continua REPROVADO após refresh
            cy.visit('/admin');
            cy.get('[data-cy="admin-pedidos"]').click();
            cy.get(`[data-cy="order-status-tag-${codigoPedido}"]`).should('contain.text', 'REPROVADA');

            // Limpar carrinho de Carlos ao finalizar o teste
            cy.request({
              method: 'DELETE',
              url: `http://localhost:5035/api/carrinho/${clienteB.codigo}`,
              failOnStatusCode: false
            });
          });
        });
      });
    });
  });

  // =========================================================================
  // RF0030: Pedido Persistido como EM PROCESSAMENTO (API Real + Interface)
  // =========================================================================
  it('RF0030: Pedido persistido é validado duplamente como EM PROCESSAMENTO na resposta real da API e na interface', () => {
    // 1. Adicionar Corre 4 e ir ao checkout
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

    // 2. Step 1: Avançar
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

    // 3. Step 2: Selecionar cartão e avançar
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');
    cy.get('[data-cy^="chk-card-"]').first().check();
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // 4. Step 3: Confirmar pedido e interceptar a resposta formal de POST /api/pedidos
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').click();

    // 5. Validação rigorosa da resposta real do backend
    cy.wait('@postPedido').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const resBody = interception.response?.body;

      // Status deve ser estritamente "EM PROCESSAMENTO"
      expect(resBody.status).to.eq('EM PROCESSAMENTO');
      // Código de pedido deve ser estruturado RW-2026-XXXX
      expect(resBody.codigo).to.match(/^RW-2026-\d{4}$/);
      // Deve conter itens e totais calculados
      expect(resBody.itens).to.be.an('array').that.is.not.empty;
      expect(resBody.subtotal).to.be.greaterThan(0);
      expect(resBody.valorFrete).to.be.greaterThan(0);
      expect(resBody.valorTotal).to.eq(resBody.subtotal + resBody.valorFrete);

      // 6. Validação rigorosa na interface (DOM da tela de confirmação)
      cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
      cy.get('[data-cy="confirmed-order-code"]').should('have.text', resBody.codigo);
      cy.get('[data-cy="confirmed-order-status"]').should('have.text', 'EM PROCESSAMENTO');
      cy.get('[data-cy="confirmed-order-total"]').should('contain.text', resBody.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    });
  });
});
