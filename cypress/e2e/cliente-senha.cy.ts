/**
 * SUÍTE DE TESTES E2E — ALTERAÇÃO DE SENHA DE CLIENTE (RUNWAY)
 * 
 * ESCOPO E COBERTURA:
 * Suíte Cypress E2E cobrindo RF0028, RNF0031 e RNF0032, com evidências parciais da RNF0033.
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0028: O sistema deve permitir alterar somente a senha sem exigir edição dos demais dados cadastrais.
 * - RNF0031: Senha forte — a nova senha deve conter no mínimo 8 caracteres, letra maiúscula,
 *            letra minúscula e caractere especial (!, @, #, $, etc.).
 * - RNF0032: Confirmação da senha — a nova senha deve ser informada duas vezes e os valores devem ser iguais.
 * - RNF0033: Senha protegida — armazenamento seguro via hash, sem exibição em texto puro.
 *             (Ressalva Técnica Obrigatória: O backend utiliza PasswordHasher<Cliente>; essa constatação
 *              é evidência complementar de código para RNF0033 e não é comprovada pelo Cypress isoladamente.
 *              A suíte Cypress comprova como evidência parcial que a resposta da API não expõe senha/hash
 *              e que não há texto puro na interface).
 * 
 * CONTEXTO DE EXECUÇÃO:
 * Operação executada para o cliente atualmente selecionado/ativo na aplicação,
 * pois o projeto RunWay não possui autenticação/login por orientação do professor.
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> PATCH /api/clientes/{codigo}/senha -> ASP.NET Core -> PasswordHasher<Cliente> -> PostgreSQL (Banco Real)
 * Nenhuma resposta de sucesso da API de alteração de senha é mockada.
 * Clientes de controle são criados dinamicamente via API antes de cada cenário de teste.
 */

describe('Suíte E2E: Alteração de Senha de Cliente — RunWay (RF0028 / RNF0031 / RNF0032 / RNF0033)', () => {

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
    senhaInicial: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Senha ${ts}`;
    const email = dados?.email || `cypress.senha.${ts}@runway.test`;
    const senhaInicial = dados?.senhaInicial || 'RunWay@2026Inicial!';

    return cy.request({
      method: 'POST',
      url: 'http://localhost:5035/api/clientes',
      body: {
        nome,
        email,
        cpf: cpfRaw.replace(/\D/g, ''),
        genero: 'Feminino',
        dataNascimento: '1992-06-20',
        senha: senhaInicial,
        confirmacaoSenha: senhaInicial,
        telefone: {
          tipo: 'Celular',
          ddd: '11',
          numero: '988887777'
        },
        enderecos: [
          {
            nome: 'Residencial Principal',
            tipoResidencia: 'Apartamento',
            tipoLogradouro: 'Avenida',
            logradouro: 'Avenida da Segurança',
            numero: '200',
            complemento: 'Apto 54',
            bairro: 'Jardins',
            cep: '01414000',
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
          tipo: b.telefone?.tipo || 'Celular',
          ddd: b.telefone?.ddd || '11',
          numero: b.telefone?.numero || '988887777'
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
  // TESTE 1 — ALTERAÇÃO DE SENHA COM SUCESSO (RF0028 / RNF0031 / RNF0032)
  // =========================================================================
  it('TESTE 1 — RF0028 / RNF0031 / RNF0032: Alteração de senha com sucesso pela Área do Cliente', () => {
    const novaSenhaForte = 'NovaSenha@2026Forte!';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('alterarSenhaReal');

      // Visita a página inicial
      cy.visit('/');

      // Seleciona o cliente no Header Dropdown
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();

      // Acessa a Área do Cliente aba Perfil
      cy.get('[data-cy="nav-perfil"]').click();
      cy.url().should('include', '/cliente?tab=perfil');

      // Abre o modal de alteração de senha
      cy.get('[data-cy="alterar-senha-btn"]').should('be.visible').click();

      // Informa a nova senha forte e a confirmação idêntica
      cy.get('[data-cy="nova-senha"]').clear().type(novaSenhaForte);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(novaSenhaForte);

      // Clica em Salvar Senha
      cy.get('[data-cy="salvar-nova-senha"]').click();

      // Observa a chamada real PATCH /api/clientes/{codigo}/senha
      cy.wait('@alterarSenhaReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.request.body.novaSenha).to.eq(novaSenhaForte);
        expect(xhr.request.body.confirmacaoNovaSenha).to.eq(novaSenhaForte);
      });

      // Valida feedback de sucesso (Toast)
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Senha alterada com sucesso');

      // Reabre o modal de alteração de senha e valida que os campos foram limpos após conclusão
      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').should('have.value', '');
      cy.get('[data-cy="confirmacao-nova-senha"]').should('have.value', '');
      cy.get('[data-cy="cancelar-nova-senha"]').click();
    });
  });

  // =========================================================================
  // TESTE 2 — ALTERAÇÃO APENAS DE SENHA (RF0028)
  // =========================================================================
  it('TESTE 2 — RF0028: Alteração exclusiva da senha mantendo todos os demais dados cadastrais intactos', () => {
    const novaSenha = 'SegundaSenha@2026Forte!';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('alterarSenhaExclusiva');

      // Seleciona cliente e navega para perfil
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      // Altera apenas a senha
      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      cy.wait('@alterarSenhaExclusiva').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
      });

      // Consulta os dados reais persistidos no PostgreSQL para validar preservação estrita
      consultarClientePorCodigoApi(cliente.codigo).then(persisted => {
        expect(persisted.nome).to.eq(cliente.nome);
        expect(persisted.email).to.eq(cliente.email);
        expect(persisted.cpf.replace(/\D/g, '')).to.eq(cliente.cpf.replace(/\D/g, ''));
        expect(persisted.genero).to.eq(cliente.genero);
        expect(persisted.dataNascimento).to.eq(cliente.dataNascimento);
        expect(persisted.telefone.tipo).to.eq(cliente.telefone.tipo);
        expect(persisted.telefone.ddd).to.eq(cliente.telefone.ddd);
        expect(persisted.telefone.numero).to.eq(cliente.telefone.numero);
        expect(persisted.codigo).to.eq(cliente.codigo);
        expect(persisted.ativo).to.be.true;
        expect(persisted.ranking).to.eq(1);
      });
    });
  });

  // =========================================================================
  // TESTE 3 — SENHA COM MENOS DE 8 CARACTERES (RNF0031)
  // =========================================================================
  it('TESTE 3 — RNF0031: Rejeição de senha com menos de 8 caracteres (Aa@123)', () => {
    const senhaCurta = 'Aa@123';

    criarClienteControleApi().then(cliente => {
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(senhaCurta);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(senhaCurta);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      // Valida que o erro é exibido e que a alteração foi bloqueada
      cy.get('[data-cy="senha-error-banner"]')
        .should('be.visible')
        .and('contain.text', '8 caracteres');
    });
  });

  // =========================================================================
  // TESTE 4 — SENHA SEM LETRA MAIÚSCULA (RNF0031)
  // =========================================================================
  it('TESTE 4 — RNF0031: Rejeição de senha sem letra maiúscula (senha@2026)', () => {
    const senhaSemMaiuscula = 'senha@2026';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchSemMaiuscula');

      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(senhaSemMaiuscula);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(senhaSemMaiuscula);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      // Valida retorno 400 da API com mensagem descritiva
      cy.wait('@patchSemMaiuscula').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(400);
        expect(xhr.response?.body.erro).to.contain('maiúscula');
      });

      // Valida exibição da mensagem de erro amigável no banner
      cy.get('[data-cy="senha-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'maiúscula');
    });
  });

  // =========================================================================
  // TESTE 5 — SENHA SEM LETRA MINÚSCULA (RNF0031)
  // =========================================================================
  it('TESTE 5 — RNF0031: Rejeição de senha sem letra minúscula (SENHA@2026)', () => {
    const senhaSemMinuscula = 'SENHA@2026';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchSemMinuscula');

      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(senhaSemMinuscula);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(senhaSemMinuscula);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      cy.wait('@patchSemMinuscula').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(400);
        expect(xhr.response?.body.erro).to.contain('minúscula');
      });

      cy.get('[data-cy="senha-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'minúscula');
    });
  });

  // =========================================================================
  // TESTE 6 — SENHA SEM CARACTERE ESPECIAL (RNF0031)
  // =========================================================================
  it('TESTE 6 — RNF0031: Rejeição de senha sem caractere especial (Senha2026)', () => {
    const senhaSemEspecial = 'Senha2026';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchSemEspecial');

      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(senhaSemEspecial);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(senhaSemEspecial);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      cy.wait('@patchSemEspecial').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(400);
        expect(xhr.response?.body.erro).to.contain('especial');
      });

      cy.get('[data-cy="senha-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'especial');
    });
  });

  // =========================================================================
  // TESTE 7 — CONFIRMAÇÃO DIFERENTE (RNF0032)
  // =========================================================================
  it('TESTE 7 — RNF0032: Bloqueio imediato quando confirmação da senha é divergente', () => {
    criarClienteControleApi().then(cliente => {
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type('NovaSenha@2026');
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type('OutraSenha@2026');
      cy.get('[data-cy="salvar-nova-senha"]').click();

      // Valida bloqueio pelo frontend e mensagem clara de divergência
      cy.get('[data-cy="senha-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'confirmação');
    });
  });

  // =========================================================================
  // TESTE 8 — CAMPOS OBRIGATÓRIOS (RF0028 / RNF0032)
  // =========================================================================
  it('TESTE 8 — RF0028 / RNF0032: Submissão desabilitada quando campos obrigatórios estão vazios', () => {
    criarClienteControleApi().then(cliente => {
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();

      // Ambos os campos vazios: botão desabilitado
      cy.get('[data-cy="nova-senha"]').should('have.value', '');
      cy.get('[data-cy="confirmacao-nova-senha"]').should('have.value', '');
      cy.get('[data-cy="salvar-nova-senha"]').should('be.disabled');

      // Apenas nova senha preenchida: botão continua desabilitado
      cy.get('[data-cy="nova-senha"]').type('SenhaTeste@2026');
      cy.get('[data-cy="salvar-nova-senha"]').should('be.disabled');

      // Apenas confirmação preenchida: botão continua desabilitado
      cy.get('[data-cy="nova-senha"]').clear();
      cy.get('[data-cy="confirmacao-nova-senha"]').type('SenhaTeste@2026');
      cy.get('[data-cy="salvar-nova-senha"]').should('be.disabled');

      cy.get('[data-cy="cancelar-nova-senha"]').click();
    });
  });

  // =========================================================================
  // TESTE 9 — ENDPOINT NÃO RECEBE DADOS CADASTRAIS (RF0028)
  // =========================================================================
  it('TESTE 9 — RF0028: Payload PATCH contém exclusivamente os campos de senha, sem dados cadastrais', () => {
    const novaSenha = 'PayloadForte@2026!';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchPayloadCheck');

      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      cy.wait('@patchPayloadCheck').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        const body = xhr.request.body;

        // Campos esperados
        expect(body).to.have.property('novaSenha');
        expect(body).to.have.property('confirmacaoNovaSenha');

        // Campos cadastrais que NÃO devem ser enviados
        expect(body).not.to.have.property('nome');
        expect(body).not.to.have.property('email');
        expect(body).not.to.have.property('cpf');
        expect(body).not.to.have.property('codigo');
        expect(body).not.to.have.property('genero');
        expect(body).not.to.have.property('dataNascimento');
        expect(body).not.to.have.property('telefone');
        expect(body).not.to.have.property('ranking');
        expect(body).not.to.have.property('ativo');
        expect(body).not.to.have.property('enderecos');
        expect(body).not.to.have.property('cartoes');
      });
    });
  });

  // =========================================================================
  // TESTE 10 — SENHA NÃO DEVE APARECER EM RESPOSTA (RNF0033 — Evidência Parcial)
  // =========================================================================
  it('TESTE 10 — RNF0033 (Evidência Parcial): Resposta da API PATCH não expõe senha em texto puro ou hash', () => {
    const novaSenha = 'ProtegidaSenha@2026!';

    criarClienteControleApi().then(cliente => {
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchResponseCheck');

      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      cy.wait('@patchResponseCheck').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        const resBody = xhr.response?.body;

        // Valida que a resposta contém apenas a mensagem de sucesso
        expect(resBody).to.have.property('mensagem', 'Senha alterada com sucesso.');

        // Valida que nenhum campo confidencial é retornado
        expect(resBody).not.to.have.property('senha');
        expect(resBody).not.to.have.property('senhaHash');
        expect(resBody).not.to.have.property('novaSenha');
        expect(resBody).not.to.have.property('confirmacaoNovaSenha');
      });
    });
  });

  // =========================================================================
  // TESTE 11 — RECARREGAMENTO NÃO REEXPÕE SENHA (RNF0033 — Evidência Parcial)
  // =========================================================================
  it('TESTE 11 — RNF0033 (Evidência Parcial): Recarregamento de página não reexpõe senha na interface', () => {
    const novaSenha = 'SemExposicao@2026!';

    criarClienteControleApi().then(cliente => {
      cy.visit('/');
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      cy.get('[data-cy="alterar-senha-btn"]').click();
      cy.get('[data-cy="nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="confirmacao-nova-senha"]').clear().type(novaSenha);
      cy.get('[data-cy="salvar-nova-senha"]').click();

      // Recarrega a página inteira
      cy.reload();

      // Re-seleciona o cliente no Header
      cy.get('[data-cy="user-dropdown"]').click();
      cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
      cy.get('[data-cy="nav-perfil"]').click();

      // Abre o modal de alteração de senha novamente
      cy.get('[data-cy="alterar-senha-btn"]').click();

      // Confirma que os campos não estão preenchidos com valores residuais
      cy.get('[data-cy="nova-senha"]').should('have.value', '');
      cy.get('[data-cy="confirmacao-nova-senha"]').should('have.value', '');

      // Confirma ausência de texto puro da senha em qualquer parte do DOM
      cy.get('body').should('not.contain', novaSenha);
      cy.get('[data-cy="cancelar-nova-senha"]').click();
    });
  });

  // =========================================================================
  // TESTE 12 — ALTERAÇÃO DE SENHA PELO PAINEL ADMINISTRATIVO (RF0028)
  // =========================================================================
  it('TESTE 12 — RF0028: Alteração de senha pelo Administrador no Painel Administrativo', () => {
    const senhaAdminNova = 'AdminDefinida@2026!';

    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes*').as('listarClientes');
      cy.intercept('PATCH', `**/api/clientes/${cliente.codigo}/senha`).as('patchSenhaAdmin');

      cy.visit('/admin?tab=clientes');
      cy.wait('@listarClientes');

      // Localiza o cliente na listagem
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.codigo);
      cy.get('[data-cy="admin-search-btn"]').click();
      cy.wait('@listarClientes');

      // Clica no botão de senha na linha do cliente
      cy.contains('[data-cy="cliente-row"]', cliente.codigo)
        .find('[data-cy="admin-cliente-senha-btn"]')
        .should('be.visible')
        .click();

      // Informa nova senha e confirmação no modal do Admin
      cy.get('[data-cy="admin-nova-senha"]').clear().type(senhaAdminNova);
      cy.get('[data-cy="admin-confirmacao-nova-senha"]').clear().type(senhaAdminNova);
      cy.get('[data-cy="admin-salvar-nova-senha"]').click();

      // Observa a chamada real PATCH
      cy.wait('@patchSenhaAdmin').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.request.body.novaSenha).to.eq(senhaAdminNova);
      });

      // Valida feedback de sucesso (Toast)
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Senha alterada com sucesso');
    });
  });

});
