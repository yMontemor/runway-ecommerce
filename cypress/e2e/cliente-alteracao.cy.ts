/**
 * SUÍTE DE TESTES E2E — ALTERAÇÃO CADASTRAL DE CLIENTE (RUNWAY)
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0022: O sistema deve permitir alterar dados cadastrais do cliente
 *           (Nome, E-mail, Gênero, Data de nascimento, Telefone: tipo, ddd, número).
 * - RNF0035: Código do cliente é um identificador público único (CLI-XXXX) e imutável.
 * - Decisão do Projeto RunWay: CPF imutável no fluxo de alteração cadastral (não atribuir a DRS RN/RNF).
 * - Regras de Integridade do Projeto RunWay:
 *     - Bloqueio de e-mail duplicado contra outro cliente (409 Conflict).
 *     - Permissão de manutenção do próprio e-mail cadastrado sem gerar falso conflito.
 * - RN0026: Validações de campos de cliente (nome, e-mail, gênero, data de nascimento, telefone).
 * 
 * NOTA TÉCNICA:
 * A comprovação de ausência de log indevido e demais requisitos da RNF0012
 * pertence à evidência complementar de backend/banco.
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> PUT /api/clientes/{codigo} -> ASP.NET Core -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma resposta de sucesso da API de alteração é mockada.
 * Clientes de controle são criados dinamicamente via API antes de cada cenário de teste.
 */

describe('Suíte E2E: Alteração Cadastral de Cliente — RunWay (RF0022 / RNF0035 / Decisões RunWay)', () => {

  interface ClienteControle {
    id: number;
    codigo: string;
    nome: string;
    email: string;
    cpf: string;
    cpfFormatado: string;
    genero: string;
    dataNascimento: string; // YYYY-MM-DD
    dataNascimentoBr: string; // DD/MM/AAAA
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
   * Converte data ISO YYYY-MM-DD para DD/MM/AAAA
   */
  function formatarDataIsoParaBr(iso: string): string {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  }

  /**
   * Cria um cliente de controle real no PostgreSQL via API REST do RunWay.
   */
  function criarClienteControleApi(dados?: Partial<{
    nome: string;
    email: string;
    cpf: string;
    genero: string;
    dataNascimento: string; // YYYY-MM-DD
    tipoTelefone: string;
    ddd: string;
    numeroTelefone: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Alteracao ${ts}`;
    const email = dados?.email || `cypress.alteracao.${ts}@runway.test`;
    const genero = dados?.genero || 'Feminino';
    const dataNascimento = dados?.dataNascimento || '1990-04-12';
    const tipoTelefone = dados?.tipoTelefone || 'Celular';
    const ddd = dados?.ddd || '11';
    const numeroTelefone = dados?.numeroTelefone || '987654321';

    return cy.request({
      method: 'POST',
      url: 'http://localhost:5035/api/clientes',
      body: {
        nome,
        email,
        cpf: cpfRaw.replace(/\D/g, ''),
        genero,
        dataNascimento,
        senha: 'RunWay@2026Strong!',
        confirmacaoSenha: 'RunWay@2026Strong!',
        telefone: {
          tipo: tipoTelefone,
          ddd,
          numero: numeroTelefone
        },
        enderecos: [
          {
            nome: 'Residencial Principal',
            tipoResidencia: 'Casa',
            tipoLogradouro: 'Rua',
            logradouro: 'Rua da Alteração Cadastral',
            numero: '100',
            complemento: null,
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
        dataNascimentoBr: formatarDataIsoParaBr(b.dataNascimento),
        telefone: {
          tipo: b.telefone?.tipo || tipoTelefone,
          ddd: b.telefone?.ddd || ddd,
          numero: b.telefone?.numero || numeroTelefone
        }
      };
    });
  }

  /**
   * Consulta cliente real diretamente no PostgreSQL via API REST do RunWay.
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
  // TESTE 1 — ALTERAÇÃO PELO ADMIN (RF0022)
  // =========================================================================
  it('TESTE 1 — RF0022: Alteração de dados cadastrais pelo Painel Administrativo com persistência real', () => {
    const ts = Date.now();
    const novoNome = `Admin Alterado ${ts}`;
    const novoEmail = `admin.alterado.${ts}@runway.test`;
    const novoGenero = 'Masculino';
    const novaDataNascimentoBr = '15/08/1992';
    const novoTipoTelefone = 'Fixo';
    const novoDdd = '21';
    const novoNumero = '32345678';

    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarClienteAdmin');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Localiza o cliente de controle pelo código no filtro
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      // Abre o modal de edição na linha do cliente
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .should('be.visible')
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      // Confirma que o modal de edição está aberto
      cy.get('[data-cy="editar-cliente-codigo"]')
        .should('be.visible')
        .and('have.value', cliente.codigo);

      // Altera os campos permitidos
      cy.get('[data-cy="editar-cliente-nome"]').clear().type(novoNome);
      cy.get('[data-cy="editar-cliente-email"]').clear().type(novoEmail);
      cy.get('[data-cy="editar-cliente-genero"]').select(novoGenero);
      cy.get('[data-cy="editar-cliente-data-nascimento"]').clear().type(novaDataNascimentoBr);
      cy.get('[data-cy="editar-cliente-telefone-tipo"]').select(novoTipoTelefone);
      cy.get('[data-cy="editar-cliente-telefone-ddd"]').clear().type(novoDdd);
      cy.get('[data-cy="editar-cliente-telefone-numero"]').clear().type(novoNumero);

      // Salva a alteração
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      // Valida chamada real PUT e status 200
      cy.wait('@alterarClienteAdmin').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        const payload = xhr.request.body;
        expect(payload.nome).to.eq(novoNome);
        expect(payload.email).to.eq(novoEmail);
        expect(payload.genero).to.eq(novoGenero);
        expect(payload.telefone.tipo).to.eq(novoTipoTelefone);
        expect(payload.telefone.ddd).to.eq(novoDdd);
        expect(payload.telefone.numero).to.eq(novoNumero);
      });

      // Valida feedback de sucesso (Toast)
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Dados do cliente alterados com sucesso');

      // Valida atualização dos novos dados na tabela de clientes
      cy.contains('[data-cy="cliente-row"]', cliente.codigo).within(() => {
        cy.get('[data-cy="cliente-nome-cell"]').should('contain.text', novoNome);
        cy.get('[data-cy="cliente-email-cell"]').should('contain.text', novoEmail);
      });

      // Valida detalhes do cliente
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-detalhes-btn"]')
        .click();

      cy.get('[data-cy="detalhe-cliente-nome"]').should('contain.text', novoNome);
      cy.get('[data-cy="detalhe-cliente-email"]').should('contain.text', novoEmail);
      cy.get('[data-cy="detalhe-cliente-genero"]').should('contain.text', novoGenero);
      cy.get('[data-cy="detalhe-cliente-nascimento"]').should('contain.text', novaDataNascimentoBr);
      cy.get('[data-cy="detalhe-cliente-telefone"]').should('contain.text', novoDdd);

      cy.get('[data-cy="btn-voltar-clientes"]').click();

      // Recarrega a página (F5) para atestar persistência no PostgreSQL
      cy.reload();
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo).within(() => {
        cy.get('[data-cy="cliente-nome-cell"]').should('contain.text', novoNome);
        cy.get('[data-cy="cliente-email-cell"]').should('contain.text', novoEmail);
      });
    });
  });

  // =========================================================================
  // TESTE 2 — ALTERAÇÃO PELA ÁREA DO CLIENTE (RF0022)
  // =========================================================================
  it('TESTE 2 — RF0022: Alteração de dados cadastrais pela Área do Cliente com persistência real', () => {
    const ts = Date.now();
    const novoNomePerfil = `Cliente Perfil ${ts}`;
    const novoEmailPerfil = `cliente.perfil.${ts}@runway.test`;
    const novoGeneroPerfil = 'Masculino';
    const novaDataNascimentoPerfil = '22/11/1994';
    const novoTipoTelPerfil = 'Fixo';
    const novoDddPerfil = '19';
    const novoNumPerfil = '38765432';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarClientePerfil');

      // Visita a página inicial para garantir carga dos clientes no AppContext
      cy.visit('/');

      // Seleciona o cliente de controle no Header Dropdown
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();

      // Acessa a Área do Cliente aba perfil
      cy.get('[data-cy="nav-perfil"]').click();
      cy.url().should('include', '/cliente?tab=perfil');

      // Confirma que exibe os dados do cliente ativo
      cy.get('[data-cy="perfil-nome-val"]').should('contain.text', cliente.nome);
      cy.get('[data-cy="perfil-email-val"]').should('contain.text', cliente.email);

      // Clica em EDITAR
      cy.get('[data-cy="perfil-editar-btn"]').click();

      // Altera campos do perfil
      cy.get('[data-cy="perfil-input-nome"]').clear().type(novoNomePerfil);
      cy.get('[data-cy="perfil-input-email"]').clear().type(novoEmailPerfil);
      cy.get('[data-cy="perfil-select-gender"]').select(novoGeneroPerfil);
      cy.get('[data-cy="perfil-input-birth"]').clear().type(novaDataNascimentoPerfil);
      cy.get('[data-cy="perfil-select-phone-type"]').select(novoTipoTelPerfil);
      cy.get('[data-cy="perfil-input-phone-ddd"]').clear().type(novoDddPerfil);
      cy.get('[data-cy="perfil-input-phone-num"]').clear().type(novoNumPerfil);

      // Salva a alteração
      cy.get('[data-cy="perfil-salvar-btn"]').click();

      // Valida requisição PUT e resposta de sucesso
      cy.wait('@alterarClientePerfil').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.request.body.nome).to.eq(novoNomePerfil);
        expect(xhr.request.body.email).to.eq(novoEmailPerfil);
        expect(xhr.request.body.genero).to.eq(novoGeneroPerfil);
      });

      // Valida toast de sucesso
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Dados cadastrais atualizados com sucesso');

      // Valida atualização visual imediata nos campos de perfil
      cy.get('[data-cy="perfil-nome-val"]').should('contain.text', novoNomePerfil);
      cy.get('[data-cy="perfil-email-val"]').should('contain.text', novoEmailPerfil);
      cy.get('[data-cy="perfil-genero-val"]').should('contain.text', novoGeneroPerfil);
      cy.get('[data-cy="perfil-nascimento-val"]').should('contain.text', novaDataNascimentoPerfil);
      cy.get('[data-cy="perfil-telefone-val"]').should('contain.text', novoDddPerfil);

      // Recarrega a página (F5) e confirma persistência real no PostgreSQL via API
      cy.reload();
      consultarClientePorCodigoApi(cliente.codigo).then(persisted => {
        expect(persisted.nome).to.eq(novoNomePerfil);
        expect(persisted.email).to.eq(novoEmailPerfil);
        expect(persisted.genero).to.eq(novoGeneroPerfil);
      });
    });
  });

  // =========================================================================
  // TESTE 3 — CPF NÃO EDITÁVEL (Decisão do projeto RunWay)
  // =========================================================================
  it('TESTE 3 — Decisão do projeto RunWay: CPF imutável no fluxo de alteração cadastral', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarClienteCpfCheck');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Localiza o cliente
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      // Abre edição no Admin
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      // Confirma que o campo de CPF no Admin possui readonly e exibe o CPF original
      cy.get('[data-cy="editar-cliente-cpf"]')
        .should('be.visible')
        .should('have.attr', 'readonly');
      cy.get('[data-cy="editar-cliente-cpf"]')
        .invoke('val')
        .then(val => {
          expect(String(val).replace(/\D/g, '')).to.eq(cliente.cpf.replace(/\D/g, ''));
        });

      // Salva outra alteração válida
      const nomeModificado = `${cliente.nome} RevCpf`;
      cy.get('[data-cy="editar-cliente-nome"]').clear().type(nomeModificado);
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      // Inspeciona payload PUT para confirmar ausência de modificação/envio de CPF
      cy.wait('@alterarClienteCpfCheck').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.request.body.cpf).to.be.undefined;
      });

      // Valida na listagem e na API que o CPF permaneceu rigorosamente o mesmo
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-cpf-cell"]')
        .invoke('text')
        .then(text => {
          expect(text.replace(/\D/g, '')).to.eq(cliente.cpf.replace(/\D/g, ''));
        });

      consultarClientePorCodigoApi(cliente.codigo).then(persisted => {
        expect(persisted.cpf.replace(/\D/g, '')).to.eq(cliente.cpf.replace(/\D/g, ''));
        expect(persisted.nome).to.eq(nomeModificado);
      });
    });
  });

  // =========================================================================
  // TESTE 4 — CÓDIGO NÃO EDITÁVEL (RNF0035)
  // =========================================================================
  it('TESTE 4 — RNF0035: Código público CLI-XXXX exibido como somente leitura e imutável na alteração', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarClienteCodigoCheck');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Localiza o cliente
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      // Confirma que o código público CLI-XXXX é exibido e é readonly
      cy.get('[data-cy="editar-cliente-codigo"]')
        .should('be.visible')
        .should('have.attr', 'readonly');
      cy.get('[data-cy="editar-cliente-codigo"]')
        .should('have.value', cliente.codigo);

      // Salva alteração válida
      const nomeModificado = `${cliente.nome} CodigoCheck`;
      cy.get('[data-cy="editar-cliente-nome"]').clear().type(nomeModificado);
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      cy.wait('@alterarClienteCodigoCheck').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
      });

      // Confirma que o código público não foi alterado
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-codigo"]')
        .should('contain.text', cliente.codigo);
    });
  });

  // =========================================================================
  // TESTE 5 — E-MAIL DUPLICADO NA ALTERAÇÃO (Regra de integridade RunWay)
  // =========================================================================
  it('TESTE 5 — Regra de integridade RunWay: Bloqueio de e-mail duplicado de outro cliente com retorno 409 Conflict', () => {
    const ts = Date.now();
    const emailClienteA = `cypress.dupl.a.${ts}@runway.test`;
    const emailClienteB = `cypress.dupl.b.${ts}@runway.test`;

    // Cria Cliente A
    criarClienteControleApi({ email: emailClienteA, nome: `Cliente A ${ts}` }).then(clienteA => {
      // Cria Cliente B
      criarClienteControleApi({ email: emailClienteB, nome: `Cliente B ${ts}` }).then(clienteB => {
        cy.intercept('GET', '**/api/clientes*').as('listarClientes');
        cy.intercept('PUT', `**/api/clientes/${clienteB.codigo}`).as('tentativaEmailDuplicado');

        cy.visit('/admin?tab=clientes');
        cy.wait('@listarClientes');

        // Localiza Cliente B
        cy.get('[data-cy="admin-search-input"]').clear().type(clienteB.codigo);
        cy.get('[data-cy="admin-search-btn"]').click();
        cy.wait('@listarClientes');

        cy.contains('[data-cy="cliente-row"]', clienteB.codigo)
          .find('[data-cy="cliente-editar-btn"]')
          .click();

        // Tenta alterar o e-mail de Cliente B para o e-mail de Cliente A
        cy.get('[data-cy="editar-cliente-email"]').clear().type(clienteA.email);
        cy.get('[data-cy="salvar-alteracao-cliente"]').click();

        // Valida que o backend real respondeu 409 Conflict com mensagem de erro
        cy.wait('@tentativaEmailDuplicado').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(409);
          expect(xhr.response?.body.erro).to.contain('Já existe outro cliente cadastrado com este e-mail.');
        });

        // Valida que a interface exibe feedback amigável no banner do modal
        cy.get('[data-cy="edit-form-error-banner"]')
          .should('be.visible')
          .and('contain.text', 'Já existe outro cliente cadastrado com este e-mail.');

        // Cancela o modal
        cy.get('[data-cy="cancelar-alteracao-cliente"]').click();

        // Confirma que Cliente B não teve o e-mail alterado no PostgreSQL
        consultarClientePorCodigoApi(clienteB.codigo).then(persistedB => {
          expect(persistedB.email).to.eq(clienteB.email);
          expect(persistedB.email).not.to.eq(clienteA.email);
        });
      });
    });
  });

  // =========================================================================
  // TESTE 6 — MANTER O PRÓPRIO E-MAIL (Regra de integridade RunWay)
  // =========================================================================
  it('TESTE 6 — Regra de integridade RunWay: Manter o próprio e-mail não acusa falso conflito de unicidade', () => {
    const ts = Date.now();
    const nomeAtualizado = `Nome Atualizado Sem Trocar Email ${ts}`;

    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('manterProprioEmail');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Localiza o cliente
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      // Mantém o mesmo e-mail atual do cliente e apenas altera o nome
      cy.get('[data-cy="editar-cliente-email"]').should('have.value', cliente.email);
      cy.get('[data-cy="editar-cliente-nome"]').clear().type(nomeAtualizado);
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      // Valida que a API real aceita (200 OK) sem falso conflito
      cy.wait('@manterProprioEmail').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.response?.body.nome).to.eq(nomeAtualizado);
        expect(xhr.response?.body.email).to.eq(cliente.email);
      });

      // Valida feedback de sucesso
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Dados do cliente alterados com sucesso');

      // Valida que na listagem o nome mudou e o e-mail permaneceu o mesmo
      cy.contains('[data-cy="cliente-row"]', cliente.codigo).within(() => {
        cy.get('[data-cy="cliente-nome-cell"]').should('contain.text', nomeAtualizado);
        cy.get('[data-cy="cliente-email-cell"]').should('contain.text', cliente.email);
      });
    });
  });

  // =========================================================================
  // TESTE 7 — VALIDAÇÕES DE CAMPOS (RF0022 / RN0026)
  // =========================================================================
  describe('TESTE 7 — RF0022 / RN0026: Validações de campos editáveis (Interface e API)', () => {
    
    it('Validação: Nome obrigatório bloqueia submissão com campo vazio', () => {
      criarClienteControleApi().then(cliente => {
        cy.intercept('GET', '**/api/clientes*').as('listarClientes');

        cy.visit('/admin?tab=clientes');
        cy.wait('@listarClientes');

        cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
        cy.get('[data-cy="admin-search-btn"]').click();
        cy.wait('@listarClientes');

        cy.contains('[data-cy="cliente-row"]', cliente.codigo)
          .find('[data-cy="cliente-editar-btn"]')
          .click();

        // Limpa o nome e verifica que o campo fica inválido (HTML5 validation)
        cy.get('[data-cy="editar-cliente-nome"]').clear();
        cy.get('[data-cy="salvar-alteracao-cliente"]').click();

        cy.get('[data-cy="editar-cliente-nome"]')
          .then($el => {
            const el = $el[0] as HTMLInputElement;
            expect(el.checkValidity()).to.be.false;
          });
      });
    });

    it('Validação: Formato de e-mail inválido bloqueia submissão', () => {
      criarClienteControleApi().then(cliente => {
        cy.intercept('GET', '**/api/clientes*').as('listarClientes');

        cy.visit('/admin?tab=clientes');
        cy.wait('@listarClientes');

        cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
        cy.get('[data-cy="admin-search-btn"]').click();
        cy.wait('@listarClientes');

        cy.contains('[data-cy="cliente-row"]', cliente.codigo)
          .find('[data-cy="cliente-editar-btn"]')
          .click();

        // Digita e-mail sem formato válido
        cy.get('[data-cy="editar-cliente-email"]').clear().type('email-sem-formato-valido');
        cy.get('[data-cy="salvar-alteracao-cliente"]').click();

        cy.get('[data-cy="editar-cliente-email"]')
          .then($el => {
            const el = $el[0] as HTMLInputElement;
            expect(el.checkValidity()).to.be.false;
          });
      });
    });

    it('Validação: Data de nascimento inválida na Área do Cliente exibe banner de erro', () => {
      criarClienteControleApi().then(cliente => {
        cy.visit('/');
        cy.get('[data-cy="user-dropdown"]').click();
        cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();

        cy.get('[data-cy="nav-perfil"]').click();
        cy.get('[data-cy="perfil-editar-btn"]').click();

        // Informa data inválida
        cy.get('[data-cy="perfil-input-birth"]').clear().type('99/99/9999');
        cy.get('[data-cy="perfil-salvar-btn"]').click();

        // Valida que exibe banner com aviso de data inválida
        cy.get('[data-cy="perfil-error-banner"]')
          .should('be.visible')
          .and('contain.text', 'Informe uma data de nascimento válida');
      });
    });

    it('Validação de API: Backend retorna 400 Bad Request se enviado payload com nome em branco', () => {
      criarClienteControleApi().then(cliente => {
        cy.request({
          method: 'PUT',
          url: `http://localhost:5035/api/clientes/${cliente.codigo}`,
          failOnStatusCode: false,
          body: {
            nome: '   ',
            email: cliente.email,
            genero: cliente.genero,
            dataNascimento: cliente.dataNascimento,
            telefone: {
              tipo: cliente.telefone.tipo,
              ddd: cliente.telefone.ddd,
              numero: cliente.telefone.numero
            }
          }
        }).then(res => {
          expect(res.status).to.eq(400);
          expect(res.body.erro).to.contain('nome');
        });
      });
    });
  });

  // =========================================================================
  // TESTE 8 — RF0022: SUBMISSÃO SEM ALTERAÇÃO REAL
  // =========================================================================
  it('TESTE 8 — RF0022: Submissão sem alteração real de dados', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarSemMudanca');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      // Submete o formulário sem modificar nenhum campo
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      // Valida que o endpoint PUT responde 200 OK sem falhas
      cy.wait('@alterarSemMudanca').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
      });

      // Valida feedback de sucesso
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Dados do cliente alterados com sucesso');

      // A comprovação de ausência de log indevido e demais requisitos da RNF0012
      // pertence à evidência complementar de backend/banco.
    });
  });

  // =========================================================================
  // TESTE 9 — PERSISTÊNCIA APÓS F5 (RF0022)
  // =========================================================================
  it('TESTE 9 — RF0022: Comprovação explícita de persistência no PostgreSQL após reload de página (F5)', () => {
    const ts = Date.now();
    const nomePersist = `Persistencia Real ${ts}`;
    const emailPersist = `persistencia.real.${ts}@runway.test`;

    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('alterarPersistencia');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      cy.get('[data-cy="editar-cliente-nome"]').clear().type(nomePersist);
      cy.get('[data-cy="editar-cliente-email"]').clear().type(emailPersist);
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      cy.wait('@alterarPersistencia').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
      });

      // F5 real na página
      cy.reload();
      cy.wait('@listarClientes');

      // Localiza novamente e confirma dados persistidos diretamente da API
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo).within(() => {
        cy.get('[data-cy="cliente-nome-cell"]').should('contain.text', nomePersist);
        cy.get('[data-cy="cliente-email-cell"]').should('contain.text', emailPersist);
      });

      // Consulta direta na API para atestar banco PostgreSQL
      consultarClientePorCodigoApi(cliente.codigo).then(dbData => {
        expect(dbData.nome).to.eq(nomePersist);
        expect(dbData.email).to.eq(emailPersist);
      });
    });
  });

  // =========================================================================
  // TESTE 10 — INSPEÇÃO DO PAYLOAD (CAMPOS PROTEGIDOS AUSENTES DO PUT)
  // =========================================================================
  it('TESTE 10 — Inspeção do Payload: Confirma ausência estrita de campos protegidos na requisição PUT', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PUT', `**/api/clientes/${cliente.codigo}`).as('inspecaoPayload');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="cliente-editar-btn"]')
        .click();

      cy.get('[data-cy="editar-cliente-nome"]').clear().type(`${cliente.nome} PayloadCheck`);
      cy.get('[data-cy="salvar-alteracao-cliente"]').click();

      cy.wait('@inspecaoPayload').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        const body = xhr.request.body;

        // Campos permitidos
        expect(body).to.have.property('nome');
        expect(body).to.have.property('email');
        expect(body).to.have.property('genero');
        expect(body).to.have.property('dataNascimento');
        expect(body).to.have.property('telefone');

        // Campos protegidos que NÃO devem constar no payload de alteração
        expect(body).not.to.have.property('codigo');
        expect(body).not.to.have.property('cpf');
        expect(body).not.to.have.property('ranking');
        expect(body).not.to.have.property('ativo');
        expect(body).not.to.have.property('senha');
        expect(body).not.to.have.property('senhaHash');
        expect(body).not.to.have.property('enderecos');
        expect(body).not.to.have.property('cartoes');
      });
    });
  });

});
