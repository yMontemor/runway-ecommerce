/**
 * Suíte E2E: Validação de Desempenho da Análise Gerencial (Cenário 8).
 * Comprovação Automatizada do Requisito Não Funcional RNF0011: Tempo de Resposta <= 1.000 ms.
 * 
 * Regras Obrigatórias da Execução:
 * 1. Opera exclusivamente no banco de testes "runway_test" com a massa oficial do Cartão 02.
 * 2. Confirmação obrigatória de que tanto a conexão de testes quanto a API ASP.NET Core estão no banco "runway_test".
 * 3. Medição HTTP real via cy.request() utilizando a propriedade nativa response.duration (ms).
 * 4. Executa 4 variações essenciais da consulta gerencial:
 *    - Variação 1: Consulta de uma categoria (Treino Diário, 5 meses).
 *    - Variação 2: Consulta comparativa de duas categorias (Treino Diário + Competição, 5 meses).
 *    - Variação 3: Consulta de período mínimo de um mês (Jan/2026).
 *    - Variação 4: Consulta de período máximo de 24 meses (RN0072).
 * 5. Cada variação executa 2 requisições de aquecimento (warmup) e 5 medições oficiais consecutivas.
 * 6. Critérios estritos em CADA medição oficial:
 *    - HTTP 200 OK;
 *    - response.duration <= 1.000 ms (RNF0011);
 *    - Total financeiro rigorosamente conforme o gabarito oficial;
 *    - Ausência de mocks, fixtures ou dados simulados.
 * 7. Sem retries automáticos ({ retries: 0 }) para assegurar confiabilidade estrita.
 * 8. Registro de tempos mínimo, médio e máximo sem expor credenciais administrativas.
 */

describe('Cenário 8 — Validação de Desempenho RNF0011 no Cypress (Consultas <= 1.000 ms)', { retries: 0 }, () => {
  let adminKey = '';
  const LIMITE_RNF0011_MS = 1000.0;
  const API_BASE_URL = 'http://localhost:5035';

  before(() => {
    // 1. Confirmar isolamento rigoroso no banco runway_test
    cy.task('confirmarBancoSeguro').then((res: any) => {
      expect(res.seguro, 'Script de testes deve estar conectado estritamente a runway_test').to.be.true;
      expect(res.banco).to.eq('runway_test');
    });

    // 2. Garantir preparação determinística da massa do Cartão 02
    cy.task('prepararMassaAnalise');

    // 3. Obter credencial administrativa exclusivamente de variável de ambiente (sem fallback fixo)
    cy.task('obterAdminKey').then((key: any) => {
      adminKey = (key as string) || '';
      expect(adminKey, 'Variável de ambiente RUNWAY_ADMIN_KEY não configurada').to.be.a('string').and.not.be.empty;

      // 4. Validar autorização administrativa preliminar na API
      cy.request({
        url: `${API_BASE_URL}/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO`,
        headers: {
          Authorization: `Bearer ${adminKey}`
        },
        failOnStatusCode: false
      }).then((res) => {
        expect(res.status, 'Chave administrativa deve ser aceita pela API (HTTP 200)').to.eq(200);
      });
    });

    // 5. Confirmar que a API ASP.NET Core está ativa e consome comprovadamente o banco runway_test
    // O pedido PED-ANL-0001 existe exclusivamente em runway_test e não existe no banco runway
    cy.request({
      url: `${API_BASE_URL}/api/pedidos/PED-ANL-0001`,
      failOnStatusCode: false
    }).then((res) => {
      if (res.status === 404) {
        throw new Error(
          '[FALHA DE SEGURANÇA E ISOLAMENTO] A API ASP.NET Core retornou 404 para PED-ANL-0001!\n' +
          'Isso indica que o backend está conectado ao banco runway e NÃO a runway_test. Execução abortada.'
        );
      }
      expect(res.status, 'API deve responder 200 OK para pedido canônico da massa').to.eq(200);
      expect(res.body?.codigo).to.eq('PED-ANL-0001');
    });
  });

  after(() => {
    // Restauração da base de dados após os testes
    cy.task('prepararMassaAnalise');
  });

  /**
   * Função executora parametrizada para cada variação de teste de desempenho
   */
  const executarVariacaoDesempenho = ({
    nomeVariacao,
    queryString,
    valorEsperado,
    subtotaisEsperados
  }: {
    nomeVariacao: string;
    queryString: string;
    valorEsperado: number;
    subtotaisEsperados?: Record<string, number>;
  }) => {
    const urlCompleta = `${API_BASE_URL}/api/analise/vendas?${queryString}`;
    const headersAuth = { Authorization: `Bearer ${adminKey}` };

    cy.log(`--- [WARMUP] Executando 2 requisições preliminares para: ${nomeVariacao} ---`);
    // 1. Aquecimentos (Warmup x2)
    for (let w = 1; w <= 2; w++) {
      cy.request({
        url: urlCompleta,
        headers: headersAuth,
        log: false
      }).then((warmRes) => {
        cy.log(`[WARMUP ${w}] Tempo de resposta: ${warmRes.duration} ms (Status: ${warmRes.status})`);
      });
    }

    // 2. Medições Oficiais (x5)
    const duracoesOficiais: number[] = [];

    cy.log(`--- [OFICIAL] Executando 5 medições consecutivas para: ${nomeVariacao} ---`);
    for (let i = 1; i <= 5; i++) {
      cy.request({
        url: urlCompleta,
        headers: headersAuth,
        log: false
      }).then((oficialRes) => {
        // Validação Estrita 1: Status HTTP 200 OK obrigatório
        expect(oficialRes.status, `Amostra ${i} deve responder HTTP 200 OK`).to.eq(200);

        // Validação Estrita 2: Requisito Não Funcional RNF0011 (<= 1.000 ms)
        expect(
          oficialRes.duration,
          `Amostra ${i} (${oficialRes.duration} ms) deve cumprir o limite do RNF0011 (<= ${LIMITE_RNF0011_MS} ms)`
        ).to.be.lte(LIMITE_RNF0011_MS);

        // Validação Estrita 3: Integridade financeira contábil
        expect(oficialRes.body, 'Corpo da resposta deve conter objeto JSON válido').to.exist;
        expect(
          oficialRes.body.totalGeral,
          `Amostra ${i} deve retornar total geral de R$ ${valorEsperado}`
        ).to.be.closeTo(valorEsperado, 0.01);

        // Validação opcional de subtotais por categoria
        if (subtotaisEsperados) {
          for (const [catNome, catEsperado] of Object.entries(subtotaisEsperados)) {
            const serie = oficialRes.body.series?.find((s: any) => s.categoria === catNome);
            expect(serie, `Série ${catNome} deve existir na resposta`).to.exist;
            expect(serie.total, `Subtotal de ${catNome} deve ser R$ ${catEsperado}`).to.be.closeTo(catEsperado, 0.01);
          }
        }

        duracoesOficiais.push(oficialRes.duration);
        cy.log(`[OFICIAL ${i}/5] Tempo: ${oficialRes.duration} ms | Total: R$ ${oficialRes.body.totalGeral}`);
      });
    }

    // 3. Consolidação Estatística da Variação
    cy.then(() => {
      const min = Math.min(...duracoesOficiais);
      const max = Math.max(...duracoesOficiais);
      const avg = Number((duracoesOficiais.reduce((a, b) => a + b, 0) / duracoesOficiais.length).toFixed(2));

      cy.log(`=======================================================`);
      cy.log(` ESTATÍSTICAS RNF0011 — ${nomeVariacao}`);
      cy.log(` Mínimo: ${min} ms | Média: ${avg} ms | Máximo: ${max} ms`);
      cy.log(` Limite Exigido: <= ${LIMITE_RNF0011_MS} ms | Conforme: SIM`);
      cy.log(`=======================================================`);

      expect(max, `Tempo máximo da variação (${max} ms) deve respeitar o RNF0011`).to.be.lte(LIMITE_RNF0011_MS);
      expect(avg, `Tempo médio da variação (${avg} ms) deve respeitar o RNF0011`).to.be.lte(LIMITE_RNF0011_MS);
    });
  };

  // =========================================================================================
  // VARIAÇÃO 1 — CONSULTA DE UMA CATEGORIA (TREINO DIÁRIO, 5 MESES)
  // =========================================================================================
  it('Variação 1 — Consulta de uma única categoria (Treino Diário) responde em menos de 1.000 ms com R$ 2.350,59', () => {
    executarVariacaoDesempenho({
      nomeVariacao: '1 Categoria (Treino Diário - 5 Meses)',
      queryString: 'dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO',
      valorEsperado: 2350.59,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59
      }
    });
  });

  // =========================================================================================
  // VARIAÇÃO 2 — CONSULTA COMPARATIVA DE DUAS CATEGORIAS (TREINO DIÁRIO + COMPETIÇÃO)
  // =========================================================================================
  it('Variação 2 — Consulta comparativa de duas categorias responde em menos de 1.000 ms com R$ 7.850,09', () => {
    executarVariacaoDesempenho({
      nomeVariacao: '2 Categorias (Treino Diário + Competição - 5 Meses)',
      queryString: 'dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    });
  });

  // =========================================================================================
  // VARIAÇÃO 3 — CONSULTA DE PERÍODO MÍNIMO DE 1 MÊS (JANEIRO/2026)
  // =========================================================================================
  it('Variação 3 — Consulta de período mínimo de um mês (Jan/2026) responde em menos de 1.000 ms com R$ 2.750,79', () => {
    executarVariacaoDesempenho({
      nomeVariacao: '1 Mês (Janeiro/2026)',
      queryString: 'dataInicio=2026-01-01&dataFim=2026-01-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      valorEsperado: 2750.79,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 550.99,
        'COMPETIÇÃO': 2199.80
      }
    });
  });

  // =========================================================================================
  // VARIAÇÃO 4 — CONSULTA DE PERÍODO MÁXIMO DE 24 MESES (RN0072)
  // =========================================================================================
  it('Variação 4 — Consulta de período máximo de 24 meses responde em menos de 1.000 ms com R$ 7.850,09', () => {
    executarVariacaoDesempenho({
      nomeVariacao: '24 Meses Máximos (RN0072)',
      queryString: 'dataInicio=2024-04-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    });
  });
});
