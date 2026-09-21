/**
 * SUÍTE DE TESTES E2E — INATIVAÇÃO DE CLIENTE (RUNWAY)
 * 
 * ESCOPO E COBERTURA:
 * Suíte Cypress E2E cobrindo integralmente o fluxo de Inativação de Cliente (RF0023),
 * a integração com consulta por situação cadastral (RF0024) e as regras de integridade
 * de negócio do RunWay (bloqueio de compras para clientes inativos).
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0023: O sistema deve possibilitar que clientes sejam inativados.
 *           Implementação: soft delete / status inativo. Preserva o registro físico no banco
 *           (ativo = false) e todos os dados cadastrais, sem exclusão física (DELETE).
 *           Sem fluxo de reativação nem exigência de categorias/motivo de inativação (fidelidade ao DRS).
 * - RF0024: Consulta de clientes — integração com o filtro por situação cadastral (ATIVO / INATIVO).
 * - RNF0012: Log de Auditoria — a inativação é uma escrita auditada no sistema.
 *            (Ressalva Técnica Obrigatória: O Cypress comprova a execução funcional da operação
 *             ponta a ponta; a comprovação do registro na tabela LOG_AUDITORIA pertence à evidência
 *             complementar de backend/banco).
 * - Regra de Integridade RunWay: Cliente com cadastro inativo não pode realizar compras nem adicionar
 *                                produtos ao carrinho de compras.
 * 
 * CONTEXTO DE EXECUÇÃO:
 * - Painel Administrativo (/admin?tab=clientes) para gestão pelo administrador;
 * - Área do Cliente (/cliente) para auto-inativação pelo cliente atualmente selecionado/ativo na aplicação,
 *   já que o RunWay não possui autenticação/login por orientação do professor.
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> PATCH /api/clientes/{codigo}/inativar -> ASP.NET Core -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma resposta da API de inativação é mockada.
 * Clientes de controle reais são criados dinamicamente via API REST antes de cada teste.
 */

describe('Suíte E2E: Inativação de Cliente — RunWay (RF0023 / Integração RF0024 / Integridade RunWay)', () => {

  interface ClienteControle {
    id: number;
    codigo: string;
    nome: string;
    email: string;
    cpf: string;
    cpfFormatado: string;
    genero: string;
    dataNascimento: string; // YYYY-MM-DD
    telefone: {
      tipo: string;
      ddd: string;
      numero: string;
    };
  }

  /**
   * Gera CPF matematicamente válido com dígitos verificadores
   */
  function gerarCpfValido(): string {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const sum1 = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
    const d1 = (sum1 * 10) % 11 % 10;
    const sum2 = [...digits, d1].reduce((acc, d, i) => acc + d * (11 - i), 0);
    const d2 = (sum2 * 10) % 11 % 10;
    return [...digits, d1, d2].join('');
  }

  /**
   * Aplica máscara de CPF XXX.XXX.XXX-XX
   */
  function formatarCpf(raw: string): string {
    const d = raw.replace(/\D/g, '');
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }

  /**
   * Cria um cliente de controle real no PostgreSQL via API REST do RunWay.
   */
  function criarClienteControleApi(dados?: Partial<{
    nome: string;
    email: string;
    cpf: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Inativacao ${ts}`;
    const email = dados?.email || `cypress.inativacao.${ts}@runway.test`;

    return cy.request({
      method: 'POST',
      url: 'http://localhost:5035/api/clientes',
      body: {
        nome,
        email,
        cpf: cpfRaw.replace(/\D/g, ''),
        genero: 'Feminino',
        dataNascimento: '1995-04-12',
        senha: 'Senha@Forte2026!',
        confirmacaoSenha: 'Senha@Forte2026!',
        telefone: {
          tipo: 'Celular',
          ddd: '11',
          numero: '977778888'
        },
        enderecos: [
          {
            nome: 'Residencial Inativacao',
            tipoResidencia: 'Casa',
            tipoLogradouro: 'Rua',
            logradouro: 'Rua da Inativação de Testes',
            numero: '100',
            complemento: 'Bloco A',
            bairro: 'Centro',
            cep: '01001000',
            cidade: 'São Paulo',
            estado: 'SP',
            pais: 'Brasil',
            observacoes: null,
            residencial: true,
            entrega: true,
            cobranca: true
          }
        ]
      }
    }).then(res => {
      expect(res.status).to.eq(201);
      const b = res.body;
      return {
        id: b.id,
        codigo: b.codigo,
        nome: b.nome,
        email: b.email,
        cpf: b.cpf,
        cpfFormatado: formatarCpf(b.cpf),
        genero: b.genero,
        dataNascimento: b.dataNascimento,
        telefone: {
          tipo: b.telefone?.tipo || 'Celular',
          ddd: b.telefone?.ddd || '11',
          numero: b.telefone?.numero || '977778888'
        }
      };
    });
  }

  /**
   * Consulta cliente real via API REST do RunWay.
   * A consulta real GET /api/clientes?codigo=..., processada pelo backend ASP.NET Core e EF Core contra o PostgreSQL,
   * confirmou que o registro continua existente com ativo = false.
   */
  function consultarClientePorCodigoApi(codigo: string): Cypress.Chainable<any> {
    return cy.request({
      method: 'GET',
      url: `http://localhost:5035/api/clientes?codigo=${encodeURIComponent(codigo)}`
    }).then(res => {
      expect(res.status).to.eq(200);
      const lista = res.body as any[];
      return lista.find(c => c.codigo === codigo || c.id === codigo) || lista[0];
    });
  }

  // =========================================================================
  // TESTE 1 — INATIVAÇÃO PELO PAINEL ADMINISTRATIVO (RF0023)
  // =========================================================================
  it('TESTE 1 — RF0023: Inativação de cliente com sucesso pelo Painel Administrativo', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/inativar`).as('inativarClienteAdmin');

      // 1. Acessa o Painel Administrativo na aba de clientes
      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // 2. Localiza o cliente de controle pelo código
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      // 3. Abre a visualização detalhada do cliente
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .should('be.visible')
        .find('[data-cy="cliente-detalhes-btn"]')
        .click();

      // 4. Confirma visualização de detalhes e situação inicial ATIVO
      cy.get('[data-cy="detalhe-cliente-codigo"]').should('contain', cliente.codigo);
      cy.get('[data-cy="cliente-inativar-btn"]')
        .should('be.visible')
        .and('contain', 'Inativar Cadastro');

      // 5. Aciona o botão de inativação para abrir o modal de confirmação
      cy.get('[data-cy="cliente-inativar-btn"]').click();

      // 6. Confirma a ação no modal de confirmação
      cy.get('[data-cy="confirmar-inativacao"]')
        .should('be.visible')
        .click();

      // 7. Valida a requisição real PATCH e resposta HTTP 200 OK
      cy.wait('@inativarClienteAdmin').then(interception => {
        expect(interception.response?.statusCode).to.eq(200);
        expect(interception.response?.body?.mensagem).to.contain('Cliente inativado com sucesso');
      });

      // 8. O sistema fecha os detalhes e recarrega a tabela de clientes
      cy.wait('@listarClientes');

      // 9. Valida que na tabela de clientes a situação mudou para INATIVO
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .should('be.visible')
        .find('[data-cy="cliente-status-cell"]')
        .should('contain', 'INATIVO');
    });
  });

  // =========================================================================
  // TESTE 2 — REGISTRO NÃO É EXCLUÍDO FISICAMENTE (RF0023 / SOFT DELETE)
  // =========================================================================
  it('TESTE 2 — RF0023: Inativação lógica preserva integralmente o registro e dados cadastrais no banco', () => {
    criarClienteControleApi().then(cliente => {
      // Inativa o cliente via endpoint real da API
      cy.request({
        method: 'PATCH',
        url: `http://localhost:5035/api/clientes/${encodeURIComponent(cliente.codigo)}/inativar`
      }).then(inativarRes => {
        expect(inativarRes.status).to.eq(200);
      });

      // A consulta real GET /api/clientes?codigo=..., processada pelo backend ASP.NET Core e EF Core contra o PostgreSQL,
      // confirmou que o registro continua existente com ativo = false.
      consultarClientePorCodigoApi(cliente.codigo).then(clientePersistido => {
        expect(clientePersistido).to.not.be.null;
        expect(clientePersistido.codigo).to.eq(cliente.codigo);
        expect(clientePersistido.ativo).to.be.false;

        // Comprova que todos os demais dados cadastrais permanecem rigorosamente preservados
        expect(clientePersistido.nome).to.eq(cliente.nome);
        expect(clientePersistido.email).to.eq(cliente.email);
        expect(clientePersistido.cpf).to.eq(cliente.cpf);
        expect(clientePersistido.genero).to.eq(cliente.genero);
        expect(clientePersistido.dataNascimento).to.eq(cliente.dataNascimento);
        expect(clientePersistido.telefone?.numero).to.eq(cliente.telefone.numero);

        // Evidência formal: soft delete / inativação lógica != exclusão física (DELETE)
      });
    });
  });

  // =========================================================================
  // TESTE 3 — PERSISTÊNCIA APÓS RECARREGAMENTO (F5 / CY.RELOAD)
  // =========================================================================
  it('TESTE 3 — RF0023: Persistência real da inativação no PostgreSQL após F5 (cy.reload)', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/inativar`).as('inativarAdmin');

      // Acessa o Admin e inativa o cliente pela interface
      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-detalhes-btn"]')
        .click();

      cy.get('[data-cy="cliente-inativar-btn"]').click();
      cy.get('[data-cy="confirmar-inativacao"]').click();
      cy.wait('@inativarAdmin');
      cy.wait('@listarClientes');

      // Executa recarregamento completo da página (F5)
      cy.reload();
      cy.wait('@listarClientes');

      // Localiza novamente o cliente após o reload
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      // Comprova que o status recuperado pela consulta da API processada pelo backend e EF Core contra o PostgreSQL continua INATIVO
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .should('be.visible')
        .find('[data-cy="cliente-status-cell"]')
        .should('contain', 'INATIVO');
    });
  });

  // =========================================================================
  // TESTE 4 — INTEGRAÇÃO COM FILTRO POR SITUAÇÃO CADASTRAL (RF0023 / RF0024)
  // =========================================================================
  it('TESTE 4 — RF0023 / RF0024: Integração com busca por situação cadastral (filtro INATIVO vs ATIVO)', () => {
    criarClienteControleApi().then(cliente => {
      // Inativa o cliente previamente
      cy.request({
        method: 'PATCH',
        url: `http://localhost:5035/api/clientes/${encodeURIComponent(cliente.codigo)}/inativar`
      }).then(res => expect(res.status).to.eq(200));

      cy.intercept('GET', '**/api/clientes*').as('listarClientes');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Abre painel de filtros avançados
      cy.get('[data-cy="toggle-filtros-avancados"]').click();

      // Preenche código do cliente e seleciona Situação Cadastral: INATIVO
      cy.get('[data-cy="filtro-codigo"]').clear().type(cliente.codigo);
      cy.get('[data-cy="filtro-status"]').select('INATIVO');
      cy.get('[data-cy="btn-aplicar-filtros"]').click();
      cy.wait('@listarClientes');

      // Comprova que o cliente inativado é retornado na busca com filtro INATIVO
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .should('be.visible')
        .find('[data-cy="cliente-status-cell"]')
        .should('contain', 'INATIVO');

      // Altera o filtro para Situação Cadastral: ATIVO mantendo o mesmo código
      cy.get('[data-cy="filtro-status"]').select('ATIVO');
      cy.get('[data-cy="btn-aplicar-filtros"]').click();
      cy.wait('@listarClientes');

      // Comprova que o cliente inativo NÃO é retornado no filtro de ativos
      cy.get('[data-cy="tabela-clientes"]').then($table => {
        expect($table.find(`td:contains("${cliente.codigo}")`).length).to.eq(0);
      });

      // Limpa filtros para restaurar estado
      cy.get('[data-cy="btn-limpar-filtros"]').click();
      cy.wait('@listarClientes');
    });
  });

  // =========================================================================
  // TESTE 5 — CANCELAMENTO DE INATIVAÇÃO NO MODAL (RF0023)
  // =========================================================================
  it('TESTE 5 — RF0023: Cancelar inativação no modal não envia requisição PATCH e mantém cadastro ATIVO', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/inativar`).as('patchInativarNaoEsperado');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-detalhes-btn"]')
        .click();

      // Abre o modal de confirmação
      cy.get('[data-cy="cliente-inativar-btn"]').click();
      cy.get('[data-cy="confirmar-inativacao"]').should('be.visible');

      // Clica em Cancelar
      cy.get('[data-cy="cancelar-inativacao"]').click();

      // Confirma que o modal fechou e o botão de inativar permanece visível na tela de detalhes
      cy.get('[data-cy="confirmar-inativacao"]').should('not.exist');
      cy.get('[data-cy="cliente-inativar-btn"]').should('be.visible');

      // Volta para a tabela de clientes
      cy.get('[data-cy="btn-voltar-clientes"]').click();

      // Valida que o cliente permaneceu ATIVO na tabela
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-status-cell"]')
        .should('contain', 'ATIVO');

      // A consulta real GET /api/clientes?codigo=..., processada pelo backend ASP.NET Core e EF Core contra o PostgreSQL,
      // confirmou que o registro permaneceu com ativo = true.
      consultarClientePorCodigoApi(cliente.codigo).then(c => {
        expect(c.ativo).to.be.true;
      });
    });
  });

  // =========================================================================
  // TESTE 6 — CLIENTE JÁ INATIVO (IDEMPOTÊNCIA E PROTEÇÃO DE INTERFACE)
  // =========================================================================
  it('TESTE 6 — RF0023: Cliente já inativo não exibe botão de inativação e API responde com idempotência', () => {
    criarClienteControleApi().then(cliente => {
      // Inativa previamente o cliente
      cy.request({
        method: 'PATCH',
        url: `http://localhost:5035/api/clientes/${encodeURIComponent(cliente.codigo)}/inativar`
      }).then(res => {
        expect(res.status).to.eq(200);
      });

      cy.intercept('GET', '**/api/clientes*').as('listarClientes');

      // 1. Validação na Interface: botão de inativação não é exibido para cliente já inativo
      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-detalhes-btn"]')
        .click();

      // Botão "Inativar Cadastro" não é exibido para cliente já inativo
      cy.get('[data-cy="cliente-inativar-btn"]').should('not.exist');

      // Aviso "Cadastro Inativo" deve estar visível
      cy.get('[data-cy="cliente-inativo-aviso"]')
        .should('be.visible')
        .and('contain', 'Cadastro Inativo');

      // 2. Validação da API: nova chamada PATCH é tratada de forma idempotente, retornando HTTP 200 com mensagem informativa
      // Ressalva Técnica (RNF0012): A verificação da existência ou ausência de novos registros em LOG_AUDITORIA
      // pertence à evidência complementar de backend/banco referente à RNF0012.
      cy.request({
        method: 'PATCH',
        url: `http://localhost:5035/api/clientes/${encodeURIComponent(cliente.codigo)}/inativar`
      }).then(resIdempotente => {
        expect(resIdempotente.status).to.eq(200);
        expect(resIdempotente.body?.mensagem).to.contain('já está inativo');
      });

      // 3. Status permanece inativo: a consulta real GET /api/clientes?codigo=..., processada pelo backend ASP.NET Core
      // e EF Core contra o PostgreSQL, confirmou que o registro continua existente com ativo = false.
      consultarClientePorCodigoApi(cliente.codigo).then(c => {
        expect(c.ativo).to.be.false;
      });
    });
  });

  // =========================================================================
  // TESTE 7 — ÁREA DO CLIENTE: AUTO-INATIVAÇÃO PELO CLIENTE (RF0023)
  // =========================================================================
  it('TESTE 7 — RF0023: Inativação realizada pelo próprio cliente selecionado na Área do Cliente', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/inativar`).as('inativarCustomerArea');

      // Visita a página inicial
      cy.visit('/');

      // Seleciona o cliente no Dropdown de Usuário
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();

      // Navega para a Área do Cliente via Header (sem recarregar o estado do React)
      cy.get('[data-cy="nav-perfil"]').click();
      cy.url().should('include', '/cliente');

      // Confirma que a conta do cliente está inicialmente ATIVA
      cy.get('[data-cy="perfil-status-badge"]')
        .should('be.visible')
        .and('contain', 'ATIVO');

      // Aciona o botão de inativação no perfil do cliente
      cy.get('[data-cy="perfil-inativar-btn"]')
        .should('be.visible')
        .and('contain', 'INATIVAR MEU CADASTRO')
        .click();

      // Confirma a inativação no modal
      cy.get('[data-cy="perfil-confirmar-inativacao"]')
        .should('be.visible')
        .click();

      // Valida requisição PATCH e status HTTP 200 OK
      cy.wait('@inativarCustomerArea').then(interception => {
        expect(interception.response?.statusCode).to.eq(200);
      });

      // Valida que o badge atualizou para INATIVO
      cy.get('[data-cy="perfil-status-badge"]')
        .should('contain', 'INATIVO');

      // Valida que o botão de inativar não é mais exibido para conta inativa
      cy.get('[data-cy="perfil-inativar-btn"]').should('not.exist');

      // A consulta real GET /api/clientes?codigo=..., processada pelo backend ASP.NET Core e EF Core contra o PostgreSQL,
      // confirmou que o registro continua existente com ativo = false.
      consultarClientePorCodigoApi(cliente.codigo).then(clientePersistido => {
        expect(clientePersistido.ativo).to.be.false;
        expect(clientePersistido.nome).to.eq(cliente.nome);
      });
    });
  });

  // =========================================================================
  // TESTE 8 — REGRA DE INTEGRIDADE RUNWAY: BLOQUEIO DE COMPRAS PARA CLIENTE INATIVO
  // =========================================================================
  it('TESTE 8 — Regra de Integridade RunWay: Cliente inativo é bloqueado para realizar novas compras', () => {
    criarClienteControleApi().then(cliente => {
      // Inativa o cliente previamente
      cy.request({
        method: 'PATCH',
        url: `http://localhost:5035/api/clientes/${encodeURIComponent(cliente.codigo)}/inativar`
      }).then(res => expect(res.status).to.eq(200));

      // Visita a página inicial e seleciona o cliente inativo
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="user-dropdown"]')
        .should('contain', cliente.nome.split(' ')[0]);

      // Acessa o catálogo de calçados via Header (preservando o cliente ativo na aplicação)
      cy.get('[data-cy="nav-catalogo"]').click();
      cy.url().should('include', '/catalogo');

      // Clica em "+ ADICIONAR" no produto do catálogo
      // A regra de negócio do RunWay intercepta a ação imediatamente para clientes inativos
      cy.get('[data-cy="btn-card-adicionar"]').first().click();

      // Valida que o modal de cliente inativo é exibido imediatamente com a mensagem de bloqueio
      cy.get('[data-cy="modal-cliente-inativo"]').should('be.visible');
      cy.get('[data-cy="aviso-cliente-inativo"]')
        .should('be.visible')
        .and('contain', 'Clientes inativos não podem realizar compras');

      // Fecha o aviso de bloqueio
      cy.get('[data-cy="btn-fechar-aviso-inativo"]').click();
      cy.get('[data-cy="modal-cliente-inativo"]').should('not.exist');

      // Acessa o carrinho via Header para comprovar que nenhum produto foi inserido
      cy.get('[data-cy="nav-carrinho"]').click();
      cy.url().should('include', '/carrinho');
      cy.contains('Seu carrinho está vazio').should('be.visible');
    });
  });

});
