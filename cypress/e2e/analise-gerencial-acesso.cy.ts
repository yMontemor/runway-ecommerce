/**
 * Suíte E2E: Restrição de Acesso à Análise Gerencial ao Perfil Administrador (Cenário 7 / RF0055).
 * Cartão 04 - RunWay E-Commerce
 * 
 * Valida que:
 * 1. Chamadas diretas à API sem credencial administrativa retornam HTTP 401 Unauthorized.
 * 2. Chamadas diretas à API com credencial inválida retornam HTTP 401 Unauthorized.
 * 3. Chamadas diretas à API com credencial administrativa válida retornam HTTP 200 OK.
 * 4. Na interface, usuários com perfil Cliente são bloqueados visualmente de acessar os dados da análise.
 * 5. Na interface, o Administrador consegue desbloquear e visualizar a análise sob demanda com sua credencial.
 * 6. A credencial é mantida estritamente em memória e descartada ao alternar de perfil ou bloquear a sessão.
 */

describe('Cenário 7: Controle de Acesso à Análise Gerencial de Vendas (RF0055)', () => {
  const backendBaseUrl = 'http://localhost:5035';
  let adminKey = '';

  before(() => {
    // Garantir preparação inicial da massa de testes determinística do Cartão 02
    cy.task('prepararMassaAnalise');

    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'Variável de ambiente externa RUNWAY_ADMIN_KEY deve estar configurada').to.be.a('string').and.not.be.empty;
    });
  });

  after(() => {
    // Restauração obrigatória da massa determinística do Cartão 02 ao concluir a suíte
    cy.task('prepararMassaAnalise');
  });

  beforeEach(() => {
    // Limpeza de sessão antes de cada teste
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  // -------------------------------------------------------------
  // VALIDAÇÕES DA API (BACKEND)
  // -------------------------------------------------------------

  it('7.1 - API: Chamada direta a GET /api/analise/vendas sem credencial deve retornar HTTP 401 Unauthorized', () => {
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.body).to.have.property('erro');
      expect(response.body.erro).to.include('Acesso não autorizado');
    });
  });

  it('7.2 - API: Chamada direta com credencial inválida deve retornar HTTP 401 Unauthorized', () => {
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO`,
      headers: {
        'Authorization': 'Bearer credencial_incorreta_proposital'
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.body).to.have.property('erro');
      expect(response.body.erro).to.include('Credencial administrativa ausente ou inválida');
    });
  });

  it('7.3 - API: Chamada com credencial administrativa válida deve retornar HTTP 200 OK e dados consolidados', () => {
    cy.request({
      method: 'GET',
      url: `${backendBaseUrl}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O`,
      headers: {
        'Authorization': `Bearer ${adminKey}`
      }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('totalGeral', 7850.09);
      expect(response.body).to.have.property('periodoInicial', '2025-11');
      expect(response.body).to.have.property('periodoFinal', '2026-03');
      expect(response.body.series).to.have.length(2);
    });
  });

  // -------------------------------------------------------------
  // VALIDAÇÕES DA INTERFACE (FRONTEND)
  // -------------------------------------------------------------

  it('7.4 - Interface: Perfil Cliente tentando acessar Análise Gerencial deve visualizar barreira de bloqueio sem acesso aos dados', () => {
    // 1. Acessa a aplicação na rota inicial (inicia como perfil Cliente)
    cy.visit('/');

    // 2. Tenta navegar diretamente para a rota administrativa
    cy.visit('/admin');

    // 3. Clica na aba Análise
    cy.get('[data-cy="admin-analise"]').click();

    // 4. Confirma que a barreira de proteção visual para Cliente está visível
    cy.get('[data-cy="analise-acesso-bloqueado-cliente"]').should('be.visible');
    cy.contains('Acesso Restrito — Análise Gerencial').should('be.visible');
    cy.contains('CLIENTE').should('be.visible');

    // 5. Confirma que os dados da análise e gráficos NÃO estão renderizados no DOM
    cy.get('[data-cy="admin-auth-status"]').should('not.exist');
    cy.get('.admin-header-row').should('not.exist');
    cy.get('.analytics-chart-card').should('not.exist');
  });

  it('7.5 - Interface: Modo Administrador desbloqueia a análise sob demanda com a credencial correta', () => {
    cy.visit('/admin');

    // Clica na aba Análise (estando inicialmente como Cliente)
    cy.get('[data-cy="admin-analise"]').click();
    cy.get('[data-cy="analise-acesso-bloqueado-cliente"]').should('be.visible');

    // Alterna para perfil Administrador
    cy.get('[data-cy="btn-alternar-admin"]').click();

    // O prompt de chave de acesso administrativo sob demanda deve aparecer
    cy.get('[data-cy="analise-prompt-chave"]').should('be.visible');
    cy.get('[data-cy="input-chave-admin"]').should('be.visible');

    // Tentativa 1: Informar chave errada
    cy.get('[data-cy="input-chave-admin"]').type('chave_incorreta_teste');
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    // Deve exibir mensagem de erro de autenticação e permanecer bloqueado
    cy.get('[data-cy="msg-erro-autenticacao"]').should('be.visible').and('contain.text', 'Credencial administrativa ausente ou inválida');
    cy.get('[data-cy="admin-auth-status"]').should('not.exist');

    // Tentativa 2: Informar chave válida fornecida externamente (com log: false para segurança)
    cy.get('[data-cy="input-chave-admin"]').clear().type(adminKey, { log: false });
    cy.get('[data-cy="btn-desbloquear-analise"]').click();

    // Deve desbloquear com sucesso e exibir a barra de status autenticada
    cy.get('[data-cy="admin-auth-status"]').should('be.visible');
    cy.contains('Administrador Autenticado').should('be.visible');

    // Deve exibir o painel de análise com filtros e cabeçalho
    cy.get('.admin-header-row').should('be.visible');
    cy.contains('ANÁLISE DE VENDAS').should('be.visible');
  });

  it('7.6 - Interface: A credencial administrativa é descartada ao bloquear a sessão ou retornar à loja', () => {
    // 1. Acessa como Admin e desbloqueia
    cy.visit('/admin');
    cy.get('[data-cy="admin-analise"]').click();
    cy.get('[data-cy="btn-alternar-admin"]').click();
    cy.get('[data-cy="input-chave-admin"]').type(adminKey, { log: false });
    cy.get('[data-cy="btn-desbloquear-analise"]').click();
    cy.get('[data-cy="admin-auth-status"]').should('be.visible');

    // 2. Clica em Bloquear Acesso
    cy.get('[data-cy="btn-bloquear-sessao"]').click();

    // 3. A sessão em memória deve ser limpa e a tela deve voltar ao estado de solicitação de chave
    cy.get('[data-cy="analise-prompt-chave"]').should('be.visible');
    cy.get('[data-cy="admin-auth-status"]').should('not.exist');
    cy.get('.admin-header-row').should('not.exist');
  });
});
