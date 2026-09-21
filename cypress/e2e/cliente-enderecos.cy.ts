/**
 * SUÍTE DE TESTES E2E — ENDEREÇOS DO CLIENTE (RUNWAY)
 * 
 * ESCOPO E COBERTURA:
 * Suíte Cypress E2E cobrindo integralmente o fluxo de gestão de Endereços do Cliente,
 * incluindo listagem, criação, alteração independente de endereços, validação de campos
 * obrigatórios, garantia de finalidades de entrega e cobrança, e identificação curta.
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0026: Cadastro de endereços de entrega — o cliente pode possuir múltiplos endereços
 *           de entrega e cada endereço deve ser identificado por uma frase/nome curto.
 * - RN0021: Endereço de cobrança — o cliente deve possuir pelo menos um endereço de cobrança.
 * - RN0022: Endereço de entrega — o cliente deve possuir pelo menos um endereço de entrega.
 * - RN0023: Campos obrigatórios do endereço — 9 campos obrigatórios: tipo de residência,
 *           tipo de logradouro, logradouro, número, bairro, CEP, cidade, estado, país;
 *           e observações opcionais. (A identificação/nome curto pertence a RF0026;
 *           o complemento é campo opcional do RunWay não exigido expressamente pela RN0023).
 * - RNF0034: Alteração independente de endereços — o cliente deve poder adicionar/alterar
 *            endereços sem precisar editar os demais dados cadastrais.
 * - RNF0012: Log de Auditoria — a adição e alteração de endereço são operações de escrita auditadas.
 *            (Ressalva Técnica Obrigatória: Os testes Cypress fornecem comprovação funcional
 *             da escrita realizada ponta a ponta; a comprovação formal do registro na tabela
 *             LOG_AUDITORIA pertence à evidência complementar de backend/banco).
 * 
 * IMPORTANTE SOBRE O DOMÍNIO:
 * - Não há fluxo de exclusão física de endereço no sistema (sem endpoint DELETE e sem botão na UI).
 * - Sem dependência de CEP externo, geolocalização ou validação postal externa.
 * 
 * CONTEXTO DE EXECUÇÃO:
 * Operações executadas na Área do Cliente (/cliente?tab=perfil) para o cliente atualmente
 * selecionado/ativo na aplicação, visto que o RunWay não possui autenticação/login por orientação do professor.
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> ASP.NET Core API (/api/clientes/{codigo}/enderecos) -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma chamada de API é mockada.
 * Clientes de controle reais são criados dinamicamente via API REST antes de cada teste.
 */

describe('Suíte E2E: Endereços do Cliente — RunWay (RF0026 / RN0021 / RN0022 / RN0023 / RNF0034)', () => {

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
   * O cliente inicial atende: residencial = true, entrega = true, cobranca = true.
   */
  function criarClienteControleApi(dados?: Partial<{
    nome: string;
    email: string;
    cpf: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Enderecos ${ts}`;
    const email = dados?.email || `cypress.enderecos.${ts}@runway.test`;

    return cy.request({
      method: 'POST',
      url: 'http://localhost:5035/api/clientes',
      body: {
        nome,
        email,
        cpf: cpfRaw.replace(/\D/g, ''),
        genero: 'Feminino',
        dataNascimento: '1995-06-15',
        senha: 'Senha@Forte2026!',
        confirmacaoSenha: 'Senha@Forte2026!',
        telefone: {
          tipo: 'Celular',
          ddd: '11',
          numero: '988887777'
        },
        enderecos: [
          {
            nome: 'Residencial Principal',
            tipoResidencia: 'Casa',
            tipoLogradouro: 'Rua',
            logradouro: 'Rua das Flores',
            numero: '123',
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
   * Consulta cliente real via API REST do RunWay.
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

  /**
   * Consulta endereços reais do cliente via API REST do RunWay.
   */
  function consultarEnderecosClienteApi(codigo: string): Cypress.Chainable<any> {
    return cy.request({
      method: 'GET',
      url: `http://localhost:5035/api/clientes/${encodeURIComponent(codigo)}/enderecos`
    }).then(res => {
      expect(res.status).to.eq(200);
      return res.body as any[];
    });
  }

  /**
   * Helper para selecionar o cliente no Header Dropdown e navegar até a Área do Cliente -> Perfil.
   */
  function selecionarClienteEAcessarPerfil(cliente: ClienteControle): void {
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
    cy.get('[data-cy="nav-perfil"]').click();
    cy.url().should('include', '/cliente?tab=perfil');
    cy.get('[data-cy="enderecos-section"]').should('be.visible');
  }

  /**
   * Recarrega a página (cy.reload) e resseleciona o cliente de controle pelo header,
   * retornando à Área do Cliente para comprovar persistência real no PostgreSQL sem depender de localStorage.
   */
  function recarregarEReselecionarCliente(cliente: ClienteControle): void {
    cy.reload();
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get(`[data-cy="select-customer-${cliente.codigo}"]`).click();
    cy.get('[data-cy="nav-perfil"]').click();
    cy.url().should('include', '/cliente?tab=perfil');
    cy.get('[data-cy="enderecos-section"]').should('be.visible');
  }

  // =========================================================================
  // TESTE 1 — LISTAGEM DE ENDEREÇOS (RF0026)
  // =========================================================================
  it('TESTE 1 — RF0026: Listagem de endereços cadastrados, identificação curta e campos principais', () => {
    criarClienteControleApi().then(cliente => {
      selecionarClienteEAcessarPerfil(cliente);

      // 1. Valida presença da seção de endereços
      cy.get('[data-cy="enderecos-section"]').should('be.visible');

      // 2. Valida exibição do card de endereço cadastrado
      cy.get('[data-cy="endereco-card"]').should('have.length.at.least', 1);

      // 3. Valida a identificação/nome curto do endereço
      cy.get('[data-cy="endereco-nome"]').should('contain.text', 'Residencial Principal');

      // 4. Valida as tags de finalidades do endereço inicial (residencial, entrega e cobrança)
      cy.get('[data-cy="tag-residencial"]').should('be.visible').and('contain.text', 'Residencial');
      cy.get('[data-cy="tag-entrega"]').should('be.visible').and('contain.text', 'Entrega');
      cy.get('[data-cy="tag-cobranca"]').should('be.visible').and('contain.text', 'Cobrança');

      // 5. Valida campos principais exibidos no card
      cy.get('[data-cy="endereco-logradouro-txt"]')
        .should('contain.text', 'Rua Rua das Flores, 123')
        .and('contain.text', 'Bloco A')
        .and('contain.text', 'Casa');

      cy.get('[data-cy="endereco-cidade-txt"]')
        .should('contain.text', 'Jardins - São Paulo / SP - Brasil');

      cy.get('[data-cy="endereco-cep-txt"]')
        .should('contain.text', 'CEP 01415-000');

      // 6. Valida presença do botão de edição
      cy.get('[data-cy="endereco-editar-btn"]').should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 2 — ADICIONAR NOVO ENDEREÇO DE ENTREGA (RF0026 / RN0022 / RN0023 / RNF0034)
  // =========================================================================
  it('TESTE 2 — RF0026 / RN0022 / RN0023 / RNF0034: Adicionar novo endereço de entrega com persistência após reload', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/enderecos').as('criarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      // 1. Abre a gestão de novo endereço
      cy.get('[data-cy="novo-endereco-btn"]').click();
      cy.get('[data-cy="endereco-form"]').should('be.visible');

      // 2. Preenche nome/identificação curta e todos os campos obrigatórios (RN0023, RF0026)
      cy.get('[data-cy="endereco-input-nome"]').type('Casa de Praia');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Casa');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Avenida');
      cy.get('[data-cy="endereco-logradouro"]').type('Avenida Beira Mar');
      cy.get('[data-cy="endereco-numero"]').type('500');
      cy.get('[data-cy="endereco-complemento"]').type('Casa 2');
      cy.get('[data-cy="endereco-bairro"]').type('Praia Grande');
      cy.get('[data-cy="endereco-cep"]').type('11700000');
      cy.get('[data-cy="endereco-cidade"]').type('Praia Grande');
      cy.get('[data-cy="endereco-estado"]').select('SP');
      cy.get('[data-cy="endereco-pais"]').clear().type('Brasil');
      cy.get('[data-cy="endereco-observacoes"]').type('Em frente ao quiosque 12');

      // 3. Marca finalidade de Entrega (RN0022)
      cy.get('[data-cy="endereco-entrega"]').check();

      // 4. Salva o endereço
      cy.get('[data-cy="salvar-endereco"]').click();

      // 5. Observa chamada real de criação e valida HTTP 201 Created
      cy.wait('@criarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(201);
        expect(xhr.request.body.nome).to.eq('Casa de Praia');
        expect(xhr.request.body.entrega).to.be.true;
        expect(xhr.request.body.cidade).to.eq('Praia Grande');
      });

      // 6. Valida toast de sucesso e novo endereço exibido na listagem
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Novo endereço cadastrado com sucesso');

      cy.contains('[data-cy="endereco-card"]', 'Casa de Praia')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="tag-entrega"]').should('be.visible');
          cy.get('[data-cy="endereco-logradouro-txt"]').should('contain.text', 'Avenida Beira Mar, 500');
          cy.get('[data-cy="endereco-cidade-txt"]').should('contain.text', 'Praia Grande / SP');
        });

      // 7. Recarrega a página, resseleciona o cliente e confirma persistência real no PostgreSQL
      recarregarEReselecionarCliente(cliente);
      cy.contains('[data-cy="endereco-card"]', 'Casa de Praia')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="tag-entrega"]').should('be.visible');
        });
    });
  });

  // =========================================================================
  // TESTE 3 — MÚLTIPLOS ENDEREÇOS DE ENTREGA (RF0026)
  // =========================================================================
  it('TESTE 3 — RF0026: Múltiplos endereços de entrega simultâneos com identificações distintas e persistência', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/enderecos').as('criarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      // Adiciona segundo endereço de entrega: "Escritório Paulista"
      cy.get('[data-cy="novo-endereco-btn"]').click();
      cy.get('[data-cy="endereco-input-nome"]').type('Escritório Paulista');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Comercial');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Avenida');
      cy.get('[data-cy="endereco-logradouro"]').type('Avenida Paulista');
      cy.get('[data-cy="endereco-numero"]').type('1000');
      cy.get('[data-cy="endereco-complemento"]').type('10º Andar');
      cy.get('[data-cy="endereco-bairro"]').type('Bela Vista');
      cy.get('[data-cy="endereco-cep"]').type('01310100');
      cy.get('[data-cy="endereco-cidade"]').type('São Paulo');
      cy.get('[data-cy="endereco-estado"]').select('SP');
      cy.get('[data-cy="endereco-entrega"]').check();
      cy.get('[data-cy="salvar-endereco"]').click();
      cy.wait('@criarEnderecoReal').its('response.statusCode').should('eq', 201);

      // Adiciona terceiro endereço de entrega: "Casa de Campo"
      cy.get('[data-cy="novo-endereco-btn"]').click();
      cy.get('[data-cy="endereco-input-nome"]').type('Casa de Campo');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Casa');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Rodovia');
      cy.get('[data-cy="endereco-logradouro"]').type('Rodovia Dom Pedro I');
      cy.get('[data-cy="endereco-numero"]').type('Km 75');
      cy.get('[data-cy="endereco-bairro"]').type('Zona Rural');
      cy.get('[data-cy="endereco-cep"]').type('12940000');
      cy.get('[data-cy="endereco-cidade"]').type('Atibaia');
      cy.get('[data-cy="endereco-estado"]').select('SP');
      cy.get('[data-cy="endereco-entrega"]').check();
      cy.get('[data-cy="salvar-endereco"]').click();
      cy.wait('@criarEnderecoReal').its('response.statusCode').should('eq', 201);

      // Valida que todos os 3 endereços estão presentes na interface com identificações distintas
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .should('be.visible')
        .find('[data-cy="tag-entrega"]')
        .should('be.visible');

      cy.contains('[data-cy="endereco-card"]', 'Escritório Paulista')
        .should('be.visible')
        .find('[data-cy="tag-entrega"]')
        .should('be.visible');

      cy.contains('[data-cy="endereco-card"]', 'Casa de Campo')
        .should('be.visible')
        .find('[data-cy="tag-entrega"]')
        .should('be.visible');

      // Recarrega a página, resseleciona o cliente e confirma persistência de múltiplos endereços no PostgreSQL
      recarregarEReselecionarCliente(cliente);
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal').should('be.visible');
      cy.contains('[data-cy="endereco-card"]', 'Escritório Paulista').should('be.visible');
      cy.contains('[data-cy="endereco-card"]', 'Casa de Campo').should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 4 — ALTERAR ENDEREÇO EXISTENTE (RNF0034 / RF0026)
  // =========================================================================
  it('TESTE 4 — RNF0034 / RF0026: Alterar campos de endereço existente com persistência após reload', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PUT', '**/api/clientes/*/enderecos/*').as('alterarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      // Abre edição do endereço cadastrado
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .find('[data-cy="endereco-editar-btn"]')
        .click();

      cy.get('[data-cy="endereco-form"]').should('be.visible');

      // Modifica campos: identificação, logradouro, número, bairro, CEP, cidade
      cy.get('[data-cy="endereco-input-nome"]').clear().type('Residencial Reformado');
      cy.get('[data-cy="endereco-logradouro"]').clear().type('Rua dos Pinheiros');
      cy.get('[data-cy="endereco-numero"]').clear().type('789');
      cy.get('[data-cy="endereco-bairro"]').clear().type('Pinheiros');
      cy.get('[data-cy="endereco-cep"]').clear().type('05422001');
      cy.get('[data-cy="endereco-cidade"]').clear().type('São Paulo');

      // Salva alterações
      cy.get('[data-cy="salvar-endereco"]').click();

      // Observa requisição real de alteração e valida HTTP 200 OK
      cy.wait('@alterarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(xhr.request.body.nome).to.eq('Residencial Reformado');
        expect(xhr.request.body.logradouro).to.eq('Rua dos Pinheiros');
        expect(xhr.request.body.numero).to.eq('789');
      });

      // Valida feedback e atualização na interface
      cy.get('[data-cy="toast-container"]')
        .should('be.visible')
        .and('contain.text', 'Endereço atualizado com sucesso');

      cy.contains('[data-cy="endereco-card"]', 'Residencial Reformado')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="endereco-logradouro-txt"]').should('contain.text', 'Rua dos Pinheiros, 789');
          cy.get('[data-cy="endereco-cidade-txt"]').should('contain.text', 'Pinheiros - São Paulo');
          cy.get('[data-cy="endereco-cep-txt"]').should('contain.text', '05422-001');
        });

      // Recarrega, resseleciona o cliente e confirma persistência das alterações no PostgreSQL
      recarregarEReselecionarCliente(cliente);
      cy.contains('[data-cy="endereco-card"]', 'Residencial Reformado')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="endereco-logradouro-txt"]').should('contain.text', 'Rua dos Pinheiros, 789');
        });
    });
  });

  // =========================================================================
  // TESTE 5 — ALTERAÇÃO INDEPENDENTE DOS DADOS CADASTRAIS (RNF0034)
  // =========================================================================
  it('TESTE 5 — RNF0034: Alteração independente de endereço preserva todos os dados cadastrais intactos', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PUT', '**/api/clientes/*/enderecos/*').as('alterarEnderecoReal');

      // 1. Registra os dados cadastrais antes da alteração via API
      consultarClientePorCodigoApi(cliente.codigo).then(clienteAntes => {
        const nomeAntes = clienteAntes.nome;
        const emailAntes = clienteAntes.email;
        const cpfAntes = clienteAntes.cpf;
        const generoAntes = clienteAntes.genero;
        const dataNascimentoAntes = clienteAntes.dataNascimento;
        const telefoneTipoAntes = clienteAntes.telefone?.tipo;
        const telefoneDddAntes = clienteAntes.telefone?.ddd;
        const telefoneNumeroAntes = clienteAntes.telefone?.numero;
        const codigoAntes = clienteAntes.codigo;
        const rankingAntes = clienteAntes.ranking;
        const ativoAntes = clienteAntes.ativo;

        // 2. Altera exclusivamente o endereço pela interface do cliente
        selecionarClienteEAcessarPerfil(cliente);

        cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
          .find('[data-cy="endereco-editar-btn"]')
          .click();

        cy.get('[data-cy="endereco-input-nome"]').clear().type('Endereço Isolado RNF0034');
        cy.get('[data-cy="endereco-logradouro"]').clear().type('Alameda das Amoreiras');
        cy.get('[data-cy="endereco-numero"]').clear().type('444');
        cy.get('[data-cy="salvar-endereco"]').click();

        cy.wait('@alterarEnderecoReal').its('response.statusCode').should('eq', 200);

        // 3. Consulta novamente o cliente no PostgreSQL via API REST
        consultarClientePorCodigoApi(cliente.codigo).then(clienteDepois => {
          // 4. Confirma que todos os dados cadastrais permaneceram estritamente iguais
          expect(clienteDepois.nome).to.eq(nomeAntes);
          expect(clienteDepois.email).to.eq(emailAntes);
          expect(clienteDepois.cpf).to.eq(cpfAntes);
          expect(clienteDepois.genero).to.eq(generoAntes);
          expect(clienteDepois.dataNascimento).to.eq(dataNascimentoAntes);
          expect(clienteDepois.telefone?.tipo).to.eq(telefoneTipoAntes);
          expect(clienteDepois.telefone?.ddd).to.eq(telefoneDddAntes);
          expect(clienteDepois.telefone?.numero).to.eq(telefoneNumeroAntes);
          expect(clienteDepois.codigo).to.eq(codigoAntes);
          expect(clienteDepois.ranking).to.eq(rankingAntes);
          expect(clienteDepois.ativo).to.eq(ativoAntes);

          // 5. Confirma via endpoint de endereços que o endereço foi atualizado no banco
          consultarEnderecosClienteApi(cliente.codigo).then(enderecos => {
            const endAtualizado = (enderecos as any[]).find((e: any) => e.nome === 'Endereço Isolado RNF0034');
            expect(endAtualizado).to.exist;
            expect(endAtualizado.logradouro).to.eq('Alameda das Amoreiras');
            expect(endAtualizado.numero).to.eq('444');
          });
        });
      });
    });
  });

  // =========================================================================
  // TESTE 6 — CAMPOS OBRIGATÓRIOS DO ENDEREÇO (RN0023) E IDENTIFICAÇÃO (RF0026)
  // =========================================================================
  it('TESTE 6 — RN0023 / RF0026: Validação dos 9 campos obrigatórios da RN0023 e identificação do RF0026', () => {
    criarClienteControleApi().then(cliente => {
      selecionarClienteEAcessarPerfil(cliente);

      cy.get('[data-cy="novo-endereco-btn"]').click();
      cy.get('[data-cy="endereco-form"]').should('be.visible');

      // 9 Campos obrigatórios expressos na RN0023
      const camposObrigatoriosRN0023 = [
        { seletor: 'endereco-tipo-residencia', nome: 'Tipo de Residência' },
        { seletor: 'endereco-tipo-logradouro', nome: 'Tipo de Logradouro' },
        { seletor: 'endereco-logradouro', nome: 'Logradouro' },
        { seletor: 'endereco-numero', nome: 'Número' },
        { seletor: 'endereco-bairro', nome: 'Bairro' },
        { seletor: 'endereco-cep', nome: 'CEP' },
        { seletor: 'endereco-cidade', nome: 'Cidade' },
        { seletor: 'endereco-estado', nome: 'Estado' },
        { seletor: 'endereco-pais', nome: 'País' }
      ];

      // 1. Valida que cada um dos 9 campos obrigatórios da RN0023 possui o atributo required
      camposObrigatoriosRN0023.forEach(campo => {
        cy.get(`[data-cy="${campo.seletor}"]`)
          .should('have.attr', 'required');
      });

      // 2. Valida a Identificação / Nome curto como requisito de identificação de RF0026 (separado de RN0023)
      cy.get('[data-cy="endereco-input-nome"]')
        .should('have.attr', 'required');

      // 3. Valida que observações é opcional conforme RN0023 (NÃO possui required)
      cy.get('[data-cy="endereco-observacoes"]').should('not.have.attr', 'required');

      // 4. Complemento é campo opcional do RunWay (NÃO é exigência expressa da RN0023)
      cy.get('[data-cy="endereco-complemento"]').should('not.have.attr', 'required');

      // 5. Valida que ao tentar salvar com campos obrigatórios da RN0023 em branco, a validação impede o envio
      cy.get('[data-cy="endereco-input-nome"]').type('Identificação Válida RF0026');
      cy.get('[data-cy="salvar-endereco"]').click();
      cy.get('[data-cy="endereco-logradouro"]').then($input => {
        expect(($input[0] as HTMLInputElement).checkValidity()).to.be.false;
      });

      // Cancela o modal
      cy.get('[data-cy="cancelar-endereco"]').click();

      // 6. Valida também no backend: envio de endereço sem campo obrigatório da RN0023 (ex: logradouro vazio) retorna HTTP 400
      cy.request({
        method: 'POST',
        url: `http://localhost:5035/api/clientes/${cliente.codigo}/enderecos`,
        failOnStatusCode: false,
        body: {
          nome: 'Identificação RF0026',
          tipoResidencia: 'Casa',
          tipoLogradouro: 'Rua',
          logradouro: '', // CAMPO OBRIGATÓRIO DA RN0023 VAZIO
          numero: '10',
          bairro: 'Centro',
          cep: '01001000',
          cidade: 'São Paulo',
          estado: 'SP',
          pais: 'Brasil',
          entrega: true
        }
      }).then(res => {
        expect(res.status).to.eq(400);
      });
    });
  });

  // =========================================================================
  // TESTE 7 — PELO MENOS UM ENDEREÇO DE ENTREGA (RN0022)
  // =========================================================================
  it('TESTE 7 — RN0022: Bloqueio ao tentar remover a finalidade do único endereço de entrega do cliente', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PUT', '**/api/clientes/*/enderecos/*').as('alterarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      // Abre edição do único endereço (que atualmente possui finalidade de Entrega)
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .find('[data-cy="endereco-editar-btn"]')
        .click();

      // Desmarca a opção de Entrega (deixando apenas residencial e cobrança)
      cy.get('[data-cy="endereco-entrega"]').uncheck();

      // Tenta salvar a alteração
      cy.get('[data-cy="salvar-endereco"]').click();

      // Backend ASP.NET Core processa a regra RN0022 e retorna HTTP 400 Bad Request
      cy.wait('@alterarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(400);
      });

      // Valida banner de erro na interface indicando a regra de negócio
      cy.get('[data-cy="endereco-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'endereço de entrega');

      // Fecha o modal e confirma que o endereço permanece com a tag de Entrega
      cy.get('[data-cy="cancelar-endereco"]').click();
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .find('[data-cy="tag-entrega"]')
        .should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 8 — PELO MENOS UM ENDEREÇO DE COBRANÇA (RN0021)
  // =========================================================================
  it('TESTE 8 — RN0021: Bloqueio ao tentar remover a finalidade do único endereço de cobrança do cliente', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('PUT', '**/api/clientes/*/enderecos/*').as('alterarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      // Abre edição do único endereço (que atualmente possui finalidade de Cobrança)
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .find('[data-cy="endereco-editar-btn"]')
        .click();

      // Desmarca a opção de Cobrança (deixando apenas residencial e entrega)
      cy.get('[data-cy="endereco-cobranca"]').uncheck();

      // Tenta salvar a alteração
      cy.get('[data-cy="salvar-endereco"]').click();

      // Backend processa a regra RN0021 e retorna HTTP 400 Bad Request
      cy.wait('@alterarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(400);
      });

      // Valida banner de erro na interface indicando a regra RN0021
      cy.get('[data-cy="endereco-error-banner"]')
        .should('be.visible')
        .and('contain.text', 'endereço de cobrança');

      // Fecha o modal e confirma que o endereço permanece com a tag de Cobrança
      cy.get('[data-cy="cancelar-endereco"]').click();
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal')
        .find('[data-cy="tag-cobranca"]')
        .should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 9 — ENDEREÇO COM MÚLTIPLAS FINALIDADES (RN0021 / RN0022 / RF0026)
  // =========================================================================
  it('TESTE 9 — RN0021 / RN0022 / RF0026: Endereço acumulando simultaneamente Residencial, Entrega e Cobrança', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/enderecos').as('criarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      cy.get('[data-cy="novo-endereco-btn"]').click();

      cy.get('[data-cy="endereco-input-nome"]').type('Sede Matriz Multifuncional');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Sobrado');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Rua');
      cy.get('[data-cy="endereco-logradouro"]').type('Rua da Matriz');
      cy.get('[data-cy="endereco-numero"]').type('55');
      cy.get('[data-cy="endereco-bairro"]').type('Centro');
      cy.get('[data-cy="endereco-cep"]').type('01001000');
      cy.get('[data-cy="endereco-cidade"]').type('São Paulo');
      cy.get('[data-cy="endereco-estado"]').select('SP');

      // Marca simultaneamente as três finalidades
      cy.get('[data-cy="endereco-residencial"]').check();
      cy.get('[data-cy="endereco-entrega"]').check();
      cy.get('[data-cy="endereco-cobranca"]').check();

      cy.get('[data-cy="salvar-endereco"]').click();

      cy.wait('@criarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(201);
        expect(xhr.request.body.residencial).to.be.true;
        expect(xhr.request.body.entrega).to.be.true;
        expect(xhr.request.body.cobranca).to.be.true;
      });

      // Valida que todas as três tags aparecem no novo card
      cy.contains('[data-cy="endereco-card"]', 'Sede Matriz Multifuncional')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="tag-residencial"]').should('be.visible');
          cy.get('[data-cy="tag-entrega"]').should('be.visible');
          cy.get('[data-cy="tag-cobranca"]').should('be.visible');
        });

      // Valida persistência das três finalidades consultando via API
      consultarEnderecosClienteApi(cliente.codigo).then(enderecos => {
        const multi = (enderecos as any[]).find((e: any) => e.nome === 'Sede Matriz Multifuncional');
        expect(multi).to.exist;
        expect(multi.residencial).to.be.true;
        expect(multi.entrega).to.be.true;
        expect(multi.cobranca).to.be.true;
      });
    });
  });

  // =========================================================================
  // TESTE 10 — OBSERVAÇÕES OPCIONAIS (RN0023)
  // =========================================================================
  it('TESTE 10 — RN0023: Endereço cadastrado sem observações é aceito e persiste com sucesso', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('POST', '**/api/clientes/*/enderecos').as('criarEnderecoReal');

      selecionarClienteEAcessarPerfil(cliente);

      cy.get('[data-cy="novo-endereco-btn"]').click();

      cy.get('[data-cy="endereco-input-nome"]').type('Entrega Sem Observações');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Apartamento');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Rua');
      cy.get('[data-cy="endereco-logradouro"]').type('Rua Direita');
      cy.get('[data-cy="endereco-numero"]').type('300');
      cy.get('[data-cy="endereco-bairro"]').type('Sé');
      cy.get('[data-cy="endereco-cep"]').type('01002000');
      cy.get('[data-cy="endereco-cidade"]').type('São Paulo');
      cy.get('[data-cy="endereco-estado"]').select('SP');

      // Mantém campos observações e complemento rigorosamente vazios
      cy.get('[data-cy="endereco-complemento"]').should('have.value', '');
      cy.get('[data-cy="endereco-observacoes"]').should('have.value', '');

      cy.get('[data-cy="endereco-entrega"]').check();

      cy.get('[data-cy="salvar-endereco"]').click();

      // Confirma que a API aceita observações vazias / null
      cy.wait('@criarEnderecoReal').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(201);
        expect(xhr.request.body.observacoes).to.be.null;
      });

      // Valida na interface e após reload com resseleção do cliente
      cy.contains('[data-cy="endereco-card"]', 'Entrega Sem Observações').should('be.visible');
      recarregarEReselecionarCliente(cliente);
      cy.contains('[data-cy="endereco-card"]', 'Entrega Sem Observações').should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 11 — IDENTIFICAÇÃO CURTA DO ENDEREÇO (RF0026)
  // =========================================================================
  it('TESTE 11 — RF0026: Identificação curta (frase/nome) é obrigatória e distingue os endereços na listagem', () => {
    criarClienteControleApi().then(cliente => {
      selecionarClienteEAcessarPerfil(cliente);

      // 1. Abre modal e valida que o campo de Identificação é obrigatório
      cy.get('[data-cy="novo-endereco-btn"]').click();
      cy.get('[data-cy="endereco-input-nome"]')
        .should('have.attr', 'required');

      // 2. Preenche com nome curto "Trabalho"
      cy.get('[data-cy="endereco-input-nome"]').type('Trabalho');
      cy.get('[data-cy="endereco-tipo-residencia"]').select('Comercial');
      cy.get('[data-cy="endereco-tipo-logradouro"]').select('Rua');
      cy.get('[data-cy="endereco-logradouro"]').type('Rua da Consolação');
      cy.get('[data-cy="endereco-numero"]').type('1500');
      cy.get('[data-cy="endereco-bairro"]').type('Consolação');
      cy.get('[data-cy="endereco-cep"]').type('01302001');
      cy.get('[data-cy="endereco-cidade"]').type('São Paulo');
      cy.get('[data-cy="endereco-estado"]').select('SP');
      cy.get('[data-cy="endereco-entrega"]').check();
      cy.get('[data-cy="salvar-endereco"]').click();

      // 3. Valida que os dois endereços do cliente são facilmente distinguidos por seus nomes curtos
      cy.get('[data-cy="endereco-card"]').should('have.length', 2);
      cy.contains('[data-cy="endereco-card"]', 'Residencial Principal').should('be.visible');
      cy.contains('[data-cy="endereco-card"]', 'Trabalho').should('be.visible');
    });
  });

});
