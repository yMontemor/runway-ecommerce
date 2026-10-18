describe('Suíte E2E: Fluxos de Checkout e Criação de Pedidos (Cenários 2 a 7)', () => {
  let clienteCodigo = '';
  let clienteId = 0;

  beforeEach(() => {
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
      cy.wait(['@getClientes', '@getProdutos']);
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${clienteCodigo}"]`).scrollIntoView().click();
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
    cy.get('[data-cy="nav-catalogo"]').click();
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid').should('be.visible');

    cy.get(`[data-cy="product-card-${produtoId}"]`).should('be.visible');
    cy.get(`[data-cy="product-card-${produtoId}"]`).find('[data-cy="btn-card-adicionar"]').scrollIntoView().click();
    cy.get(`[data-cy="btn-tamanho-${tamanho}"]`).should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();

    cy.get('[data-cy="nav-carrinho"]').click();
    cy.url().should('include', '/carrinho');
    cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled').click();

    cy.url().should('include', '/checkout');
    cy.get('[data-cy="checkout-step-1"]').should('be.visible');
  }

  // =========================================================================
  // CENÁRIO 2: Compra Simples (Endereço existente + 1 Cartão existente)
  // =========================================================================
  it('Cenário 2: Compra simples com endereço cadastrado e 1 cartão cadastrado gera pedido RW-2026-XXXX e limpa carrinho', () => {
    // 1. Adicionar Corre 4 (tam 41) e ir ao checkout
    adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

    // 2. Step 1: Confirmar seleção de endereço existente (SP) e cálculo de frete
    cy.get('[data-cy="checkout-addresses-list"]').should('be.visible');
    cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

    // 3. Step 2: Selecionar 1 cartão existente (o primeiro já é preenchido com o saldo total)
    cy.get('[data-cy="checkout-step-2"]').should('be.visible');
    cy.get('[data-cy="checkout-cards-list"]').should('be.visible');

    // Selecionar primeiro cartão disponível
    cy.get('[data-cy^="chk-card-"]').first().check();

    // Aguardar validação de pagamento e avançar
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // 4. Step 3: Revisão do pedido
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

    // 5. Intercept real do POST /api/pedidos
    cy.wait('@postPedido').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const body = interception.response?.body;
      expect(body.codigo).to.match(/^RW-2026-\d{4}$/);
      expect(body.status).to.eq('EM PROCESSAMENTO');
      expect(body.valorTotal).to.be.greaterThan(0);

      // 6. Step 4: Validar tela de confirmação
      cy.get('[data-cy="order-confirmed-screen"]').should('be.visible');
      cy.get('[data-cy="confirmed-order-code"]').should('contain.text', body.codigo);
      cy.get('[data-cy="confirmed-order-status"]').should('contain.text', 'EM PROCESSAMENTO');
      cy.get('[data-cy="confirmed-order-total"]').should('be.visible');
    });

    // 7. Validar que o carrinho do cliente foi esvaziado após confirmação
    cy.get('[data-cy="nav-carrinho"]').click();
    cy.url().should('include', '/carrinho');
    cy.contains('Seu carrinho está vazio').should('be.visible');
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
  // CENÁRIO 4: Pagamento com Múltiplos Cartões (RN0034: Múltiplos cartões, mínimo R$ 10 cada)
  // =========================================================================
  it('Cenário 4 (RN0034): Pagamento dividido em múltiplos cartões respeitando valor mínimo (>= R$ 10) é validado e processado', () => {
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

    // 4. Distribuir valores: Cartão 1 = R$ 500,00; Cartão 2 = restante R$ 70,99
    cy.get('[data-cy^="input-card-amount-"]').first().clear().type('500.00');
    cy.get('[data-cy^="btn-use-rest-"]').last().click();

    // Confirmar que o saldo restante foi zerado e o formulário habilita avanço
    cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

    // 5. Step 3: Confirmar pedido na revisão
    cy.get('[data-cy="checkout-step-3"]').should('be.visible');
    cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

    // 6. Step 4: Validar tela de confirmação com detalhamento dos cartões
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
  // CENÁRIO 5: Cupom + Cartão com Residual < R$ 10 (RN0035: Cupons + cartão, usar valor máximo dos cupons e permitir residual < R$ 10)
  // =========================================================================
  it('Cenário 5 (RN0035): Cupom que deixa residual de R$ 5,00 no cartão é aceito sem violar regra de mínimo e gera pedido', () => {
    // 1. Preparar cupom dinâmico e exclusivo para residual de R$ 5,00
    cy.task<{ cupomResto5: string; cupomSobra: string }>('prepararCuponsCypress', { clienteId, clienteCodigo })
      .then(({ cupomResto5 }) => {
        // 2. Adicionar Corre 4 (R$ 449,90) + Frete SP (R$ 20,00) = R$ 469,90
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

        // 3. Step 1: Avançar para pagamento
        cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

        // 4. Step 2: Aplicar cupom exclusivo de R$ 464,90
        cy.get('[data-cy="checkout-step-2"]').should('be.visible');
        cy.get('[data-cy="input-coupon-code"]').type(cupomResto5);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');

        // Confirmar saldo restante de exatamente R$ 5,00
        cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '5,00');

        // Selecionar 1 cartão para pagar o residual
        cy.get('[data-cy^="chk-card-"]').first().check();

        // Confirmar que o sistema aceitou o residual de R$ 5,00 sem erro de mínimo
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
  // CENÁRIO 6: Cupom com Valor Superior Gerando Cupom de Troca por Excedente (RN0036)
  // =========================================================================
  it('Cenário 6 (RN0036): Cupom superior ao total dispensa cartão e gera novo cupom de troca com valor excedente na confirmação', () => {
    // 1. Preparar cupom dinâmico e exclusivo com valor de R$ 600,00
    cy.task<{ cupomResto5: string; cupomSobra: string }>('prepararCuponsCypress', { clienteId, clienteCodigo })
      .then(({ cupomSobra }) => {
        // 2. Adicionar Corre 4 (R$ 449,90) + Frete SP (R$ 20,00) = R$ 469,90
        // Excedente esperado: R$ 600,00 - R$ 469,90 = R$ 130,10
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);

        // 3. Step 1: Avançar para pagamento
        cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();

        // 4. Step 2: Aplicar cupom de R$ 600,00
        cy.get('[data-cy="checkout-step-2"]').should('be.visible');
        cy.get('[data-cy="input-coupon-code"]').type(cupomSobra);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');

        // Confirmar que a compra está 100% coberta por cupom e dispensa cartões
        cy.get('[data-cy="zero-cards-needed-msg"]').should('be.visible');
        cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '0,00');

        // Avançar para revisão
        cy.get('[data-cy="btn-go-to-review"]').should('be.visible').and('not.be.disabled').click();

        // 5. Step 3: Revisão e confirmação
        cy.get('[data-cy="checkout-step-3"]').should('be.visible');
        cy.contains('Prévia de Novo Cupom de Troca a Gerar').should('be.visible');
        cy.get('[data-cy="btn-confirm-order"]').should('be.visible').and('not.be.disabled').click();

        // 6. Step 4: Validar geração real do novo cupom de troca por excedente
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
  // RN0036: Rejeição de cupom desnecessário/supérfluo quando a compra já está 100% coberta
  // =========================================================================
  it('RN0036: deve impedir a utilização de cupom desnecessário quando o valor da compra já está 100% coberto', () => {
    cy.task<{ cupomSobra: string; cupomSuperfluo: string }>('prepararCuponsCypress', { clienteId, clienteCodigo })
      .then(({ cupomSobra, cupomSuperfluo }) => {
        // Compra Corre 4 = Total R$ 469,90 com frete
        adicionarProdutoEIrAoCheckout('olympikus_corre_4', 41);
        cy.get('[data-cy="btn-go-to-payment"]').should('be.visible').and('not.be.disabled').click();
        cy.get('[data-cy="checkout-step-2"]').should('be.visible');

        // 1. Aplicar cupom de R$ 600,00 (já cobre 100% da compra e zera o saldo restante)
        cy.get('[data-cy="input-coupon-code"]').type(cupomSobra);
        cy.get('[data-cy="btn-apply-coupon"]').click();
        cy.get('[data-cy="coupon-success-message"]').should('be.visible');
        cy.get('[data-cy="checkout-remaining-balance"]').should('contain.text', '0,00');

        // 2. Tentar aplicar um segundo cupom desnecessário de R$ 40,00
        cy.get('[data-cy="input-coupon-code"]').type(cupomSuperfluo);
        cy.get('[data-cy="btn-apply-coupon"]').click();

        // 3. Comprovar que o backend rejeitou na validação contínua e a UI exibiu a mensagem funcional
        cy.wait('@validarPagamento').then((interception) => {
          expect(interception.response?.statusCode).to.eq(400);
        });

        cy.get('[data-cy="payment-validation-warning"]')
          .should('be.visible')
          .and('contain.text', 'é desnecessário, pois o valor da compra já foi totalmente coberto');

        // 4. Comprovar que o avanço para revisão permanece bloqueado
        cy.get('[data-cy="btn-go-to-review"]').should('be.disabled');
      });
  });

  // =========================================================================
  // CENÁRIO 7: Pedido Persistido como EM PROCESSAMENTO (API Real + Interface)
  // =========================================================================
  it('Cenário 7: Pedido persistido é validado duplamente como EM PROCESSAMENTO na resposta real da API e na interface', () => {
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
