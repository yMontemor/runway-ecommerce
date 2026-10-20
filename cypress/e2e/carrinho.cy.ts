describe('Cenário 1: Carrinho com múltiplos produtos, alteração de quantidade e validação de estoque', () => {
  let clienteCodigo = '';

  beforeEach(() => {
    // Restaurar estoque original da variação 4 (Corre 4 tam 41) para 20
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });

    // Limpar carrinhos de clientes de teste adicionais para evitar reservas concorrentes
    cy.request({ method: 'DELETE', url: 'http://localhost:5035/api/carrinho/CLI-0005', failOnStatusCode: false });

    // Intercepts de APIs reais
    cy.intercept('GET', '**/api/clientes').as('getClientes');
    cy.intercept('GET', '**/api/produtos*').as('getProdutos');
    cy.intercept('POST', '**/api/produtos/validar-estoque').as('validarEstoque');

    // Localiza dinamicamente o cliente padrão do seed por e-mail
    cy.obterClientePrincipal().then((cliente) => {
      clienteCodigo = cliente.codigo;

      // Acessa home e seleciona cliente ativo
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]', { timeout: 15000 }).should('be.visible').click();
      cy.get(`[data-cy="select-customer-${clienteCodigo}"]`, { timeout: 10000 }).scrollIntoView().should('be.visible').click();
      cy.get('[data-cy="user-dropdown"]').should('contain.text', cliente.nome.split(' ')[0]);

      // Limpar carrinho prévio se houver (persistido e localStorage)
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

  // =========================================================================
  // RF0032: Seleção de quantidade prévia na página de detalhes do produto
  // =========================================================================
  it('RF0032: deve permitir selecionar quantidade maior que 1 na tela de detalhes do produto antes da adição e comprovar entrada no carrinho com a quantidade escolhida', () => {
    // 1. Navegar até a página de detalhes do Corre 4 pelo catálogo
    cy.get('[data-cy="nav-catalogo"]').click();
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid', { timeout: 10000 }).should('be.visible');
    cy.get('[data-cy="product-card-olympikus_corre_4"]').should('be.visible');
    cy.get('[data-cy="product-card-olympikus_corre_4"]').find('.card-btn-details').click();
    cy.url().should('include', '/produto/olympikus_corre_4');
    cy.get('.product-buy-card').should('be.visible');
    cy.contains('.product-name', 'Corre 4').should('be.visible');

    // 2. Selecionar tamanho 41
    cy.get('.detail-sizes-grid').contains('button.detail-size-btn', '41').click();
    cy.get('.detail-sizes-grid').contains('button.detail-size-btn', '41').should('have.class', 'active');

    // 3. Alterar quantidade no seletor para 2 unidades antes de adicionar
    cy.get('.quantity-selector').within(() => {
      cy.get('.quantity-value').should('have.text', '1');
      cy.contains('button', '+').click();
      cy.get('.quantity-value').should('have.text', '2');
    });

    // 4. Confirmar adição ao carrinho
    cy.get('.buy-add-btn').click();
    cy.get('.add-success-feedback').should('be.visible').and('contain.text', 'Corre 4');

    // 5. Acessar o carrinho pelo header
    cy.get('[data-cy="nav-carrinho"]').click();
    cy.url().should('include', '/carrinho');

    // 6. Comprovar que o produto entrou com quantidade 2 e subtotal calculado (2 x 449,90 = 899,80)
    cy.get('[data-cy="cart-items-list"]').should('be.visible');
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="cart-item-qty"]').should('contain.text', '2');
      cy.get('[data-cy="cart-item-subtotal"]').should('contain.text', '899,80');
    });
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '899,80');
    cy.get('[data-cy="cart-total-value"]').should('contain.text', '899,80');
  });

  // =========================================================================
  // RF0031 e RF0032: Múltiplos produtos, alteração +/-, validação de estoque e remoção
  // =========================================================================
  it('RF0031 e RF0032: deve adicionar múltiplos produtos com tamanhos distintos, alterar quantidade, bloquear excesso de estoque e remover item pela lixeira com recálculo dos totais', () => {
    // 1. Acessar o catálogo
    cy.get('[data-cy="nav-catalogo"]').click();
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid').should('be.visible');

    // 2. Adicionar primeiro produto: Corre 4, Tamanho 41
    cy.get('[data-cy="product-card-olympikus_corre_4"]').should('be.visible').scrollIntoView();
    cy.get('[data-cy="product-card-olympikus_corre_4"] [data-cy="btn-card-adicionar"]').click();
    cy.get('[data-cy="btn-tamanho-41"]').should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();

    // 3. Adicionar segundo produto: Pegasus 41, Tamanho 40
    cy.get('[data-cy="product-card-nike_pegasus_41"]').should('be.visible').scrollIntoView();
    cy.get('[data-cy="product-card-nike_pegasus_41"] [data-cy="btn-card-adicionar"]').click();
    cy.get('[data-cy="btn-tamanho-40"]').should('be.visible').click();
    cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();

    // 4. Acessar o carrinho pela navegação do header
    cy.get('[data-cy="nav-carrinho"]').click();
    cy.url().should('include', '/carrinho');

    // 5. Confirmar presença de ambos os itens no carrinho
    cy.get('[data-cy="cart-items-list"]').should('be.visible');
    cy.get('[data-cy="cart-item-row"]').should('have.length', 2);
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').should('be.visible').and('contain.text', 'Tam: 41');
    cy.contains('[data-cy="cart-item-row"]', 'Pegasus 41').should('be.visible').and('contain.text', 'Tam: 40');

    // Salvar valores iniciais
    // Corre 4 (449,90) + Pegasus 41 (550,99) = Subtotal R$ 1.000,89 (Frete calculado no checkout/endereço)
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '1.000,89');
    cy.get('[data-cy="cart-total-value"]').should('contain.text', '1.000,89');

    // 6. Alterar a quantidade do Corre 4 para mais (+)
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
      cy.get('[data-cy="cart-item-subtotal"]').should('contain.text', '449,90');
      cy.get('[data-cy="btn-increase-qty"]').click();
    });
    cy.wait('@validarEstoque');

    // Confirmar recálculo do item e total: 2 x 449,90 = 899,80; total = 899,80 + 550,99 = 1.450,79
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="cart-item-qty"]').should('contain.text', '2');
      cy.get('[data-cy="cart-item-subtotal"]').should('contain.text', '899,80');
    });
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '1.450,79');
    cy.get('[data-cy="cart-total-value"]').should('contain.text', '1.450,79');

    // 7. Alterar para menos (-)
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="btn-decrease-qty"]').click();
    });

    // Confirmar retorno da quantidade e recálculo
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
      cy.get('[data-cy="cart-item-subtotal"]').should('contain.text', '449,90');
    });
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '1.000,89');
    cy.get('[data-cy="cart-total-value"]').should('contain.text', '1.000,89');

    // 8. Tentar exceder quantidade máxima de estoque e confirmar feedback visual/bloqueio
    // Calibrar estoque da variação 4 (Corre 4 tam 41) para exatamente 1 unidade no banco
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 1 });

    // O item já tem 1 unidade no carrinho. Clicar em (+) tenta solicitar 2 unidades, excedendo o estoque
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="btn-increase-qty"]').click();
    });
    cy.wait('@validarEstoque');

    // Confirmar feedback visual de bloqueio de estoque
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').within(() => {
      cy.get('[data-cy="cart-quantity-error"]')
        .should('be.visible')
        .and('contain.text', 'unidade disponível deste produto');
      // Quantidade permanece inalterada em 1
      cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
    });

    // 9. RF0031: Remover item pela lixeira e validar recálculo dos totais
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').find('[data-cy="btn-remove-item"]').click();

    // Comprovar que a lista agora contém apenas 1 item
    cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
    cy.contains('[data-cy="cart-item-row"]', 'Corre 4').should('not.exist');
    cy.contains('[data-cy="cart-item-row"]', 'Pegasus 41').should('be.visible');

    // Comprovar recálculo automático do subtotal e total para o valor apenas do Pegasus 41 (R$ 550,99)
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '550,99');
    cy.get('[data-cy="cart-total-value"]').should('contain.text', '550,99');

    // 10. Confirmar que o botão de checkout continua visível e habilitado para o item restante
    cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled');
  });

  // =========================================================================
  // RN0032: Mudança real de estoque entre montagem do carrinho e finalização
  // =========================================================================
  it('RN0032: deve orientar ajuste automático de quantidade, remoção de itens indisponíveis e exibir aviso ao cliente quando houver mudança real de estoque', () => {
    // 1. Garantir estoque inicial suficiente (20)
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 20 });

    // 2. Adicionar 2 unidades do Corre 4 (tam 41)
    cy.get('[data-cy="nav-catalogo"]').click();
    cy.url().should('include', '/catalogo');
    cy.get('.products-grid', { timeout: 10000 }).should('be.visible');
    cy.get('[data-cy="product-card-olympikus_corre_4"]').find('.card-btn-details').click();
    cy.get('.detail-sizes-grid').contains('button.detail-size-btn', '41').click();
    cy.get('.quantity-selector').within(() => {
      cy.contains('button', '+').click();
      cy.get('.quantity-value').should('have.text', '2');
    });
    cy.get('.buy-add-btn').click();
    cy.get('.add-success-feedback').should('be.visible');

    // 3. Comprovar que o carrinho tem 2 unidades
    cy.get('[data-cy="nav-carrinho"]').click();
    cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
    cy.get('[data-cy="cart-item-qty"]').should('contain.text', '2');

    // 4. Simular alteração concorrente de estoque no banco: reduzir para 1 unidade
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 1 });

    // 5. Ao recarregar o carrinho, o backend revalida (RN0032), ajusta a quantidade para 1 e emite aviso
    cy.visit('/carrinho');
    cy.get('[data-cy="cart-stock-adjustment-notice"]').should('be.visible').and('contain.text', 'de 2 para 1 un.');
    cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
    cy.get('[data-cy="cart-subtotal-value"]').should('contain.text', '449,90');

    // 6. Simular esgotamento total do estoque no banco: reduzir para 0 unidades
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 0 });

    // 7. Ao recarregar o carrinho, o backend remove o item esgotado e avisa o cliente
    cy.visit('/carrinho');
    cy.get('[data-cy="cart-stock-adjustment-notice"]').should('be.visible').and('contain.text', 'removido');
    cy.get('[data-cy="cart-item-row"]').should('not.exist');
    cy.contains('Seu carrinho está vazio').should('be.visible');
  });

  // =========================================================================
  // CENÁRIO 6: Expiração do carrinho e liberação de reservas (RNF0042, RNF0045, RN0044)
  // =========================================================================
  it('Cenário 6: Expiração determinística do carrinho libera reserva, exibe itens removidos, mantém botão finalizar compra visível e desabilitado e permite reserva por outro cliente', () => {
    // 1. Calibrar estoque da variação 4 para exatamente 1 unidade e obter clientes de teste
    cy.task('ajustarEstoqueVariacao', { variacaoId: 4, quantidade: 1 });

    cy.obterClientePrincipal('ana.silva@email.com').then((clienteA) => {
      cy.obterClientePrincipal('carlos.mendes@email.com').then((clienteB) => {
        // Limpar carrinhos prévios
        cy.request({ method: 'DELETE', url: `http://localhost:5035/api/carrinho/${clienteA.codigo}`, failOnStatusCode: false });
        cy.request({ method: 'DELETE', url: `http://localhost:5035/api/carrinho/${clienteB.codigo}`, failOnStatusCode: false });

        // 2. Adicionar o Corre 4 (tam 41, 1 unidade) ao carrinho de Ana pela interface
        cy.get('[data-cy="nav-catalogo"]').click();
        cy.url().should('include', '/catalogo');
        cy.get('.products-grid', { timeout: 10000 }).should('be.visible');
        cy.get('[data-cy="product-card-olympikus_corre_4"] [data-cy="btn-card-adicionar"]').click();
        cy.get('[data-cy="btn-tamanho-41"]').should('be.visible').click();
        cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();

        // 3. Confirmar que uma reserva válida foi registrada
        cy.get('[data-cy="nav-carrinho"]').click();
        cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
        cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
        cy.get('[data-cy="cart-timer-badge"]').should('be.visible');
        cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled');

        // 4. Provocar a expiração de maneira determinística no ambiente de teste para o carrinho exclusivo de Ana
        cy.task('expirarCarrinhoCliente', { clienteCodigo: clienteA.codigo });

        // 5. Recarregar a página do carrinho
        cy.visit('/carrinho');

        // 6 e 7. Verificar que o backend liberou a reserva e exibe a mensagem com os itens removidos
        cy.get('[data-cy="cart-expired-notice"]').should('be.visible')
          .and('contain.text', 'Reserva Expirada')
          .and('contain.text', 'Corre 4');

        // 8. Confirmar que o item expirado não está mais no carrinho para compra
        cy.get('[data-cy="cart-item-row"]').should('not.exist');

        // 9. Confirmar que o botão Finalizar Compra permanece VISÍVEL, porém DESABILITADO
        cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('be.disabled');

        // 10. Confirmar que outro cliente (Cliente B - Carlos) pode reservar a unidade liberada
        cy.get('[data-cy="user-dropdown"]', { timeout: 15000 }).should('be.visible').click();
        cy.get(`[data-cy="select-customer-${clienteB.codigo}"]`, { timeout: 10000 }).scrollIntoView().should('be.visible').click();
        cy.get('[data-cy="user-dropdown"]').should('contain.text', clienteB.nome.split(' ')[0]);

        // Carlos adiciona o Corre 4 tam 41 (que estava esgotado enquanto Ana o reservava)
        cy.get('[data-cy="nav-catalogo"]').click({ force: true });
        cy.url().should('include', '/catalogo');
        cy.get('.products-grid', { timeout: 20000 }).should('be.visible');
        cy.get('[data-cy="product-card-olympikus_corre_4"] [data-cy="btn-card-adicionar"]').click();
        cy.get('[data-cy="btn-tamanho-41"]').should('be.visible').click();
        cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').click();
        cy.get('[data-cy="btn-confirmar-adicionar-carrinho"]').should('not.exist');

        // Carlos acessa o carrinho e comprova que a unidade liberada foi reservada com sucesso para ele
        cy.get('[data-cy="nav-carrinho"]').click();
        cy.get('[data-cy="cart-item-row"]').should('have.length', 1);
        cy.get('[data-cy="cart-item-qty"]').should('contain.text', '1');
        cy.get('[data-cy="cart-timer-badge"]').should('be.visible');
        cy.get('[data-cy="btn-cart-checkout"]').should('be.visible').and('not.be.disabled');

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
