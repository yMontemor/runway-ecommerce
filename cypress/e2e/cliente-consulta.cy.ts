/**
 * SUÍTE DE TESTES E2E — CONSULTA DE CLIENTES (RUNWAY)
 * 
 * RASTREABILIDADE FORMAL COM REQUISITOS DO PROJETO:
 * - RF0024: Consulta de clientes por filtros definidos pelo usuário,
 *           utilizando os campos de identificação isoladamente ou combinados
 *           (código, nome, CPF, e-mail, gênero, data de nascimento, telefone, status).
 * - RNF0011: Desempenho da consulta com tempo de resposta máximo de 1 segundo (<= 1000 ms).
 * 
 * INTEGRAÇÃO REAL PONTAPONTO:
 * Cypress -> React (Frontend) -> ASP.NET Core API (Backend) -> EF Core -> PostgreSQL (Banco Real)
 * Nenhuma resposta de sucesso da API de clientes é mockada.
 * Os clientes de controle são criados e persistidos no PostgreSQL real via API antes dos testes.
 * 
 * RESSALVA TÉCNICA OBRIGATÓRIA SOBRE RNF0011:
 * "A medição comprova o tempo de resposta no ambiente local de execução da entrega.
 * Não representa benchmark de produção ou teste de carga concorrente."
 */

describe('Suíte E2E: Consulta de Clientes — RunWay (RF0024 / RNF0011)', () => {

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
   * Não mocka dados: garante persistência real antes da validação pela interface.
   */
  function criarClienteControleApi(dados?: Partial<{
    nome: string;
    email: string;
    cpf: string;
    genero: string;
    dataNascimento: string; // YYYY-MM-DD
    ddd: string;
    numeroTelefone: string;
  }>): Cypress.Chainable<ClienteControle> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    const cpfRaw = dados?.cpf || gerarCpfValido();
    const nome = dados?.nome || `Cypress Consulta ${ts}`;
    const email = dados?.email || `cypress.consulta.${ts}@runway.test`;
    const genero = dados?.genero || 'Feminino';
    const dataNascimento = dados?.dataNascimento || '1992-05-15';
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
          tipo: 'Celular',
          ddd,
          numero: numeroTelefone
        },
        enderecos: [
          {
            nome: 'Residencial Principal',
            tipoResidencia: 'Casa',
            tipoLogradouro: 'Rua',
            logradouro: 'Rua das Consultas Cypress',
            numero: '500',
            complemento: 'Apto 12',
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
          ddd: b.telefone?.ddd || ddd,
          numero: b.telefone?.numero || numeroTelefone
        }
      };
    });
  }

  /**
   * Inativa um cliente no PostgreSQL via PATCH /api/clientes/{codigo}/inativar.
   */
  function inativarClienteApi(codigo: string) {
    return cy.request({
      method: 'PATCH',
      url: `http://localhost:5035/api/clientes/${encodeURIComponent(codigo)}/inativar`
    }).then(res => {
      expect(res.status).to.eq(200);
    });
  }

  /**
   * Helper para navegação padrão até a tela de Gestão de Clientes e aguardo da carga inicial
   */
  function navegarParaGestaoClientes() {
    cy.visit('/');
    cy.get('[data-cy="user-dropdown"]').click();
    cy.get('[data-cy="painel-admin"]').click();
    cy.location('pathname').should('eq', '/admin');
    cy.get('[data-cy="admin-clientes"]').click();
    cy.contains('h3', 'Gestão de Clientes').should('be.visible');
    cy.get('[data-cy="tabela-clientes"]').should('be.visible');
    cy.get('.rw-spinner').should('not.exist');
  }

  // =========================================================================
  // TESTE 1: LISTAGEM GERAL DE CLIENTES
  // RF0024 — Consulta sem parâmetros retorna a listagem geral com dados relevantes
  // =========================================================================
  it('TESTE 1 — Listagem geral de clientes (RF0024)', () => {
    criarClienteControleApi().then(cliente => {
      cy.intercept('GET', '**/api/clientes').as('consultaInicial');

      navegarParaGestaoClientes();

      // Validar que a tabela é carregada e o cliente de controle aparece
      cy.get('[data-cy="tabela-clientes"]').should('be.visible');
      cy.contains('[data-cy="cliente-codigo"]', cliente.codigo).should('be.visible');

      // Validar exibição dos dados relevantes
      cy.contains('[data-cy="cliente-row"]', cliente.codigo).within(() => {
        cy.get('[data-cy="cliente-codigo"]').should('contain.text', cliente.codigo);
        cy.get('[data-cy="cliente-nome-cell"]').should('contain.text', cliente.nome);
        cy.get('[data-cy="cliente-cpf-cell"]').should('contain.text', cliente.cpfFormatado);
        cy.get('[data-cy="cliente-email-cell"]').should('contain.text', cliente.email);
        cy.get('[data-cy="cliente-status-cell"]').should('contain.text', 'ATIVO');
      });
    });
  });

  // =========================================================================
  // TESTE 2: CONSULTA POR NOME (COMPLETO E PARCIAL)
  // RF0024 — Consulta por nome com suporte a busca parcial
  // =========================================================================
  it('TESTE 2 — Consulta por nome completo e parcial (RF0024)', () => {
    const ts = Date.now();
    const nomeAlfa = `Cypress Consulta NomeAlfa ${ts}`;
    const nomeBeta = `Cypress Consulta NomeBeta ${ts}`;

    criarClienteControleApi({ nome: nomeAlfa }).then(clienteA => {
      criarClienteControleApi({ nome: nomeBeta }).then(clienteB => {
        navegarParaGestaoClientes();

        // 1. Busca por nome completo do Cliente A
        cy.intercept('GET', '**/api/clientes?*').as('consultaPorNome');

        cy.get('[data-cy="admin-search-input"]').clear().type(clienteA.nome);
        cy.get('[data-cy="admin-search-btn"]').click();

        cy.wait('@consultaPorNome').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          const urlDecoded = decodeURIComponent(xhr.request.url).replace(/\+/g, ' ');
          expect(urlDecoded).to.include(clienteA.nome);
        });

        // Cliente A aparece, Cliente B não
        cy.contains('[data-cy="cliente-row"]', clienteA.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', clienteB.codigo).should('not.exist');

        // 2. Busca por nome parcial do Cliente A ("NomeAlfa <ts>")
        const termoParcial = `NomeAlfa ${ts}`;
        cy.get('[data-cy="admin-search-input"]').clear().type(termoParcial);
        cy.get('[data-cy="admin-search-btn"]').click();

        cy.wait('@consultaPorNome').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          const urlDecoded = decodeURIComponent(xhr.request.url).replace(/\+/g, ' ');
          expect(urlDecoded).to.include(termoParcial);
        });

        cy.contains('[data-cy="cliente-row"]', clienteA.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', clienteB.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 3: CONSULTA POR CÓDIGO GERADO PELO BACKEND
  // RF0024 — Consulta pontual por código único do cliente
  // =========================================================================
  it('TESTE 3 — Consulta por código único do cliente (RF0024)', () => {
    criarClienteControleApi().then(cliente => {
      criarClienteControleApi().then(outroCliente => {
        navegarParaGestaoClientes();

        cy.intercept('GET', '**/api/clientes?*').as('consultaPorCodigo');

        // Abre filtros avançados e busca pelo código real retornado no setup
        cy.get('[data-cy="toggle-filtros-avancados"]').click();
        cy.get('[data-cy="filtro-codigo"]').clear().type(cliente.codigo);
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaPorCodigo').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          expect(decodeURIComponent(xhr.request.url)).to.include(`codigo=${cliente.codigo}`);
        });

        // Somente o cliente com o código correspondente é exibido
        cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', outroCliente.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 4: CONSULTA POR CPF (COM MÁSCARA E SEM MÁSCARA)
  // RF0024 — Consulta por CPF aceita ambos os formatos via normalização de dígitos
  // =========================================================================
  it('TESTE 4 — Consulta por CPF com e sem máscara (RF0024)', () => {
    criarClienteControleApi().then(cliente => {
      criarClienteControleApi().then(outroCliente => {
        navegarParaGestaoClientes();

        cy.intercept('GET', '**/api/clientes?*').as('consultaPorCpf');

        cy.get('[data-cy="toggle-filtros-avancados"]').click();

        // 1. Consulta com CPF mascarado (ex: 123.456.789-01)
        cy.get('[data-cy="filtro-cpf"]').clear().type(cliente.cpfFormatado);
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaPorCpf').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
        });

        cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', outroCliente.codigo).should('not.exist');

        // 2. Consulta com CPF sem máscara (somente 11 dígitos)
        cy.get('[data-cy="filtro-cpf"]').clear().type(cliente.cpf);
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaPorCpf').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
        });

        cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', outroCliente.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 5: CONSULTA POR E-MAIL
  // RF0024 — Consulta pontual por e-mail exclusivo
  // =========================================================================
  it('TESTE 5 — Consulta por e-mail (RF0024)', () => {
    criarClienteControleApi().then(cliente => {
      criarClienteControleApi().then(outroCliente => {
        navegarParaGestaoClientes();

        cy.intercept('GET', '**/api/clientes?*').as('consultaPorEmail');

        cy.get('[data-cy="toggle-filtros-avancados"]').click();
        cy.get('[data-cy="filtro-email"]').clear().type(cliente.email);
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaPorEmail').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          expect(decodeURIComponent(xhr.request.url)).to.include(`email=${cliente.email}`);
        });

        cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', outroCliente.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 6: CONSULTA ISOLADA POR GÊNERO
  // RF0024 — Consulta filtrando exclusivamente pelo campo Gênero
  // =========================================================================
  it('TESTE 6 — Consulta isolada por gênero (RF0024)', () => {
    const ts = Date.now();
    const nomeFem = `Cypress GeneroFem ${ts}`;
    const nomeMasc = `Cypress GeneroMasc ${ts}`;

    criarClienteControleApi({ nome: nomeFem, genero: 'Feminino' }).then(clienteFem => {
      criarClienteControleApi({ nome: nomeMasc, genero: 'Masculino' }).then(clienteMasc => {
        navegarParaGestaoClientes();

        cy.intercept('GET', '**/api/clientes?*').as('consultaPorGenero');

        cy.get('[data-cy="toggle-filtros-avancados"]').click();

        // Filtra estritamente pelo gênero 'Feminino' sem outros campos preenchidos
        cy.get('[data-cy="filtro-genero"]').select('Feminino');
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaPorGenero').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          const url = decodeURIComponent(xhr.request.url);
          expect(url).to.include('genero=Feminino');
          // Confirma que nenhum outro filtro foi adicionado na query
          expect(url).to.not.include('nome=');
          expect(url).to.not.include('cpf=');
          expect(url).to.not.include('codigo=');
          expect(url).to.not.include('ativo=');
        });

        // Confirma que o cliente do gênero filtrado (Feminino) aparece
        cy.contains('[data-cy="cliente-row"]', clienteFem.codigo).should('be.visible');

        // Confirma que o cliente do outro gênero (Masculino) não aparece
        cy.contains('[data-cy="cliente-row"]', clienteMasc.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 7: FILTROS AVANÇADOS COMBINADOS
  // RF0024 — Permite combinar múltiplos filtros simultaneamente (AND)
  // =========================================================================
  it('TESTE 7 — Filtros avançados combinados: nome + gênero + status (RF0024)', () => {
    const ts = Date.now();
    const nomeBase = `Cypress Combina ${ts}`;
    const nomeFem = `${nomeBase} Feminino`;
    const nomeMasc = `${nomeBase} Masculino`;

    criarClienteControleApi({ nome: nomeFem, genero: 'Feminino' }).then(clienteA => {
      criarClienteControleApi({ nome: nomeMasc, genero: 'Masculino' }).then(clienteB => {
        navegarParaGestaoClientes();

        cy.intercept('GET', '**/api/clientes?*').as('consultaCombinada');

        cy.get('[data-cy="toggle-filtros-avancados"]').click();

        // Combina: Nome parcial + Gênero Feminino + Status ATIVO
        cy.get('[data-cy="filtro-nome"]').clear().type(nomeBase);
        cy.get('[data-cy="filtro-genero"]').select('Feminino');
        cy.get('[data-cy="filtro-status"]').select('ATIVO');
        cy.get('[data-cy="btn-aplicar-filtros"]').click();

        cy.wait('@consultaCombinada').then(xhr => {
          expect(xhr.response?.statusCode).to.eq(200);
          const url = decodeURIComponent(xhr.request.url).replace(/\+/g, ' ');
          expect(url).to.include(`nome=${nomeBase}`);
          expect(url).to.include('genero=Feminino');
          expect(url).to.include('ativo=true');
        });

        // Apenas o Cliente A (Feminino) deve aparecer; Cliente B (Masculino) não
        cy.contains('[data-cy="cliente-row"]', clienteA.codigo).should('be.visible');
        cy.contains('[data-cy="cliente-row"]', clienteB.codigo).should('not.exist');
      });
    });
  });

  // =========================================================================
  // TESTE 8: CONSULTA POR DATA DE NASCIMENTO
  // RF0024 — Consulta com formato dd/mm/aaaa na UI convertido para YYYY-MM-DD
  // =========================================================================
  it('TESTE 8 — Consulta por data de nascimento (RF0024)', () => {
    const ts = Date.now();
    const nome = `Cypress DataNasc ${ts}`;
    const dataIso = '1993-07-22';
    const dataBr = '22/07/1993';

    criarClienteControleApi({ nome, dataNascimento: dataIso }).then(cliente => {
      navegarParaGestaoClientes();

      cy.intercept('GET', '**/api/clientes?*').as('consultaPorDataNasc');

      cy.get('[data-cy="toggle-filtros-avancados"]').click();

      // Preenche nome para isolar escopo e a data de nascimento no formato aceito pela interface
      cy.get('[data-cy="filtro-nome"]').clear().type(nome);
      cy.get('[data-cy="filtro-data-nascimento"]').clear().type(dataBr);
      cy.get('[data-cy="btn-aplicar-filtros"]').click();

      cy.wait('@consultaPorDataNasc').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(decodeURIComponent(xhr.request.url)).to.include(`dataNascimento=${dataIso}`);
      });

      cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 9: CONSULTA POR TELEFONE
  // RF0024 — Consulta por telefone (DDD + número)
  // =========================================================================
  it('TESTE 9 — Consulta por telefone (RF0024)', () => {
    const ts = Date.now();
    const ddd = '19';
    const numero = '971112233';
    const nome = `Cypress Telefone ${ts}`;

    criarClienteControleApi({ nome, ddd, numeroTelefone: numero }).then(cliente => {
      navegarParaGestaoClientes();

      cy.intercept('GET', '**/api/clientes?*').as('consultaPorTelefone');

      cy.get('[data-cy="toggle-filtros-avancados"]').click();
      cy.get('[data-cy="filtro-telefone"]').clear().type(`${ddd}${numero}`);
      cy.get('[data-cy="btn-aplicar-filtros"]').click();

      cy.wait('@consultaPorTelefone').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
        expect(decodeURIComponent(xhr.request.url)).to.include(`telefone=${ddd}${numero}`);
      });

      cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 10: CONSULTA POR SITUAÇÃO CADASTRAL (ATIVO / INATIVO)
  // RF0024 — Filtro por status ativo/inativo
  // =========================================================================
  it('TESTE 10 — Consulta por status ATIVO e INATIVO (RF0024)', () => {
    const ts = Date.now();
    const prefixo = `Cypress Status ${ts}`;
    const nomeAtivo = `${prefixo} Ativo`;
    const nomeInativo = `${prefixo} Inativo`;

    criarClienteControleApi({ nome: nomeAtivo }).then(clienteAtivo => {
      criarClienteControleApi({ nome: nomeInativo }).then(clienteInativo => {
        // Inativa o segundo cliente de controle via API real
        inativarClienteApi(clienteInativo.codigo).then(() => {
          navegarParaGestaoClientes();

          cy.intercept('GET', '**/api/clientes?*').as('consultaPorStatus');

          cy.get('[data-cy="toggle-filtros-avancados"]').click();

          // 1. Filtrar por ATIVO (com o prefixo para restringir ao teste)
          cy.get('[data-cy="filtro-nome"]').clear().type(prefixo);
          cy.get('[data-cy="filtro-status"]').select('ATIVO');
          cy.get('[data-cy="btn-aplicar-filtros"]').click();

          cy.wait('@consultaPorStatus').then(xhr => {
            expect(xhr.response?.statusCode).to.eq(200);
            expect(decodeURIComponent(xhr.request.url)).to.include('ativo=true');
          });

          cy.contains('[data-cy="cliente-row"]', clienteAtivo.codigo).should('be.visible');
          cy.contains('[data-cy="cliente-row"]', clienteInativo.codigo).should('not.exist');

          // 2. Filtrar por INATIVO
          cy.get('[data-cy="filtro-status"]').select('INATIVO');
          cy.get('[data-cy="btn-aplicar-filtros"]').click();

          cy.wait('@consultaPorStatus').then(xhr => {
            expect(xhr.response?.statusCode).to.eq(200);
            expect(decodeURIComponent(xhr.request.url)).to.include('ativo=false');
          });

          cy.contains('[data-cy="cliente-row"]', clienteInativo.codigo).should('be.visible');
          cy.contains('[data-cy="cliente-row"]', clienteAtivo.codigo).should('not.exist');
        });
      });
    });
  });

  // =========================================================================
  // TESTE 11: NENHUM RESULTADO ENCONTRADO
  // RF0024 — Consulta com termo inexistente exibe mensagem de lista vazia sem erro
  // =========================================================================
  it('TESTE 11 — Consulta com nenhum resultado exibe estado vazio apropriado (RF0024)', () => {
    const termoInexistente = `NAO-EXISTE-${Date.now()}`;

    navegarParaGestaoClientes();

    cy.intercept('GET', '**/api/clientes?*').as('consultaVazia');

    cy.get('[data-cy="admin-search-input"]').clear().type(termoInexistente);
    cy.get('[data-cy="admin-search-btn"]').click();

    cy.wait('@consultaVazia').then(xhr => {
      expect(xhr.response?.statusCode).to.eq(200);
    });

    // Validar mensagem de estado vazio
    cy.get('[data-cy="empty-state-message"]')
      .should('be.visible')
      .and('contain.text', 'Nenhum cliente encontrado com os filtros selecionados.');

    // Nenhuma linha de cliente deve existir
    cy.get('[data-cy="cliente-row"]').should('not.exist');
  });

  // =========================================================================
  // TESTE 12: LIMPAR FILTROS
  // RF0024 — Reset de filtros retorna à listagem completa de clientes
  // =========================================================================
  it('TESTE 12 — Ação de limpar filtros restaura listagem geral (RF0024)', () => {
    criarClienteControleApi().then(cliente => {
      navegarParaGestaoClientes();

      cy.intercept('GET', '**/api/clientes?*').as('consultaFiltroCodigo');

      // Aplica filtro restritivo que encontra apenas o cliente de controle
      cy.get('[data-cy="toggle-filtros-avancados"]').click();
      cy.get('[data-cy="filtro-codigo"]').clear().type(cliente.codigo);
      cy.get('[data-cy="btn-aplicar-filtros"]').click();
      cy.wait('@consultaFiltroCodigo');

      cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');

      // Intercepta a requisição sem query params decorrente do reset
      cy.intercept('GET', '**/api/clientes').as('consultaLimpa');

      // Clica em Limpar Filtros
      cy.get('[data-cy="btn-limpar-filtros"]').click();

      // Aguarda recarregamento da consulta sem query parameters
      cy.wait('@consultaLimpa').then(xhr => {
        expect(xhr.response?.statusCode).to.eq(200);
      });

      // Valida que os campos de filtros avançados foram limpos
      cy.get('[data-cy="filtro-codigo"]').should('have.value', '');
      cy.get('[data-cy="filtro-nome"]').should('have.value', '');
      cy.get('[data-cy="filtro-cpf"]').should('have.value', '');
      cy.get('[data-cy="admin-search-input"]').should('have.value', '');

      // Tabela continua visível exibindo a listagem geral
      cy.get('[data-cy="tabela-clientes"]').should('be.visible');
    });
  });

  // =========================================================================
  // TESTE 13: MEDIÇÃO CONTROLADA DE DESEMPENHO (RNF0011)
  // RNF0011 — Tempo de resposta máximo de 1 segundo (<= 1000 ms) na consulta
  // =========================================================================
  it('TESTE 13 — Medição de tempo de resposta da consulta <= 1000 ms (RNF0011)', () => {
    criarClienteControleApi().then(cliente => {
      navegarParaGestaoClientes();

      cy.intercept('GET', '**/api/clientes?*').as('consultaClientesRnf');

      // Executa consulta pela interface e mede o tempo de resposta da chamada real
      cy.get('[data-cy="admin-search-input"]').clear().type(cliente.nome);

      let inicioAcao: number;
      cy.then(() => {
        inicioAcao = Date.now();
      });
      cy.get('[data-cy="admin-search-btn"]').click();

      cy.wait('@consultaClientesRnf').then(interception => {
        const fimResposta = Date.now();
        const duracaoMs = fimResposta - inicioAcao;

        expect(interception.response?.statusCode).to.eq(200);

        cy.log(`[RNF0011] Duração da consulta GET /api/clientes: ${duracaoMs} ms (Limite: 1000 ms)`);

        // Validação estrita do requisito RNF0011: máximo 1000 ms
        expect(duracaoMs, 'Tempo de resposta da consulta deve ser <= 1000ms').to.be.lte(1000);

        // Documentação da ressalva mandatória de ambiente local
        cy.log(
          'A medição comprova o tempo de resposta no ambiente local de execução da entrega. ' +
          'Não representa benchmark de produção ou teste de carga concorrente.'
        );
      });

      // Confirma que a interface renderizou o resultado
      cy.contains('[data-cy="cliente-row"]', cliente.codigo).should('be.visible');
    });
  });

});
