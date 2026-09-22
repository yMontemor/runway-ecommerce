/**
 * SUÍTE DE TESTES E2E — CARTÕES DE CRÉDITO DO CLIENTE (RUNWAY)
 * 
 * ESCOPO E COBERTURA:
 * Suíte Cypress E2E cobrindo integralmente o fluxo de gestão de Cartões de Crédito do Cliente,
 * incluindo listagem, cadastro de primeiro e múltiplos cartões, dados obrigatórios,
 * validação de bandeira previamente cadastrada, alternância e exclusividade do cartão
 * preferencial, e persistência real após recarga sem dependência de localStorage.
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0027: Cadastro de cartões de crédito — o cliente pode cadastrar múltiplos cartões
 *           e deve existir um cartão preferencial.
 * - RN0024: Dados obrigatórios do cartão — o cartão deve conter número, nome impresso,
 *           bandeira e código de segurança (CVV).
 * - RN0025: Bandeira cadastrada — a bandeira utilizada deve estar previamente cadastrada
 *           no sistema (alimentada pela API GET /api/bandeiras).
 * - Decisões do Projeto RunWay:
 *   * O primeiro cartão cadastrado torna-se compulsoriamente preferencial;
 *   * Existe exatamente um cartão preferencial por cliente;
 *   * Outro cartão pode ser marcado como preferencial a qualquer momento;
 *   * Ao trocar o preferencial, o anterior perde o status de preferencial.
 * - RNF0012: Log de Auditoria — cadastro e alteração de preferência são operações de escrita auditadas.
 *            (Ressalva Técnica Obrigatória: Os testes Cypress fornecem comprovação funcional
 *             da escrita realizada ponta a ponta; a comprovação formal do registro na tabela
 *             LOG_AUDITORIA pertence à evidência complementar de backend/banco).
 * 
 * SEGURANÇA E DADOS SENSÍVEIS (ACADÊMICO):
 * - Utilização estrita de dados fictícios acadêmicos (ex: 4111 1111 1111 1111, CVV 123);
 * - Nenhum número de cartão completo ou CVV é impresso em logs do Cypress ou mensagens da interface;
 * - A interface exibe estritamente a máscara / últimos 4 dígitos ("final XXXX").
 * 
 * DOMÍNIO E LIMITES:
 * - Não há implementação de PUT (edição de dados do cartão) ou DELETE (remoção de cartão);
 * - Apenas cadastro (POST) e definição de preferencial (PATCH).
 * 
 * CONTEXTO DE EXECUÇÃO:
 * Operações executadas na Área do Cliente (/cliente?tab=perfil) para o cliente atualmente
 * selecionado/ativo na aplicação, sem autenticação/login por diretriz acadêmica do projeto.
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> ASP.NET Core API (/api/clientes/{codigo}/cartoes) -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma chamada de API é mockada.
 * Clientes de controle reais são criados dinamicamente via API REST antes de cada teste.
 */

describe('Suíte E2E: Cartões de Crédito do Cliente — RunWay (RF0027 / RN0024 / RN0025 / Decisões RunWay)', () => {

  interface ClienteControle {
    id: number;
    codigo: string;
    nome: string;
    email: string;
    cpf: string;
    cpfFormatado: string;
    genero: string;
    dataNascimento: string;
    telefone: {
      tipo: string;
      ddd: string;
      numero: string;
    };
    enderecos: any[];
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
   * O cliente é criado sem cartões de crédito iniciais.
   */
  function criarClienteControleApi(dados?: Partial<{
    nome: string;
    email: string;
    cpf: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Cartoes ${ts}`;
    const email = dados?.email || `cypress.cartoes.${ts}@runway.test`;

    return cy.request({
      method: 'POST',
      url: 'http://localhost:5035/api/clientes',
      body: {
        nome,
        email,
        cpf: cpfRaw.replace(/\D/g, ''),
        genero: 'Feminino',
        dataNascimento: '1996-03-20',
        senha: 'Senha@Forte2026!',
        confirmacaoSenha: 'Senha@Forte2026!',
        telefone: {
          tipo: 'Celular',
          ddd: '11',
          numero: '988887777'
        },
        enderecos: [
          {
            nome: 'Residencial Cartoes',
            tipoResidencia: 'Casa',
            tipoLogradouro: 'Rua',
            logradouro: 'Rua das Bandeiras',
            numero: '100',
            complemento: 'Bloco A',
            bairro: 'Jardins',
            cep: '01415000',
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
          numero: b.telefone?.numero || '988887777'
        },
        enderecos: b.enderecos || []
      };
    });
  }

  /**
   * Adiciona um cartão real diretamente via API REST do RunWay.
   */
  function adicionarCartaoViaApi(codigoCliente: string, dados?: Partial<{
    bandeiraId: number;
    numeroCartao: string;
    nomeImpresso: string;
    dataValidade: string;
    cvv: string;
    preferencial: boolean;
  }>): Cypress.Chainable<any> {
    return cy.request({
      method: 'POST',
      url: `http://localhost:5035/api/clientes/${encodeURIComponent(codigoCliente)}/cartoes`,
      body: {
        bandeiraId: dados?.bandeiraId || 1, // Visa
        numeroCartao: dados?.numeroCartao || '4111111111111111',
        nomeImpresso: dados?.nomeImpresso || 'CYPRESS RUNWAY',
        dataValidade: dados?.dataValidade || '12/28',
        cvv: dados?.cvv || '123',
        preferencial: dados?.preferencial ?? false
      }
    }).then(res => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }

  /**
   * Consulta cartões reais do cliente via API REST do RunWay.
   */
  function consultarCartoesClienteApi(codigo: string): Cypress.Chainable<any> {
    return cy.request({
      method: 'GET',
      url: `http://localhost:5035/api/clientes/${encodeURIComponent(codigo)}/cartoes`
    }).then(res => {
      expect(res.status).to.eq(200);
      return res.body as any[];
    });
  }

  /**
   * Helper para selecionar o cliente no Header Dropdown e navegar até a Área do Cliente -> Perfil -> Cartões.
   * Sincroniza via eventos reais de rede e confirmação de estado da interface.
   */
  function selecionarClienteEAcessarCartoes(cliente: ClienteControle): void {
    cy.intercept('GET', '**/api/clientes').as('listarClientesNav');
    cy.intercept('GET', `**/api/clientes/${encodeURIComponent(cliente.codigo)}/cartoes`).as('listarCartoesClienteNav');

    cy.visit('/');
    cy.wait('@listarClientesNav');

    cy.get('[data-cy="user-dropdown"]').click();
    cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).scrollIntoView().click();

    // Confirma que o cliente selecionado foi registrado no Header
    cy.get('[data-cy="user-dropdown"]').should('contain.text', cliente.nome.split(' ')[0]);

    cy.get('[data-cy="nav-perfil"]').click();
    cy.url().should('include', '/cliente?tab=perfil');

    // Confirma que a Área do Cliente carregou com o cliente correto
    cy.get('.profile-client-name').should('contain.text', cliente.nome);
    cy.get('.profile-client-email').should('contain.text', cliente.email);

    // Aguarda a resposta real da API de cartões para este cliente
    cy.wait('@listarCartoesClienteNav');
    cy.get('[data-cy="cartoes-section"]').should('be.visible');
  }

  /**
   * Recarrega a página (cy.reload) e resseleciona o cliente de controle pelo header,
   * retornando à seção de cartões sem depender de localStorage.
   * Sincroniza via eventos reais de rede e confirmação de estado da interface.
   */
  function recarregarEReselecionarCliente(cliente: ClienteControle): void {
    cy.intercept('GET', '**/api/clientes').as('listarClientesReload');
    cy.intercept('GET', `**/api/clientes/${encodeURIComponent(cliente.codigo)}/cartoes`).as('listarCartoesClienteReload');

    cy.reload();
    cy.wait('@listarClientesReload');

    cy.get('[data-cy="user-dropdown"]').click();
    cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).scrollIntoView().click();

    // Confirma que o cliente selecionado foi registrado no Header
    cy.get('[data-cy="user-dropdown"]').should('contain.text', cliente.nome.split(' ')[0]);

    cy.get('[data-cy="nav-perfil"]').click();
    cy.url().should('include', '/cliente?tab=perfil');

    // Confirma que a Área do Cliente carregou com o cliente correto
    cy.get('.profile-client-name').should('contain.text', cliente.nome);
    cy.get('.profile-client-email').should('contain.text', cliente.email);

    // Aguarda a resposta real da API de cartões para este cliente
    cy.wait('@listarCartoesClienteReload');
    cy.get('[data-cy="cartoes-section"]').should('be.visible');
  }

  // =========================================================================
  // TESTE 1 — LISTAGEM DE CARTÕES (RF0027)
  // =========================================================================
  it('TESTE 1 — RF0027: Listagem de cartões cadastrados com dados visuais permitidos e badge de preferencial', () => {
    criarClienteControleApi().then(cliente => {
      // Prepara cliente com cartão real salvo previamente via API
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1, // Visa
        numeroCartao: '4111111111111111',
        nomeImpresso: 'CYPRESS VISA',
        dataValidade: '10/29',
        cvv: '123'
      }).then(() => {
        selecionarClienteEAcessarCartoes(cliente);

        // 1. Valida presença da seção de cartões
        cy.get('[data-cy="cartoes-section"]').should('be.visible');

        // 2. Valida exibição do card de cartão cadastrado
        cy.get('[data-cy="cartao-card"]').should('have.length', 1);

        // 3. Valida dados visuais permitidos (bandeira e máscara de últimos dígitos)
        cy.get('[data-cy="cartao-bandeira"]').should('contain.text', 'Visa');
        cy.get('[data-cy="cartao-final"]').should('contain.text', 'final 1111');

        // 4. Valida indicação de preferencial (primeiro cartão cadastrado é preferencial)
        cy.get('[data-cy="cartao-preferencial-badge"]')
          .should('be.visible')
          .and('contain.text', 'Preferencial');

        // 5. Confirma que o botão "Tornar preferencial" não aparece para o cartão que já é preferencial
        cy.get('[data-cy="cartao-definir-preferencial"]').should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 2 — CADASTRAR PRIMEIRO CARTÃO (RF0027 / RN0024 / RN0025 / Decisão RunWay)
  // =========================================================================
  it('TESTE 2 — RF0027 / RN0024 / RN0025: Cadastrar primeiro cartão, preferencial automático e persistência após reload', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/cartoes').as('criarCartaoReal');

      selecionarClienteEAcessarCartoes(cliente);

      // 1. Valida estado inicial vazio
      cy.get('[data-cy="sem-cartoes-txt"]').should('be.visible');

      // 2. Abre modal de adição de cartão
      cy.get('[data-cy="novo-cartao-btn"]').click();
      cy.get('[data-cy="cartao-form"]').should('be.visible');

      // 3. Preenche os campos obrigatórios (RN0024, RN0025 e validade)
      cy.get('[data-cy="cartao-input-numero"]').type('4111 1111 1111 1111');
      cy.get('[data-cy="cartao-input-nome"]').type('CYPRESS PRIMEIRO CARTAO');
      cy.get('[data-cy="cartao-select-bandeira"]').select('Visa');
      cy.get('[data-cy="cartao-input-validade"]').type('12/28');
      cy.get('[data-cy="cartao-input-cvv"]').type('123');

      // 4. Salva o cartão
      cy.get('[data-cy="salvar-cartao"]').click();

      // 5. Observa chamada real de criação e valida HTTP 201 Created
      cy.wait('@criarCartaoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(201);
        expect(xhr.response?.body.preferencial).to.be.true; // Decisão do projeto RunWay: primeiro cartão é preferencial
        expect(xhr.response?.body.ultimosQuatroDigitos).to.eq('1111');
        expect(xhr.response?.body.bandeiraNome).to.eq('Visa');
      });

      // 6. Valida feedback de sucesso (Toast) e exibição na listagem
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Novo cartão cadastrado com sucesso');

      cy.get('[data-cy="cartao-card"]')
        .should('have.length', 1)
        .within(() => {
          cy.get('[data-cy="cartao-bandeira"]').should('contain.text', 'Visa');
          cy.get('[data-cy="cartao-final"]').should('contain.text', 'final 1111');
          cy.get('[data-cy="cartao-preferencial-badge"]').should('be.visible');
        });

      // 7. Recarrega, resseleciona o cliente e confirma persistência real no PostgreSQL
      recarregarEReselecionarCliente(cliente);
      cy.get('[data-cy="cartao-card"]')
        .should('have.length', 1)
        .within(() => {
          cy.get('[data-cy="cartao-bandeira"]').should('contain.text', 'Visa');
          cy.get('[data-cy="cartao-final"]').should('contain.text', 'final 1111');
          cy.get('[data-cy="cartao-preferencial-badge"]').should('be.visible');
        });
    });
  });

  // =========================================================================
  // TESTE 3 — MÚLTIPLOS CARTÕES (RF0027 / Decisão RunWay)
  // =========================================================================
  it('TESTE 3 — RF0027: Múltiplos cartões de crédito cadastrados com apenas um preferencial e persistência', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/cartoes').as('criarCartaoReal');

      selecionarClienteEAcessarCartoes(cliente);

      // 1. Cadastra primeiro cartão (Visa - final 1111)
      cy.get('[data-cy="novo-cartao-btn"]').click();
      cy.get('[data-cy="cartao-input-numero"]').type('4111 1111 1111 1111');
      cy.get('[data-cy="cartao-input-nome"]').type('CYPRESS VISA MULTI');
      cy.get('[data-cy="cartao-select-bandeira"]').select('Visa');
      cy.get('[data-cy="cartao-input-validade"]').type('08/29');
      cy.get('[data-cy="cartao-input-cvv"]').type('321');
      cy.get('[data-cy="salvar-cartao"]').click();
      cy.wait('@criarCartaoReal').its('response.statusCode').should('eq', 201);
      cy.contains('[data-cy="cartao-card"]', 'final 1111').should('be.visible');

      // 2. Cadastra segundo cartão (Mastercard - final 5105)
      cy.get('[data-cy="novo-cartao-btn"]').click();
      cy.get('[data-cy="cartao-input-numero"]').type('5105 1051 0510 5105');
      cy.get('[data-cy="cartao-input-nome"]').type('CYPRESS MASTER MULTI');
      cy.get('[data-cy="cartao-select-bandeira"]').select('Mastercard');
      cy.get('[data-cy="cartao-input-validade"]').type('11/30');
      cy.get('[data-cy="cartao-input-cvv"]').type('654');
      cy.get('[data-cy="salvar-cartao"]').click();
      cy.wait('@criarCartaoReal').its('response.statusCode').should('eq', 201);

      // 3. Valida que ambos aparecem na listagem
      cy.get('[data-cy="cartao-card"]').should('have.length', 2);
      cy.contains('[data-cy="cartao-card"]', 'final 1111').should('be.visible');
      cy.contains('[data-cy="cartao-card"]', 'final 5105').should('be.visible');

      // 4. Valida que exatamente um cartão possui a indicação de preferencial (Decisão RunWay)
      cy.get('[data-cy="cartao-preferencial-badge"]').should('have.length', 1);
      cy.contains('[data-cy="cartao-card"]', 'final 1111')
        .find('[data-cy="cartao-preferencial-badge"]')
        .should('be.visible');

      // O segundo cartão exibe o botão de ação para tornar preferencial
      cy.contains('[data-cy="cartao-card"]', 'final 5105')
        .find('[data-cy="cartao-definir-preferencial"]')
        .should('be.visible');

      // 5. Recarrega a página, resseleciona o cliente e confirma persistência de ambos no PostgreSQL
      recarregarEReselecionarCliente(cliente);
      cy.get('[data-cy="cartao-card"]').should('have.length', 2);
      cy.contains('[data-cy="cartao-card"]', 'final 1111').should('be.visible');
      cy.contains('[data-cy="cartao-card"]', 'final 5105').should('be.visible');
      cy.get('[data-cy="cartao-preferencial-badge"]').should('have.length', 1);
    });
  });

  // =========================================================================
  // TESTE 4 — TROCAR CARTÃO PREFERENCIAL (RF0027 / Decisão RunWay)
  // =========================================================================
  it('TESTE 4 — RF0027: Trocar cartão preferencial pela interface com alternância e exclusividade', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', '**/api/clientes/*/cartoes/*/preferencial').as('definirPreferencialReal');

      // Prepara cliente com dois cartões reais salvos no backend
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1, // Visa
        numeroCartao: '4111111111111111',
        nomeImpresso: 'CARTAO A VISA',
        dataValidade: '05/29',
        cvv: '123',
        preferencial: true
      }).then(() => {
        adicionarCartaoViaApi(cliente.codigo, {
          bandeiraId: 2, // Mastercard
          numeroCartao: '5105105105105105',
          nomeImpresso: 'CARTAO B MASTER',
          dataValidade: '09/30',
          cvv: '456',
          preferencial: false
        }).then(() => {
          selecionarClienteEAcessarCartoes(cliente);

          // Estado inicial: Cartão A (final 1111) é preferencial, Cartão B (final 5105) possui botão para tornar preferencial
          cy.contains('[data-cy="cartao-card"]', 'final 1111')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');

          cy.contains('[data-cy="cartao-card"]', 'final 5105')
            .find('[data-cy="cartao-definir-preferencial"]')
            .should('be.visible')
            .click();

          // Observa chamada real PATCH /api/clientes/{codigo}/cartoes/{id}/preferencial e valida HTTP 200 OK
          cy.wait('@definirPreferencialReal').then(xhr => {
            expect(xhr.response?.statusCode).to.eq(200);
            expect(xhr.response?.body.preferencial).to.be.true;
            expect(xhr.response?.body.ultimosQuatroDigitos).to.eq('5105');
          });

          // Valida toast de sucesso
          cy.get('[data-cy="toast-container"]')
            .should('be.visible')
            .and('contain.text', 'Cartão preferencial atualizado com sucesso');

          // Valida alternância: Cartão B agora é preferencial
          cy.contains('[data-cy="cartao-card"]', 'final 5105')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');

          // Cartão A deixou de ser preferencial e agora possui o botão "Tornar preferencial"
          cy.contains('[data-cy="cartao-card"]', 'final 1111')
            .find('[data-cy="cartao-definir-preferencial"]')
            .should('be.visible');

          // Exclusividade: continua existindo exatamente um preferencial (Decisão RunWay)
          cy.get('[data-cy="cartao-preferencial-badge"]').should('have.length', 1);

          // Valida persistência da preferência após reload
          recarregarEReselecionarCliente(cliente);
          cy.contains('[data-cy="cartao-card"]', 'final 5105')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');
          cy.get('[data-cy="cartao-preferencial-badge"]').should('have.length', 1);
        });
      });
    });
  });

  // =========================================================================
  // TESTE 5 — CAMPOS OBRIGATÓRIOS DO CARTÃO (RN0024)
  // =========================================================================
  it('TESTE 5 — RN0024: Validação dos 4 campos obrigatórios do cartão (número, nome impresso, bandeira, código de segurança)', () => {
    criarClienteControleApi().then(cliente => {
      selecionarClienteEAcessarCartoes(cliente);

      cy.get('[data-cy="novo-cartao-btn"]').click();
      cy.get('[data-cy="cartao-form"]').should('be.visible');

      // 1. Valida atributo required nos 4 campos obrigatórios expressos na RN0024
      const camposObrigatoriosRN0024 = [
        { seletor: 'cartao-input-numero', nome: 'Número' },
        { seletor: 'cartao-input-nome', nome: 'Nome Impresso' },
        { seletor: 'cartao-select-bandeira', nome: 'Bandeira' },
        { seletor: 'cartao-input-cvv', nome: 'Código de Segurança' }
      ];

      camposObrigatoriosRN0024.forEach(campo => {
        cy.get(`[data-cy="${campo.seletor}"]`)
          .should('have.attr', 'required');
      });

      // 2. Valida que submeter sem preencher número aciona bloqueio de validação
      cy.get('[data-cy="cartao-input-nome"]').type('CYPRESS TITULAR');
      cy.get('[data-cy="cartao-select-bandeira"]').select('Visa');
      cy.get('[data-cy="cartao-input-validade"]').type('12/28');
      cy.get('[data-cy="cartao-input-cvv"]').type('123');
      cy.get('[data-cy="salvar-cartao"]').click();
      cy.get('[data-cy="cartao-input-numero"]').then($input => {
        expect(($input[0] as HTMLInputElement).checkValidity()).to.be.false;
      });

      // Fecha modal
      cy.get('[data-cy="cancelar-cartao"]').click();

      // 3. Validação robusta de rejeição pelo backend (HTTP 400) para cada um dos 4 campos de RN0024:
      // A. Sem número de cartão
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/cartoes`,
        failOnStatusCode: false,
        body: {
          bandeiraId: 1,
          numeroCartao: '', // VAZIO
          nomeImpresso: 'TESTE TITULAR',
          dataValidade: '12/28',
          cvv: '123'
        }
      }).then(res => {
        expect(res.status).to.eq(400);
      });

      // B. Sem nome impresso
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/cartoes`,
        failOnStatusCode: false,
        body: {
          bandeiraId: 1,
          numeroCartao: '4111111111111111',
          nomeImpresso: '', // VAZIO
          dataValidade: '12/28',
          cvv: '123'
        }
      }).then(res => {
        expect(res.status).to.eq(400);
      });

      // C. Sem bandeira (bandeiraId <= 0)
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/cartoes`,
        failOnStatusCode: false,
        body: {
          bandeiraId: 0, // VAZIO / INVÁLIDO
          numeroCartao: '4111111111111111',
          nomeImpresso: 'TESTE TITULAR',
          dataValidade: '12/28',
          cvv: '123'
        }
      }).then(res => {
        expect(res.status).to.eq(400);
      });

      // D. Sem código de segurança (CVV)
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/cartoes`,
        failOnStatusCode: false,
        body: {
          bandeiraId: 1,
          numeroCartao: '4111111111111111',
          nomeImpresso: 'TESTE TITULAR',
          dataValidade: '12/28',
          cvv: '' // VAZIO
        }
      }).then(res => {
        expect(res.status).to.eq(400);
      });
    });
  });

  // =========================================================================
  // TESTE 6 — BANDEIRA VÁLIDA CADASTRADA (RN0025)
  // =========================================================================
  it('TESTE 6 — RN0025: Seleção de bandeira alimentada por GET /api/bandeiras e cadastro bem-sucedido', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/bandeiras').as('listarBandeirasReal');
      cy.intercept('POST', '**/api/clientes/*/cartoes').as('criarCartaoReal');

      selecionarClienteEAcessarCartoes(cliente);

      cy.get('[data-cy="novo-cartao-btn"]').click();

      // Observa a chamada real GET /api/bandeiras
      cy.wait('@listarBandeirasReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        const lista = xhr.response?.body as any[];
        expect(lista).to.have.length.at.least(1);
      });

      // Valida que o select contém as bandeiras cadastradas no backend
      cy.get('[data-cy="cartao-select-bandeira"]')
        .should('contain', 'Visa')
        .and('contain', 'Mastercard');

      // Seleciona bandeira válida previamente cadastrada
      cy.get('[data-cy="cartao-select-bandeira"]').select('Mastercard');
      cy.get('[data-cy="cartao-input-numero"]').type('5500 0000 0000 0004');
      cy.get('[data-cy="cartao-input-nome"]').type('CYPRESS BANDEIRA VALIDA');
      cy.get('[data-cy="cartao-input-validade"]').type('10/29');
      cy.get('[data-cy="cartao-input-cvv"]').type('999');

      cy.get('[data-cy="salvar-cartao"]').click();

      cy.wait('@criarCartaoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(201);
        expect(xhr.response?.body.bandeiraNome).to.eq('Mastercard');
      });

      cy.contains('[data-cy="cartao-card"]', 'Mastercard').should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 7 — BANDEIRA INVÁLIDA/NÃO CADASTRADA (RN0025)
  // =========================================================================
  it('TESTE 7 — RN0025: Rejeição pelo backend ao tentar cadastrar cartão com bandeira inexistente no sistema', () => {
    criarClienteControleApi().then(cliente => {
      // Envia via API real um payload de cartão com bandeiraId inexistente (ex: 99999)
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/cartoes`,
        failOnStatusCode: false,
        body: {
          bandeiraId: 99999, // BANDEIRA INEXISTENTE NO BANCO DE DADOS
          numeroCartao: '4111111111111111',
          nomeImpresso: 'BANDEIRA INEXISTENTE',
          dataValidade: '12/28',
          cvv: '123'
        }
      }).then(res => {
        // Backend ASP.NET Core processa a validação da RN0025 e retorna HTTP 400 Bad Request
        expect(res.status).to.eq(400);
        expect(res.body.erro).to.contain('bandeira');

        // Confirma que nenhum cartão foi criado no banco de dados
        consultarCartoesClienteApi(cliente.codigo).then(cartoes => {
          expect(cartoes).to.have.length(0);
        });
      });
    });
  });

  // =========================================================================
  // TESTE 8 — PRIMEIRO CARTÃO PREFERENCIAL (Decisão RunWay)
  // =========================================================================
  it('TESTE 8 — Decisão RunWay: Primeiro cartão cadastrado é compulsoriamente definido como preferencial', () => {
    criarClienteControleApi().then(cliente => {
      // Cadastra via API sem marcar flag preferencial
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1,
        numeroCartao: '4111111111111111',
        nomeImpresso: 'PRIMEIRO COMPULSORIO',
        dataValidade: '10/28',
        cvv: '123',
        preferencial: false // MESMO FALSE, A REGRA DO PROJETO TORNA O PRIMEIRO PREFERENCIAL
      }).then(cartao => {
        expect(cartao.preferencial).to.be.true;

        // Acessa a interface e valida que o badge de preferencial é exibido
        selecionarClienteEAcessarCartoes(cliente);
        cy.get('[data-cy="cartao-card"]')
          .should('have.length', 1)
          .within(() => {
            cy.get('[data-cy="cartao-preferencial-badge"]').should('be.visible');
            cy.get('[data-cy="cartao-definir-preferencial"]').should('not.exist');
          });
      });
    });
  });

  // =========================================================================
  // TESTE 9 — SOMENTE UM PREFERENCIAL (Decisão de integridade RunWay)
  // =========================================================================
  it('TESTE 9 — Decisão de Integridade RunWay: Garantia de exclusividade estrita de exatamente um cartão preferencial', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', '**/api/clientes/*/cartoes/*/preferencial').as('definirPreferencialReal');

      // Cadastra Cartão A e Cartão B
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1,
        numeroCartao: '4111111111111111',
        nomeImpresso: 'CARTAO A',
        dataValidade: '06/28',
        cvv: '123'
      }).then(() => {
        adicionarCartaoViaApi(cliente.codigo, {
          bandeiraId: 2,
          numeroCartao: '5105105105105105',
          nomeImpresso: 'CARTAO B',
          dataValidade: '07/29',
          cvv: '456'
        }).then(() => {
          selecionarClienteEAcessarCartoes(cliente);

          // Torna B preferencial
          cy.contains('[data-cy="cartao-card"]', 'final 5105')
            .find('[data-cy="cartao-definir-preferencial"]')
            .click();

          cy.wait('@definirPreferencialReal').its('response.statusCode').should('eq', 200);

          // Valida na interface: A.preferencial = false, B.preferencial = true
          cy.contains('[data-cy="cartao-card"]', 'final 5105')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');

          cy.contains('[data-cy="cartao-card"]', 'final 1111')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('not.exist');

          // Valida também consultando diretamente o banco via API
          consultarCartoesClienteApi(cliente.codigo).then(cartoes => {
            const preferenciais = (cartoes as any[]).filter(c => c.preferencial);
            expect(preferenciais).to.have.length(1);
            expect(preferenciais[0].ultimosQuatroDigitos).to.eq('5105');
          });
        });
      });
    });
  });

  // =========================================================================
  // TESTE 10 — PERSISTÊNCIA APÓS RELOAD (RF0027 / Decisão RunWay)
  // =========================================================================
  it('TESTE 10 — RF0027 / Decisão RunWay: Persistência de múltiplos cartões e preferencial após recarga da página', () => {
    criarClienteControleApi().then(cliente => {
      // Cadastra dois cartões e define o segundo como preferencial
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1,
        numeroCartao: '4111111111111111',
        nomeImpresso: 'PERSISTENCIA A',
        dataValidade: '01/29',
        cvv: '123'
      }).then(() => {
        adicionarCartaoViaApi(cliente.codigo, {
          bandeiraId: 3, // Elo
          numeroCartao: '6363680000000000',
          nomeImpresso: 'PERSISTENCIA B',
          dataValidade: '02/30',
          cvv: '789',
          preferencial: true
        }).then(() => {
          selecionarClienteEAcessarCartoes(cliente);

          // Confirma presença antes do reload
          cy.get('[data-cy="cartao-card"]').should('have.length', 2);
          cy.contains('[data-cy="cartao-card"]', 'final 0000')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');

          // Executa reload e resseleciona o cliente pela interface
          recarregarEReselecionarCliente(cliente);

          // Confirma persistência integral de dados e status preferencial após reload
          cy.get('[data-cy="cartao-card"]').should('have.length', 2);
          cy.contains('[data-cy="cartao-card"]', 'final 0000')
            .find('[data-cy="cartao-preferencial-badge"]')
            .should('be.visible');

          cy.contains('[data-cy="cartao-card"]', 'final 1111')
            .find('[data-cy="cartao-definir-preferencial"]')
            .should('be.visible');
        });
      });
    });
  });

  // =========================================================================
  // TESTE 11 — DADOS SENSÍVEIS E MÁSCARA DO NÚMERO (RN0024 / Segurança)
  // =========================================================================
  it('TESTE 11 — RN0024 / Segurança: Interface exibe exclusivamente máscara de dígitos e não expõe número completo nem CVV', () => {
    criarClienteControleApi().then(cliente => {
      adicionarCartaoViaApi(cliente.codigo, {
        bandeiraId: 1,
        numeroCartao: '4111111111111111',
        nomeImpresso: 'TITULAR SEGURO',
        dataValidade: '12/28',
        cvv: '987'
      }).then(() => {
        selecionarClienteEAcessarCartoes(cliente);

        // 1. Confirma que a interface mostra apenas a máscara permitida ("final 1111")
        cy.get('[data-cy="cartao-final"]')
          .should('contain.text', 'final 1111')
          .and('not.contain.text', '4111111111111111');

        // 2. Confirma que o código CVV (987) não é exposto em nenhum texto na interface
        cy.get('[data-cy="cartoes-section"]')
          .should('not.contain.text', '987');
      });
    });
  });

});
