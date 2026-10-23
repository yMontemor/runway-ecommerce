/**
 * Suíte E2E: Navegação Administrativa e Controle de Acesso (Cenário 7 / RF0055).
 * Cartão 04 - RunWay E-Commerce (Alternativa C Controlada - Protótipo Acadêmico Demonstrativo)
 * 
 * Validações obrigatórias:
 * 1. Perfil Cliente não possui acesso à análise pela navegação demonstrativa da loja.
 * 2. Acesso direto à rota /admin no modo Cliente apresenta barreira demonstrativa e não ativa perfil Administrador automaticamente.
 * 3. Entrada explícita no modo Administrador via menu superior ativa perfil Administrador.
 * 4. Disponibilidade das quatro seções administrativas (Clientes, Pedidos, Trocas, Análise).
 * 5. Abertura direta da Análise Gerencial sem formulário ou solicitação de chave administrativa.
 * 6. "Voltar à Loja" restaura o perfil Cliente e o cliente anteriormente selecionado, navegando para /.
 * 7. Seleção de outro cliente no menu superior ativa esse cliente e retorna à loja /.
 * 8. API: Endpoint de análise /api/analise/vendas acessível diretamente retornando HTTP 200 com dados consolidados.
 */

describe('Cenário 7: Navegação Administrativa Demonstrativa e Acesso à Análise (RF0055)', () => {
  const backendBaseUrl = 'http://localhost:5035';

  before(() => {
    // Garantir preparação inicial da massa de testes determinística do Cartão 02
    cy.task('prepararMassaAnalise');
  });

  after(() => {
    // Restauração obrigatória da massa determinística do Cartão 02 ao concluir a suíte
    cy.task('prepararMassaAnalise');
  });

  beforeEach(() => {
    // Limpeza de sessão antes de cada teste para garantir isolamento determinístico
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  // -------------------------------------------------------------
  // VALIDAÇÕES DA INTERFACE (FRONTEND)
  // -------------------------------------------------------------

  it('7.1 - Navegação da Loja (Modo Cliente): Não exibe links de análise gerencial no fluxo comum do cliente', () => {
    cy.visit('/');

    // Confirma que a navegação padrão de cliente está presente
    cy.get('[data-cy="nav-catalogo"]').should('be.visible');
    cy.get('[data-cy="nav-carrinho"]').should('be.visible');
    cy.get('[data-cy="nav-perfil"]').should('be.visible');

    // Confirma que a barra de navegação comum não contém link para análise
    cy.get('.header-nav').within(() => {
      cy.contains('Análise').should('not.exist');
      cy.contains('Painel Administrativo').should('not.exist');
    });

    // O botão de alternância do cabeçalho indica perfil Cliente (não exibe badge de Admin ativo)
    cy.get('[data-cy="user-dropdown"]').should('not.have.class', 'admin-user-btn');
  });

  it('7.2 - Acesso Direto à Rota /admin no Modo Cliente: Apresenta barreira demonstrativa e preserva o modo Cliente mesmo após recarregar a página', () => {
    // 1. Acessa a rota administrativa diretamente estando em modo Cliente
    cy.visit('/admin');

    // 2. Confirma apresentação da barreira demonstrativa de proteção
    cy.get('[data-cy="admin-acesso-restrito-cliente"]').should('be.visible');
    cy.contains('Acesso Restrito — Painel Administrativo').should('be.visible');

    // 3. Confirma que o painel administrativo e suas seções NÃO foram renderizados
    cy.get('[data-cy="admin-clientes"]').should('not.exist');
    cy.get('[data-cy="admin-analise"]').should('not.exist');
    cy.get('[data-cy="form-filtros-analise"]').should('not.exist');

    // 4. Recarregar a página para verificar que a recarga não ativa automaticamente o modo Administrador
    cy.reload();
    cy.get('[data-cy="admin-acesso-restrito-cliente"]').should('be.visible');
    cy.get('[data-cy="admin-clientes"]').should('not.exist');

    // 5. Clica no botão "Voltar à Loja" da barreira
    cy.get('[data-cy="btn-voltar-loja-bloqueio"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('7.3 - Entrada Explícita no Modo Administrador: Ativa o modo Administrador e disponibiliza as quatro seções', () => {
    cy.visit('/');

    // 1. Abre o menu dropdown de perfis no cabeçalho
    cy.get('[data-cy="user-dropdown"]').click();

    // 2. Clica explicitamente em "Painel Administrativo"
    cy.get('[data-cy="painel-admin"]').should('be.visible').click();

    // 3. Deve navegar para /admin
    cy.url().should('include', '/admin');

    // 4. O botão de perfil no cabeçalho deve indicar o modo Administrador ativo
    cy.get('[data-cy="user-dropdown"]').should('have.class', 'admin-user-btn').and('contain.text', 'Admin');

    // 5. As quatro seções administrativas obrigatórias devem estar disponíveis na barra lateral
    cy.get('[data-cy="admin-clientes"]').should('be.visible');
    cy.get('[data-cy="admin-pedidos"]').should('be.visible');
    cy.get('[data-cy="admin-trocas"]').should('be.visible');
    cy.get('[data-cy="admin-analise"]').should('be.visible');
  });

  it('7.4 - Abertura Direta da Análise Gerencial: Abre filtros e gráfico sem solicitar chave administrativa', () => {
    // 1. Entrada explícita no modo Administrador
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get('[data-cy="painel-admin"]').click();
    cy.url().should('include', '/admin');

    // 2. Clica na aba "Análise"
    cy.get('[data-cy="admin-analise"]').click();

    // 3. Filtros gerenciais e categorias devem abrir diretamente
    cy.get('[data-cy="form-filtros-analise"]').should('be.visible');
    cy.get('[data-cy="lista-categorias-filtro"]').should('be.visible');
    cy.contains('ANÁLISE DE VENDAS').should('be.visible');

    // 4. Nenhum formulário ou prompt de chave administrativa deve ser exibido
    cy.get('[data-cy="input-chave-admin"]').should('not.exist');
    cy.get('[data-cy="analise-prompt-chave"]').should('not.exist');
    cy.get('[data-cy="btn-desbloquear-analise"]').should('not.exist');
  });

  it('7.5 - Retorno à Loja via "Voltar à Loja": Restaura o cliente anteriormente selecionado e navega para a homepage', () => {
    cy.visit('/');

    // 1. Aguarda carregamento do cliente ativo real da API
    cy.get('[data-cy="user-dropdown"] .user-name').should('not.have.text', 'Cliente');

    // 2. Obtém o nome do cliente que está ativo inicialmente
    let nomeClienteOriginal = '';
    cy.get('[data-cy="user-dropdown"] .user-name').invoke('text').then((texto) => {
      nomeClienteOriginal = texto.trim();
      expect(nomeClienteOriginal).to.not.be.empty;

      // 3. Entra no modo Administrador
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get('[data-cy="painel-admin"]').click();
      cy.url().should('include', '/admin');
      cy.get('[data-cy="user-dropdown"]').should('contain.text', 'Admin');

      // 4. Clica em "Voltar à Loja" na barra lateral administrativa
      cy.get('[data-cy="btn-admin-voltar-loja"]').click();

      // 5. Navega para a homepage /
      cy.url().should('eq', Cypress.config().baseUrl + '/');

      // 6. O cliente anteriormente selecionado deve ter sido restaurado com precisão
      cy.get('[data-cy="user-dropdown"] .user-name').should('have.text', nomeClienteOriginal);
      cy.get('[data-cy="user-dropdown"]').should('not.have.class', 'admin-user-btn');
    });
  });

  it('7.6 - Seleção de Outro Cliente no Menu: Ativa o cliente selecionado e retorna à loja', () => {
    // 1. Entra no modo Administrador
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"] .user-name').should('not.have.text', 'Cliente');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get('[data-cy="painel-admin"]').click();
    cy.url().should('include', '/admin');
    cy.get('[data-cy="user-dropdown"]').should('contain.text', 'Admin');

    // 2. Abre o menu dropdown no topo enquanto Administrador
    cy.get('[data-cy="user-dropdown"]').click();

    // 3. Seleciona um cliente na lista de clientes (primeiro disponível)
    cy.get('.dropdown-customers-list button').first().then(($btn) => {
      const nomeClienteClicado = $btn.find('.cust-name-text').text().trim();
      cy.wrap($btn).click();

      // 4. Deve navegar de volta à loja /
      cy.url().should('eq', Cypress.config().baseUrl + '/');

      // 5. O modo Administrador foi desativado e o cliente selecionado agora está ativo
      cy.get('[data-cy="user-dropdown"]').should('not.have.class', 'admin-user-btn');
      cy.get('[data-cy="user-dropdown"] .user-name').should('have.text', nomeClienteClicado);
    });
  });

  // -------------------------------------------------------------
  // VALIDAÇÃO DA API (BACKEND)
  // -------------------------------------------------------------

  it('7.7 - API: Chamada direta a GET /api/analise/vendas retorna HTTP 200 e dados consolidados (sem autenticação)', () => {
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O`
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('totalGeral', 7850.09);
      expect(response.body).to.have.property('periodoInicial', '2025-11');
      expect(response.body).to.have.property('periodoFinal', '2026-03');
      expect(response.body.series).to.have.length(2);
    });
  });
});
