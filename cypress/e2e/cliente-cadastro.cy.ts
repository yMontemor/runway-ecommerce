/**
 * SUÍTE DE TESTES E2E — CADASTRO DE CLIENTE (RUNWAY)
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0021: Cadastro de cliente
 * - RN0021: Ao menos um endereço de cobrança
 * - RN0022: Ao menos um endereço de entrega
 * - RN0023: Campos obrigatórios do endereço (tipo de residência, tipo de logradouro, logradouro, número, bairro, CEP, cidade, estado, país)
 * - RN0026: Campos obrigatórios do cliente (nome, gênero, data de nascimento, CPF, tipo de telefone, DDD, número de telefone, e-mail, senha, endereço residencial)
 * - RNF0031: Senha forte (mínimo 8 caracteres, maiúscula, minúscula e caractere especial)
 * - RNF0032: Confirmação de senha estrita
 * - RNF0035: Código único sequencial do cliente no padrão RunWay (CLI-XXXX)
 * 
 * REGRAS DE INTEGRIDADE DO PROJETO RUNWAY (Decisões de Integridade, não DRS):
 * - Regra de integridade do projeto RunWay: Unicidade de CPF
 * - Regra de integridade do projeto RunWay: Unicidade de E-mail
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> ASP.NET Core API (Backend) -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma resposta de sucesso da API de clientes é mockada.
 */

describe('Suíte E2E: Cadastro de Cliente — RunWay', () => {

  /**
   * Função auxiliar para gerar CPF matematicamente válido com dígitos verificadores
   * e garantir unicidade dinâmica entre as execuções da suíte.
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
   * Helper para gerar e-mail dinâmico isolado por execução
   */
  function gerarEmail(prefixo: string): string {
    return `${prefixo}.${Date.now()}.${Math.floor(Math.random() * 100000)}@runway.test`;
  }

  /**
   * Helper para navegação até a Gestão de Clientes no Painel Administrativo
   */
  function navegarParaGestaoClientes() {
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get('[data-cy="painel-admin"]').click();
    cy.location('pathname').should('eq', '/admin');
    cy.get('[data-cy="admin-clientes"]').click();
    cy.contains('h3', 'Gestão de Clientes').should('be.visible');
  }

  /**
   * Helper para preencher os campos do modal de novo cliente com dados válidos
   */
  function preencherDadosValidos(dados: {
    nome: string;
    cpf: string;
    dataNascimento?: string;
    genero?: string;
    email: string;
    tipoTelefone?: string;
    ddd?: string;
    numeroTelefone?: string;
    senha?: string;
    confirmacaoSenha?: string;
    identificacaoEndereco?: string;
    tipoResidencia?: string;
    tipoLogradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    cidade?: string;
    estado?: string;
  }) {
    cy.get('[data-cy="cliente-nome"]').clear().type(dados.nome);
    cy.get('[data-cy="cliente-cpf"]').clear().type(dados.cpf);
    cy.get('[data-cy="cliente-data-nascimento"]').clear().type(dados.dataNascimento || '15/05/1990');
    cy.get('[data-cy="cliente-genero"]').select(dados.genero || 'Feminino');
    cy.get('[data-cy="cliente-email"]').clear().type(dados.email);
    cy.get('[data-cy="cliente-telefone-tipo"]').select(dados.tipoTelefone || 'Celular');
    cy.get('[data-cy="cliente-telefone-ddd"]').clear().type(dados.ddd || '11');
    cy.get('[data-cy="cliente-telefone-numero"]').clear().type(dados.numeroTelefone || '987654321');

    const senha = dados.senha || 'RunWay@2026Strong!';
    const confirmacao = dados.confirmacaoSenha !== undefined ? dados.confirmacaoSenha : senha;

    cy.get('[data-cy="cliente-senha"]').clear().type(senha);
    cy.get('[data-cy="cliente-confirmacao-senha"]').clear().type(confirmacao);

    cy.get('[data-cy="endereco-identificacao"]').clear().type(dados.identificacaoEndereco || 'Residência Principal');
    cy.get('[data-cy="endereco-tipo-residencia"]').select(dados.tipoResidencia || 'Casa');
    cy.get('[data-cy="endereco-tipo-logradouro"]').select(dados.tipoLogradouro || 'Avenida');
    cy.get('[data-cy="endereco-logradouro"]').clear().type(dados.logradouro || 'Avenida Paulista');
    cy.get('[data-cy="endereco-numero"]').clear().type(dados.numero || '1000');
    if (dados.complemento) {
      cy.get('[data-cy="endereco-complemento"]').clear().type(dados.complemento);
    }
    cy.get('[data-cy="endereco-bairro"]').clear().type(dados.bairro || 'Bela Vista');
    cy.get('[data-cy="endereco-cep"]').clear().type(dados.cep || '01310-100');
    cy.get('[data-cy="endereco-cidade"]').clear().type(dados.cidade || 'São Paulo');
    cy.get('[data-cy="endereco-estado"]').select(dados.estado || 'SP');
  }

  // =========================================================================
  // TESTE 1: CAMINHO FELIZ COMPLETO COM PERSISTÊNCIA REAL
  // RF0021, RN0021, RN0022, RN0023, RN0026, RNF0031, RNF0032, RNF0035
  // =========================================================================
  it('TESTE 1 — Cadastro com sucesso (RF0021, RN0021, RN0022, RN0023, RN0026, RNF0031, RNF0032, RNF0035)', () => {
    const timestamp = Date.now();
    const nomeCliente = `Cypress Cadastro ${timestamp}`;
    const emailCliente = gerarEmail('cypress.cadastro');
    const cpfCliente = gerarCpfValido();

    navegarParaGestaoClientes();

    // Iniciar novo cadastro via interface
    cy.get('[data-cy="novo-cliente"]').should('be.visible').click();

    // RNF0035: Garantir que o formulário de cadastro NÃO possui campo editável para escolha de código pelo usuário
    cy.get('.rw-client-modal [data-cy="cliente-codigo"]').should('not.exist');
    cy.get('.rw-client-modal input#new-code').should('not.exist');

    // Preencher dados obrigatórios do cliente (RN0026), endereço completo (RN0023, RN0021, RN0022) e senha forte (RNF0031, RNF0032)
    preencherDadosValidos({
      nome: nomeCliente,
      cpf: cpfCliente,
      dataNascimento: '20/10/1995',
      genero: 'Feminino',
      email: emailCliente,
      tipoTelefone: 'Celular',
      ddd: '11',
      numeroTelefone: '998877665',
      senha: 'RunWay@2026Strong!',
      confirmacaoSenha: 'RunWay@2026Strong!',
      identificacaoEndereco: 'Minha Casa Cypress',
      tipoResidencia: 'Casa',
      tipoLogradouro: 'Rua',
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Bloco A',
      bairro: 'Jardim Primavera',
      cep: '01001-000',
      cidade: 'São Paulo',
      estado: 'SP'
    });

    // Observar a chamada HTTP real à API sem qualquer mock de resposta
    cy.intercept('POST', '**/api/clientes').as('postCadastroCliente');

    // Submeter cadastro
    cy.get('[data-cy="salvar-cliente"]').click();

    // Aguardar e validar resposta real do backend (HTTP 201 Created)
    cy.wait('@postCadastroCliente').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const body = interception.response?.body;
      expect(body).to.have.property('codigo');
      // RNF0035: Código único gerado automaticamente pelo backend no padrão CLI-XXXX
      expect(body.codigo).to.match(/^CLI-\d{4,}$/);
      expect(body.nome).to.eq(nomeCliente);
      expect(body.email).to.eq(emailCliente);
    });

    // Validar feedback de sucesso na interface
    cy.get('[data-cy="toast-message"]')
      .should('be.visible')
      .and('contain', 'Cliente cadastrado com sucesso');

    // Validar que o cliente aparece na listagem real de clientes
    cy.get('[data-cy="admin-search-input"]').clear().type(nomeCliente);
    cy.get('[data-cy="admin-search-btn"]').click();

    // RNF0035: Validar que a listagem exibe o cliente com o código automático no padrão RunWay
    cy.get('[data-cy="tabela-clientes"]').within(() => {
      cy.get('[data-cy="cliente-row"]').first().within(() => {
        cy.get('[data-cy="cliente-codigo"]').invoke('text').should('match', /^CLI-\d{4,}$/);
        cy.get('[data-cy="cliente-nome-cell"]').should('contain', nomeCliente);
        cy.get('[data-cy="cliente-email-cell"]').should('contain', emailCliente);
      });
    });
  });

  // =========================================================================
  // TESTE 2: CAMPOS OBRIGATÓRIOS DO CLIENTE E ENDEREÇO
  // RN0026 (Cliente) e RN0023 (Endereço)
  // Abordagem parametrizada cobrindo individualmente cada campo obrigatório
  // =========================================================================
  it('TESTE 2 — Validação de campos obrigatórios (RN0026, RN0023)', () => {
    navegarParaGestaoClientes();
    cy.get('[data-cy="novo-cliente"]').click();

    // 1. Verificação de integridade estrutural: campos obrigatórios do formulário possuem atributo required
    const seletoresObrigatorios = [
      '[data-cy="cliente-nome"]',
      '[data-cy="cliente-cpf"]',
      '[data-cy="cliente-data-nascimento"]',
      '[data-cy="cliente-genero"]',
      '[data-cy="cliente-email"]',
      '[data-cy="cliente-telefone-tipo"]',
      '[data-cy="cliente-telefone-ddd"]',
      '[data-cy="cliente-telefone-numero"]',
      '[data-cy="cliente-senha"]',
      '[data-cy="cliente-confirmacao-senha"]',
      '[data-cy="endereco-identificacao"]',
      '[data-cy="endereco-tipo-residencia"]',
      '[data-cy="endereco-tipo-logradouro"]',
      '[data-cy="endereco-logradouro"]',
      '[data-cy="endereco-numero"]',
      '[data-cy="endereco-bairro"]',
      '[data-cy="endereco-cep"]',
      '[data-cy="endereco-cidade"]',
      '[data-cy="endereco-estado"]'
    ];

    seletoresObrigatorios.forEach((selector) => {
      cy.get(selector).should('have.attr', 'required');
    });

    // Observação continua opcional (não deve possuir atributo required)
    cy.get('[data-cy="endereco-observacoes"]').should('not.have.attr', 'required');

    // RN0023 — País obrigatório:
    // no RunWay, o frontend fixa o país como Brasil e não permite edição neste fluxo.
    // Isso deve ser tratado como decisão de interface do RunWay, não como falha da RN0023.
    cy.get('[data-cy="endereco-pais"]')
      .should('exist')
      .and('have.value', 'Brasil')
      .and('have.attr', 'readonly');

    // 2. Teste parametrizado: omissão individual de cada campo obrigatório editável a partir de dados válidos
    const camposObrigatorios: Array<{
      nome: string;
      seletor: string;
      tipo: 'input' | 'select';
      regra: string;
    }> = [
      // RN0026 — Campos Obrigatórios do Cliente
      { nome: 'Nome', seletor: '[data-cy="cliente-nome"]', tipo: 'input', regra: 'RN0026 (Nome)' },
      { nome: 'CPF', seletor: '[data-cy="cliente-cpf"]', tipo: 'input', regra: 'RN0026 (CPF)' },
      { nome: 'Data de Nascimento', seletor: '[data-cy="cliente-data-nascimento"]', tipo: 'input', regra: 'RN0026 (Data de Nascimento)' },
      { nome: 'Gênero', seletor: '[data-cy="cliente-genero"]', tipo: 'select', regra: 'RN0026 (Gênero)' },
      { nome: 'E-mail', seletor: '[data-cy="cliente-email"]', tipo: 'input', regra: 'RN0026 (E-mail)' },
      { nome: 'Tipo de Telefone', seletor: '[data-cy="cliente-telefone-tipo"]', tipo: 'select', regra: 'RN0026 (Tipo de Telefone)' },
      { nome: 'DDD', seletor: '[data-cy="cliente-telefone-ddd"]', tipo: 'input', regra: 'RN0026 (DDD do Telefone)' },
      { nome: 'Número do Telefone', seletor: '[data-cy="cliente-telefone-numero"]', tipo: 'input', regra: 'RN0026 (Número do Telefone)' },
      { nome: 'Senha', seletor: '[data-cy="cliente-senha"]', tipo: 'input', regra: 'RN0026 (Senha)' },

      // RN0023 — Campos Obrigatórios do Endereço
      { nome: 'Tipo de Residência', seletor: '[data-cy="endereco-tipo-residencia"]', tipo: 'select', regra: 'RN0023 (Tipo de Residência)' },
      { nome: 'Tipo de Logradouro', seletor: '[data-cy="endereco-tipo-logradouro"]', tipo: 'select', regra: 'RN0023 (Tipo de Logradouro)' },
      { nome: 'Logradouro', seletor: '[data-cy="endereco-logradouro"]', tipo: 'input', regra: 'RN0023 (Logradouro)' },
      { nome: 'Número', seletor: '[data-cy="endereco-numero"]', tipo: 'input', regra: 'RN0023 (Número)' },
      { nome: 'Bairro', seletor: '[data-cy="endereco-bairro"]', tipo: 'input', regra: 'RN0023 (Bairro)' },
      { nome: 'CEP', seletor: '[data-cy="endereco-cep"]', tipo: 'input', regra: 'RN0023 (CEP)' },
      { nome: 'Cidade', seletor: '[data-cy="endereco-cidade"]', tipo: 'input', regra: 'RN0023 (Cidade)' },
      { nome: 'Estado', seletor: '[data-cy="endereco-estado"]', tipo: 'select', regra: 'RN0023 (Estado)' }
    ];

    // Interceptar para assegurar que nenhuma chamada POST seja disparada com campos incompletos
    cy.intercept('POST', '**/api/clientes').as('postIncompleto');

    // Preenche o formulário com dados base válidos
    preencherDadosValidos({
      nome: 'Cypress Teste Incompleto',
      cpf: gerarCpfValido(),
      email: gerarEmail('cypress.incompleto')
    });

    // Testa a omissão individual de cada campo
    camposObrigatorios.forEach(({ seletor, tipo, nome, regra }) => {
      cy.log(`Validando omissão obrigatória: ${nome} (${regra})`);
      // Captura o valor atual para restaurar após o teste
      cy.get(seletor).invoke('val').then((valorOriginal) => {
        // Limpa ou desmarca o campo para torná-lo ausente/inválido
        if (tipo === 'select') {
          cy.get(seletor).select('');
        } else {
          cy.get(seletor).clear({ force: true });
        }

        // Tenta salvar com o campo ausente
        cy.get('[data-cy="salvar-cliente"]').click();

        // Valida que o elemento é considerado inválido pela validação nativa HTML5
        cy.get(seletor).should('match', ':invalid');

        // Garante que o modal permanece aberto e nenhuma chamada chegou à API
        cy.get('[data-cy="salvar-cliente"]').should('be.visible');

        // Restaura o valor original para o próximo campo ser avaliado individualmente
        if (tipo === 'select') {
          cy.get(seletor).select(String(valorOriginal));
        } else {
          cy.get(seletor).type(String(valorOriginal));
        }
      });
    });

    // Confirma que nenhuma chamada POST /api/clientes foi realizada durante os testes de omissão
    cy.get('@postIncompleto.all').should('have.length', 0);

    // Fecha o modal
    cy.get('[data-cy="cancelar-cliente"]').click();
  });

  // =========================================================================
  // TESTE 3: REJEIÇÃO DE CADASTRO SEM ENDEREÇO DE COBRANÇA (RN0021)
  // Cenário negativo: cliente sem nenhum endereço com cobrança ativa deve ser bloqueado
  // =========================================================================
  it('TESTE 3 — Rejeição de cadastro sem endereço de cobrança (RN0021)', () => {
    const nomeCliente = `Cypress Sem Cobranca ${Date.now()}`;
    const emailCliente = gerarEmail('cypress.semcobranca');

    navegarParaGestaoClientes();
    cy.get('[data-cy="novo-cliente"]').click();

    preencherDadosValidos({
      nome: nomeCliente,
      cpf: gerarCpfValido(),
      email: emailCliente
    });

    // Intercepta a requisição e força cobranca = false no payload real enviado à API
    cy.intercept('POST', '**/api/clientes', (req) => {
      if (req.body && req.body.enderecos && req.body.enderecos.length > 0) {
        req.body.enderecos[0].cobranca = false;
      }
    }).as('postSemCobranca');

    cy.get('[data-cy="salvar-cliente"]').click();

    // Valida que o backend rejeitou com HTTP 400 Bad Request devido à RN0021
    cy.wait('@postSemCobranca').then((interception) => {
      expect(interception.response?.statusCode).to.eq(400);
      expect(interception.response?.body).to.have.property('erro');
      expect(interception.response?.body?.erro).to.contain('RN0021');
    });

    // Valida que o frontend exibe o banner de erro com a mensagem da regra
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'cobrança');

    // O modal permanece aberto e o cadastro é bloqueado
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    // Fecha o modal e garante que nenhum cliente foi criado
    cy.get('[data-cy="cancelar-cliente"]').click();

    cy.get('[data-cy="admin-search-input"]').clear().type(nomeCliente);
    cy.get('[data-cy="admin-search-btn"]').click();
    cy.get('[data-cy="tabela-clientes"]').should('not.contain', nomeCliente);
  });

  // =========================================================================
  // TESTE 4: REJEIÇÃO DE CADASTRO SEM ENDEREÇO DE ENTREGA (RN0022)
  // Cenário negativo: cliente sem nenhum endereço com entrega ativa deve ser bloqueado
  // =========================================================================
  it('TESTE 4 — Rejeição de cadastro sem endereço de entrega (RN0022)', () => {
    const nomeCliente = `Cypress Sem Entrega ${Date.now()}`;
    const emailCliente = gerarEmail('cypress.sementrega');

    navegarParaGestaoClientes();
    cy.get('[data-cy="novo-cliente"]').click();

    preencherDadosValidos({
      nome: nomeCliente,
      cpf: gerarCpfValido(),
      email: emailCliente
    });

    // Intercepta a requisição e força entrega = false no payload real enviado à API
    cy.intercept('POST', '**/api/clientes', (req) => {
      if (req.body && req.body.enderecos && req.body.enderecos.length > 0) {
        req.body.enderecos[0].entrega = false;
      }
    }).as('postSemEntrega');

    cy.get('[data-cy="salvar-cliente"]').click();

    // Valida que o backend rejeitou com HTTP 400 Bad Request devido à RN0022
    cy.wait('@postSemEntrega').then((interception) => {
      expect(interception.response?.statusCode).to.eq(400);
      expect(interception.response?.body).to.have.property('erro');
      expect(interception.response?.body?.erro).to.contain('RN0022');
    });

    // Valida que o frontend exibe o banner de erro com a mensagem da regra
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'entrega');

    // O modal permanece aberto e o cadastro é bloqueado
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    // Fecha o modal e garante que nenhum cliente foi criado
    cy.get('[data-cy="cancelar-cliente"]').click();

    cy.get('[data-cy="admin-search-input"]').clear().type(nomeCliente);
    cy.get('[data-cy="admin-search-btn"]').click();
    cy.get('[data-cy="tabela-clientes"]').should('not.contain', nomeCliente);
  });

  // =========================================================================
  // TESTE 5: VALIDAÇÃO DE SENHA FRACA
  // RNF0031: Mínimo 8 caracteres, letra maiúscula, letra minúscula e caractere especial
  // =========================================================================
  it('TESTE 5 — Rejeição de senha fraca (RNF0031)', () => {
    navegarParaGestaoClientes();
    cy.get('[data-cy="novo-cliente"]').click();

    // Preenche todos os campos com dados válidos, exceto a senha (sem caractere especial e sem maiúscula)
    const senhaFraca = 'fraca123';

    preencherDadosValidos({
      nome: 'Cypress Senha Fraca',
      cpf: gerarCpfValido(),
      email: gerarEmail('cypress.senhafraca'),
      senha: senhaFraca,
      confirmacaoSenha: senhaFraca
    });

    // Observa a chamada real à API
    cy.intercept('POST', '**/api/clientes').as('postSenhaFraca');

    cy.get('[data-cy="salvar-cliente"]').click();

    // O sistema envia a requisição e a API rejeita com 400 Bad Request devido à RNF0031
    cy.wait('@postSenhaFraca').then((interception) => {
      expect(interception.response?.statusCode).to.eq(400);
      expect(interception.response?.body).to.have.property('erro');
    });

    // O frontend exibe a mensagem amigável no banner de erro
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'senha');

    // Garante que o formulário não foi concluído e o modal continua aberto
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    // Cancela o cadastro
    cy.get('[data-cy="cancelar-cliente"]').click();
  });

  // =========================================================================
  // TESTE 6: CONFIRMAÇÃO DE SENHA DIVERGENTE
  // RNF0032: Confirmação de senha estrita
  // =========================================================================
  it('TESTE 6 — Confirmação de senha divergente (RNF0032)', () => {
    navegarParaGestaoClientes();
    cy.get('[data-cy="novo-cliente"]').click();

    // Preenche com senha forte válida, mas confirmação com valor diferente
    preencherDadosValidos({
      nome: 'Cypress Senha Divergente',
      cpf: gerarCpfValido(),
      email: gerarEmail('cypress.divergente'),
      senha: 'RunWay@2026Forte!',
      confirmacaoSenha: 'RunWay@2026OutraSenha!'
    });

    // Intercepta para assegurar que a validação de UX bloqueie a submissão no cliente
    cy.intercept('POST', '**/api/clientes').as('postDivergente');

    cy.get('[data-cy="salvar-cliente"]').click();

    // A validação do formulário bloqueia a requisição antes de atingir a API
    cy.get('@postDivergente.all').should('have.length', 0);

    // Valida mensagem amigável de erro informando a divergência
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'A confirmação de senha não coincide com a senha digitada');

    // O cadastro é bloqueado e o modal permanece aberto
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    cy.get('[data-cy="cancelar-cliente"]').click();
  });

  // =========================================================================
  // TESTE 7: REJEIÇÃO DE CPF DUPLICADO
  // Regra de integridade do projeto RunWay (Decisão de Projeto / Unicidade)
  // =========================================================================
  it('TESTE 7 — Rejeição de CPF duplicado (Regra de integridade do projeto RunWay)', () => {
    const cpfCompartilhado = gerarCpfValido();
    const emailCliente1 = gerarEmail('cypress.cpf1');
    const emailCliente2 = gerarEmail('cypress.cpf2');

    navegarParaGestaoClientes();

    // Passo 1: Cadastra o primeiro cliente de controle
    cy.get('[data-cy="novo-cliente"]').click();
    preencherDadosValidos({
      nome: 'Cypress Cliente Base CPF',
      cpf: cpfCompartilhado,
      email: emailCliente1
    });

    cy.intercept('POST', '**/api/clientes').as('postPrimeiroCliente');
    cy.get('[data-cy="salvar-cliente"]').click();
    cy.wait('@postPrimeiroCliente').its('response.statusCode').should('eq', 201);
    cy.get('[data-cy="toast-message"]').should('contain', 'Cliente cadastrado com sucesso');

    // Passo 2: Tenta cadastrar um segundo cliente com o MESMO CPF e e-mail diferente
    cy.get('[data-cy="novo-cliente"]').click();
    preencherDadosValidos({
      nome: 'Cypress Segundo Cliente Mesmo CPF',
      cpf: cpfCompartilhado,
      email: emailCliente2
    });

    cy.intercept('POST', '**/api/clientes').as('postCpfDuplicado');
    cy.get('[data-cy="salvar-cliente"]').click();

    // A API real do ASP.NET Core deve retornar 409 Conflict
    cy.wait('@postCpfDuplicado').then((interception) => {
      expect(interception.response?.statusCode).to.eq(409);
      expect(interception.response?.body?.erro).to.contain('Já existe um cliente cadastrado com este CPF');
    });

    // O frontend exibe mensagem amigável de erro informando a duplicidade de CPF
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'Já existe um cliente cadastrado com este CPF');

    // O modal permanece aberto e o cadastro não é concluído
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    cy.get('[data-cy="cancelar-cliente"]').click();
  });

  // =========================================================================
  // TESTE 8: REJEIÇÃO DE E-MAIL DUPLICADO
  // Regra de integridade do projeto RunWay (Decisão de Projeto / Unicidade)
  // =========================================================================
  it('TESTE 8 — Rejeição de E-mail duplicado (Regra de integridade do projeto RunWay)', () => {
    const emailCompartilhado = gerarEmail('cypress.email.duplicado');
    const cpfCliente1 = gerarCpfValido();
    const cpfCliente2 = gerarCpfValido();

    navegarParaGestaoClientes();

    // Passo 1: Cadastra o primeiro cliente de controle
    cy.get('[data-cy="novo-cliente"]').click();
    preencherDadosValidos({
      nome: 'Cypress Cliente Base Email',
      cpf: cpfCliente1,
      email: emailCompartilhado
    });

    cy.intercept('POST', '**/api/clientes').as('postPrimeiroClienteEmail');
    cy.get('[data-cy="salvar-cliente"]').click();
    cy.wait('@postPrimeiroClienteEmail').its('response.statusCode').should('eq', 201);
    cy.get('[data-cy="toast-message"]').should('contain', 'Cliente cadastrado com sucesso');

    // Passo 2: Tenta cadastrar um segundo cliente com o MESMO e-mail e CPF diferente
    cy.get('[data-cy="novo-cliente"]').click();
    preencherDadosValidos({
      nome: 'Cypress Segundo Cliente Mesmo Email',
      cpf: cpfCliente2,
      email: emailCompartilhado
    });

    cy.intercept('POST', '**/api/clientes').as('postEmailDuplicado');
    cy.get('[data-cy="salvar-cliente"]').click();

    // A API real deve retornar 409 Conflict
    cy.wait('@postEmailDuplicado').then((interception) => {
      expect(interception.response?.statusCode).to.eq(409);
      expect(interception.response?.body?.erro).to.contain('Já existe um cliente cadastrado com este e-mail');
    });

    // O frontend exibe mensagem amigável de erro informando a duplicidade de e-mail
    cy.get('[data-cy="form-error-banner"]')
      .should('be.visible')
      .and('contain', 'Já existe um cliente cadastrado com este e-mail');

    // O modal permanece aberto e o cadastro não é concluído
    cy.get('[data-cy="salvar-cliente"]').should('be.visible');

    cy.get('[data-cy="cancelar-cliente"]').click();
  });

});
