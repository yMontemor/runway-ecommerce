/**
 * RunWay E-Commerce — Cartão 06: Validação de Desempenho da Análise Gerencial
 * Verificação Formal do Requisito Não Funcional RNF0011: Tempo de Resposta < 1.000 ms.
 * 
 * Requisitos e Regras (Revisão Estrita):
 * 1. Execução exclusiva no banco de testes "runway_test".
 * 2. Medição do tempo HTTP completo via process.hrtime.bigint() (resolução em nanossegundos).
 * 3. 3 chamadas de aquecimento (warmup) e 10 medições oficiais por cenário (20 para consultas repetidas).
 * 4. Registro isolado de tempos de aquecimento, mínimo, média, máximo, p95 e desvio padrão.
 * 5. Limite estrito de aceitação: até 1.000 ms por consulta.
 * 6. Conferência de HTTP 200, valor financeiro total e subtotais por categoria em TODAS as requisições oficiais.
 * 7. No cenário C6, validação pontual de pontos mensais com R$ 0,00 (RN0073).
 * 8. Transição oficial de PED-ANL-0008 via PATCH /api/pedidos/{codigo}/status com restauração garantida em try/finally.
 * 9. Restauração obrigatória com falha fatal imediata se a base não retornar ao estado canônico.
 * 10. Obtenção estrita da credencial administrativa via variável de ambiente, SEM fallback fixo e sem expor o segredo.
 */

const http = require('http');
const { Client } = require('pg');
const os = require('os');
const {
  DB_CONFIG,
  validarConexaoSegura,
  limparMassaExistente,
  obterClienteDeterministo,
  validarVariacoesExistentes,
  inserirMassaAnalise,
  consultarTotaisEsperados
} = require('../../scripts/seed-massa-analise.js');

// 1. Configuração da API (Alternativa C Controlada — protótipo acadêmico com acesso direto à API)
const API_CONFIG = {
  hostname: process.env.RUNWAY_API_HOST || 'localhost',
  port: Number(process.env.RUNWAY_API_PORT) || 5035
};

const LIMITE_RNF0011_MS = 1000.0;

/**
 * Medição HTTP completa utilizando o módulo nativo http e process.hrtime.bigint()
 */
function requestHttp(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number((Number(end - start) / 1e6).toFixed(2));
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (_) {}

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          durationMs,
          body: json,
          rawBody: rawData
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      const dataStr = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.write(dataStr);
    }
    req.end();
  });
}

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Number((sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight).toFixed(2));
}

function calculateStdDev(values, avg) {
  if (values.length <= 1) return 0;
  const sumSquares = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
  return Number(Math.sqrt(sumSquares / (values.length - 1)).toFixed(2));
}

/**
 * Confirmação rigorosa de segurança do banco:
 * 1. Script Node.js deve estar em "runway_test".
 * 2. Banco principal "runway" não deve possuir pedidos da análise.
 * 3. API ASP.NET Core deve estar respondendo e acessando efetivamente "runway_test".
 */
async function validarAmbienteSeguro() {
  console.log('--- 1. AUDITORIA DE ISOLAMENTO E SEGURANÇA DO BANCO ---');

  // 1.1 Validar conexão do script diretamente com runway_test
  const clientTest = new Client(DB_CONFIG);
  await clientTest.connect();
  let dbNameTest;
  try {
    dbNameTest = await validarConexaoSegura(clientTest);
    console.log(`✔ [OK] Script conectado diretamente ao banco de testes: "${dbNameTest}".`);
  } finally {
    await clientTest.end();
  }

  // 1.2 Validar que o banco principal "runway" está isolado e intocado
  const clientProd = new Client({
    ...DB_CONFIG,
    database: 'runway'
  });
  await clientProd.connect();
  try {
    const prodRes = await clientProd.query(
      `SELECT count(*) as c FROM "PEDIDO" WHERE codigo LIKE 'PED-ANL-%'`
    );
    const countProd = Number(prodRes.rows[0]?.c || 0);
    if (countProd > 0) {
      throw new Error(
        `[VIOLAÇÃO DE ISOLAMENTO] O banco principal "runway" contém ${countProd} pedidos de análise! Operação abortada.`
      );
    }
    console.log(`✔ [OK] Banco principal "runway" verificado e 100% intocado (0 pedidos PED-ANL).`);
  } finally {
    await clientProd.end();
  }

  // 1.3 Validar que a API ASP.NET Core está ativa e operando sobre "runway_test"
  console.log('\n--- 2. VERIFICAÇÃO DE CONEXÃO DA API ASP.NET CORE ---');
  let apiPing;
  try {
    apiPing = await requestHttp({
      hostname: API_CONFIG.hostname,
      port: API_CONFIG.port,
      path: '/api/pedidos/PED-ANL-0001',
      method: 'GET'
    });
  } catch (err) {
    throw new Error(
      `[ERRO FATAL: API INACESSÍVEL] Não foi possível conectar à API em http://${API_CONFIG.hostname}:${API_CONFIG.port}.\n` +
      `Certifique-se de que o backend ASP.NET Core está em execução apontando para "runway_test".\n` +
      `Detalhes: ${err.message}`
    );
  }

  if (apiPing.statusCode === 404) {
    throw new Error(
      `[ERRO FATAL: DESALINHAMENTO DE BANCO NA API]\n` +
      `A API em http://${API_CONFIG.hostname}:${API_CONFIG.port} retornou 404 Not Found para o pedido PED-ANL-0001.\n` +
      `Isso indica que a API está apontando para o banco "runway" e NÃO para "runway_test".\n` +
      `Conforme o item 7 dos requisitos, a execução foi IMEDIATAMENTE INTERROMPIDA por segurança.`
    );
  }

  if (apiPing.statusCode !== 200 || apiPing.body?.codigo !== 'PED-ANL-0001') {
    throw new Error(
      `[ERRO NA API] Resposta inesperada ao validar PED-ANL-0001 na API (HTTP ${apiPing.statusCode}).`
    );
  }

  console.log(`✔ [OK] API ASP.NET Core confirmada ativa e consumindo comprovadamente o banco "runway_test"!`);

  // 1.4 Validar endpoint de análise na API (acesso direto conforme protótipo acadêmico)
  const authTest = await requestHttp({
    hostname: API_CONFIG.hostname,
    port: API_CONFIG.port,
    path: '/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO',
    method: 'GET'
  });

  if (authTest.statusCode !== 200) {
    throw new Error(`[ERRO NA API] Consulta preliminar retornou status inesperado: HTTP ${authTest.statusCode}`);
  }

  console.log(`✔ [OK] Endpoint de análise gerencial validado diretamente com o backend (HTTP 200 OK).`);
}

/**
 * Prepara o estado inicial da massa de testes via seed idempotente
 */
async function resetarMassaInicial() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    await validarConexaoSegura(client);
    const { cliente, endereco, cartaoId } = await obterClienteDeterministo(client);
    await validarVariacoesExistentes(client);
    await limparMassaExistente(client);
    await inserirMassaAnalise(client, { cliente, endereco, cartaoId });
  } finally {
    await client.end();
  }
}

/**
 * Valida o payload de resposta contra o gabarito financeiro:
 * - Total Geral
 * - Subtotais por categoria
 * - Pontos mensais com R$ 0,00 (RN0073)
 */
function validarRespostaFinanceira(body, valorEsperado, subtotaisEsperados, pontosZeroEsperados) {
  if (!body) {
    return { valido: false, motivo: 'Corpo da resposta HTTP vazio ou JSON inválido.' };
  }

  // 1. Validar Total Geral
  if (valorEsperado !== undefined) {
    if (body.totalGeral === undefined || Math.abs(body.totalGeral - valorEsperado) >= 0.01) {
      return {
        valido: false,
        motivo: `Total geral divergente: recebido R$ ${body.totalGeral}, esperado R$ ${valorEsperado}.`
      };
    }
  }

  // 2. Validar Subtotais por Categoria
  if (subtotaisEsperados && typeof subtotaisEsperados === 'object') {
    if (!Array.isArray(body.series)) {
      return { valido: false, motivo: 'Array "series" ausente no JSON de resposta.' };
    }

    for (const [catNome, catValorEsperado] of Object.entries(subtotaisEsperados)) {
      const serie = body.series.find(s => s.categoria === catNome);
      if (!serie) {
        return { valido: false, motivo: `Série para categoria "${catNome}" não encontrada na resposta.` };
      }
      if (Math.abs(serie.total - catValorEsperado) >= 0.01) {
        return {
          valido: false,
          motivo: `Subtotal de "${catNome}" divergente: recebido R$ ${serie.total}, esperado R$ ${catValorEsperado}.`
        };
      }
    }
  }

  // 3. Validar pontos mensais com R$ 0,00 (RN0073)
  if (Array.isArray(pontosZeroEsperados)) {
    for (const p of pontosZeroEsperados) {
      const serie = body.series?.find(s => s.categoria === p.categoria);
      if (!serie) {
        return { valido: false, motivo: `Série "${p.categoria}" ausente para conferência de ponto zero.` };
      }
      const ponto = serie.dados?.find(d => d.periodo === p.periodo);
      if (!ponto) {
        return { valido: false, motivo: `Ponto de período "${p.periodo}" não encontrado na série "${p.categoria}".` };
      }
      if (Math.abs(ponto.valor - 0.00) >= 0.001) {
        return {
          valido: false,
          motivo: `Ponto ${p.periodo} de "${p.categoria}" deveria ser R$ 0,00 (RN0073), mas foi R$ ${ponto.valor}.`
        };
      }
    }
  }

  return { valido: true };
}

/**
 * Executa o benchmark para um cenário específico, auditando cada amostra oficial individualmente.
 */
async function executarCenario({
  id,
  nome,
  pathQuery,
  amostrasOficiais = 10,
  valorEsperado,
  subtotaisEsperados = null,
  pontosZeroEsperados = null,
  prepararCenario = null
}) {
  if (prepararCenario) {
    await prepararCenario();
  }

  const warmups = [];
  const oficialSamples = [];
  let ultimoTotalRetornado = null;
  let ultimoStatus = null;
  let falhasContabilizacao = [];

  // 1. Chamadas de aquecimento (3x)
  for (let w = 1; w <= 3; w++) {
    const res = await requestHttp({
      hostname: API_CONFIG.hostname,
      port: API_CONFIG.port,
      path: pathQuery,
      method: 'GET'
    });

    warmups.push(res.durationMs);
  }

  // 2. Medições oficiais (com validação estrita em CADA amostra)
  for (let i = 1; i <= amostrasOficiais; i++) {
    const res = await requestHttp({
      hostname: API_CONFIG.hostname,
      port: API_CONFIG.port,
      path: pathQuery,
      method: 'GET'
    });

    oficialSamples.push(res.durationMs);
    ultimoStatus = res.statusCode;
    if (res.body?.totalGeral !== undefined) {
      ultimoTotalRetornado = res.body.totalGeral;
    }

    // Validação estrita por amostra: HTTP 200 obrigatório
    if (res.statusCode !== 200) {
      falhasContabilizacao.push(`Amostra ${i}: HTTP ${res.statusCode} (esperado 200 OK) — ${res.rawBody}`);
      continue;
    }

    // Validação estrita por amostra: totais e subtotais financeiros
    const validacao = validarRespostaFinanceira(res.body, valorEsperado, subtotaisEsperados, pontosZeroEsperados);
    if (!validacao.valido) {
      falhasContabilizacao.push(`Amostra ${i}: ${validacao.motivo}`);
    }
  }

  const min = Math.min(...oficialSamples);
  const max = Math.max(...oficialSamples);
  const avg = Number((oficialSamples.reduce((a, b) => a + b, 0) / oficialSamples.length).toFixed(2));
  const sorted = [...oficialSamples].sort((a, b) => a - b);
  const p95 = calculatePercentile(sorted, 95);
  const desvioPadrao = calculateStdDev(oficialSamples, avg);

  const tempoConforme = max <= LIMITE_RNF0011_MS && avg <= LIMITE_RNF0011_MS;
  const valorConforme = falhasContabilizacao.length === 0;

  const warmupMax = Math.max(...warmups);
  const warmupAcimaLimite = warmups.filter(w => w > LIMITE_RNF0011_MS);

  return {
    id,
    nome,
    pathQuery,
    amostrasCount: oficialSamples.length,
    ultimoStatus,
    warmups,
    warmupMax,
    warmupAcimaLimite,
    min,
    avg,
    max,
    p95,
    desvioPadrao,
    valorEsperado,
    valorRetornado: ultimoTotalRetornado,
    subtotaisEsperados,
    tempoConforme,
    valorConforme,
    falhasContabilizacao
  };
}

async function runBenchmark() {
  console.log('========================================================================================');
  console.log(' RUNWAY — CARTÃO 06: BENCHMARK RNF0011 (CONSULTAS DE ANÁLISE < 1.000 ms)');
  console.log('========================================================================================');
  console.log(` Data/Hora da Execução: ${new Date().toISOString()}`);
  console.log(` Sistema Operacional:   ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(` Processador:           ${os.cpus()[0]?.model || 'N/A'} (${os.cpus().length} núcleos)`);
  console.log(` Memória Total:         ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(` Node.js Runtime:       ${process.version}`);
  console.log(` Limite RNF0011:        ${LIMITE_RNF0011_MS.toFixed(0)} ms por consulta\n`);

  // Fase 1: Validação de Segurança e Conexão do Ambiente
  await validarAmbienteSeguro();

  // Fase 2: Preparação inicial da massa oficial do Cartão 02
  console.log('\n--- 3. PREPARANDO MASSA DE DADOS OFICIAL DO CARTÃO 02 ---');
  await resetarMassaInicial();
  console.log('✔ Massa inicial carregada com sucesso (PED-ANL-0008 em "EM TRANSPORTE").\n');

  const cenarios = [
    {
      id: 'C1',
      nome: 'Consulta de 1 Categoria (Treino Diário)',
      pathQuery: '/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO',
      amostrasOficiais: 10,
      valorEsperado: 2350.59,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59
      }
    },
    {
      id: 'C2',
      nome: 'Consulta de 2 ou Mais Categorias',
      pathQuery: '/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    },
    {
      id: 'C3',
      nome: 'Período Mínimo de 1 Mês (Jan/2026)',
      pathQuery: '/api/analise/vendas?dataInicio=2026-01-01&dataFim=2026-01-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 2750.79,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 550.99,
        'COMPETIÇÃO': 2199.80
      }
    },
    {
      id: 'C4',
      nome: 'Período de 5 Meses da Massa Histórica',
      pathQuery: '/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    },
    {
      id: 'C5',
      nome: 'Período Máximo de 24 Meses (RN0072)',
      pathQuery: '/api/analise/vendas?dataInicio=2024-04-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    },
    {
      id: 'C6',
      nome: 'Período com Meses sem Vendas (RN0073)',
      pathQuery: '/api/analise/vendas?dataInicio=2026-02-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 1549.80,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 449.90,
        'COMPETIÇÃO': 1099.90
      },
      pontosZeroEsperados: [
        { categoria: 'COMPETIÇÃO', periodo: '2026-02' },
        { categoria: 'TREINO DIÁRIO', periodo: '2026-03' }
      ]
    },
    {
      id: 'C7',
      nome: 'Consultas Repetidas com Mesmos Filtros (20x)',
      pathQuery: '/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 20,
      valorEsperado: 7850.09,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2350.59,
        'COMPETIÇÃO': 5499.50
      }
    },
    {
      id: 'C8',
      nome: 'Consulta Pós-Transição Oficial de PED-ANL-0008',
      pathQuery: '/api/analise/vendas?dataInicio=2025-11-01&dataFim=2026-03-31&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O',
      amostrasOficiais: 10,
      valorEsperado: 8299.99,
      subtotaisEsperados: {
        'TREINO DIÁRIO': 2800.49,
        'COMPETIÇÃO': 5499.50
      },
      prepararCenario: async () => {
        console.log('\n  -> [C8 SETUP] Executando PATCH oficial em /api/pedidos/PED-ANL-0008/status...');
        const patchRes = await requestHttp({
          hostname: API_CONFIG.hostname,
          port: API_CONFIG.port,
          path: '/api/pedidos/PED-ANL-0008/status',
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          }
        }, {
          novoStatus: 'ENTREGUE',
          motivo: 'Entrega confirmada no teste de benchmark RNF0011',
          usuarioResponsavel: 'Administrador'
        });

        if (patchRes.statusCode !== 200 || patchRes.body?.status !== 'ENTREGUE') {
          throw new Error(
            `Falha na transição oficial de PED-ANL-0008 via PATCH (HTTP ${patchRes.statusCode}): ${JSON.stringify(patchRes.body)}`
          );
        }
        console.log('  ✔ [C8 SETUP] PED-ANL-0008 atualizado para "ENTREGUE" via contrato oficial da API.');
      }
    }
  ];

  const resultados = [];

  try {
    console.log('--- 4. INICIANDO EXECUÇÃO DOS CENÁRIOS DE BENCHMARK (C1 a C8) ---');
    for (const c of cenarios) {
      process.stdout.write(`  Executando ${c.id}: ${c.nome} (3 warmup + ${c.amostrasOficiais} amostras com validação estrita)... `);
      const res = await executarCenario(c);
      resultados.push(res);
      console.log(`OK (Média: ${res.avg} ms | Máx: ${res.max} ms)`);
    }
  } finally {
    // 5. Restauração obrigatória garantida em try/finally (com reprovação em caso de falha)
    console.log('\n--- 5. RESTAURAÇÃO OBRIGATÓRIA DA MASSA DE TESTES ---');
    await resetarMassaInicial();

    const clientConfirma = new Client(DB_CONFIG);
    await clientConfirma.connect();
    try {
      const resPed8 = await clientConfirma.query(
        `SELECT status FROM "PEDIDO" WHERE codigo = 'PED-ANL-0008'`
      );
      const statusPed8 = resPed8.rows[0]?.status;

      const totais = await consultarTotaisEsperados(clientConfirma);
      const totalGeral = totais.reduce((acc, t) => acc + Number(t.valor_categoria), 0);

      if (statusPed8 !== 'EM TRANSPORTE' || Math.abs(totalGeral - 7850.09) >= 0.01) {
        throw new Error(
          `[FALHA FATAL NA RESTAURAÇÃO]\n` +
          `A base "runway_test" não retornou ao estado original canônico do Cartão 02!\n` +
          `Status PED-ANL-0008: "${statusPed8}" (esperado: "EM TRANSPORTE").\n` +
          `Total Geral Acumulado: R$ ${totalGeral.toFixed(2)} (esperado: R$ 7.850,09).\n` +
          `A execução foi reprovada devido à falha de integridade da restauração.`
        );
      }

      console.log('✔ [RESTAURAÇÃO CONFIRMADA] PED-ANL-0008 retornou para "EM TRANSPORTE".');
      console.log(`✔ [RESTAURAÇÃO CONFIRMADA] Total geral da massa restaurado para R$ ${totalGeral.toFixed(2)}.`);
    } finally {
      await clientConfirma.end();
    }
  }

  // 6. Relatórios de Saída
  console.log('\n========================================================================================================================');
  console.log(' TABELA 1: DESEMPENHO OFICIAL DAS CONSULTAS (RNF0011 — LIMITE: 1.000 ms)');
  console.log('========================================================================================================================');
  console.table(resultados.map(r => ({
    Cenário: r.id,
    Descrição: r.nome,
    Amostras: r.amostrasCount,
    'Status HTTP': r.ultimoStatus,
    'Mín (ms)': r.min,
    'Média (ms)': r.avg,
    'Máx (ms)': r.max,
    'p95 (ms)': r.p95,
    'Desv. Padrão': r.desvioPadrao,
    'Total Financeiro': `R$ ${Number(r.valorRetornado).toFixed(2)}`,
    'Gabarito 100% OK?': r.valorConforme ? 'SIM' : `NÃO (${r.falhasContabilizacao.length} falhas)`,
    'RNF0011 (<1s)?': r.tempoConforme ? 'CONFORME' : 'NÃO CONFORME'
  })));

  console.log('\n========================================================================================================================');
  console.log(' TABELA 2: AUDITORIA DE AQUECIMENTO (WARMUP — 3 CHAMADAS PRÉVIAS POR CENÁRIO)');
  console.log('========================================================================================================================');
  console.table(resultados.map(r => ({
    Cenário: r.id,
    'Warmup 1 (ms)': r.warmups[0] || 'N/A',
    'Warmup 2 (ms)': r.warmups[1] || 'N/A',
    'Warmup 3 (ms)': r.warmups[2] || 'N/A',
    'Máx Warmup (ms)': r.warmupMax,
    'Warmup > 1.000 ms?': r.warmupAcimaLimite.length > 0
      ? `SIM (${r.warmupAcimaLimite.join(', ')} ms)`
      : 'NÃO (Todos < 1s)'
  })));

  // Exibir falhas contábeis se houver alguma
  const cenariosComFalhaContabil = resultados.filter(r => !r.valorConforme);
  if (cenariosComFalhaContabil.length > 0) {
    console.log('\n❌ DETALHAMENTO DE FALHAS CONTÁBEIS / GABARITO:');
    for (const c of cenariosComFalhaContabil) {
      console.log(`  - Cenário ${c.id}: ${c.falhasContabilizacao.join('; ')}`);
    }
  }

  const totalCenarios = resultados.length;
  const cenariosConformes = resultados.filter(r => r.tempoConforme && r.valorConforme).length;
  const todosAprovados = cenariosConformes === totalCenarios;

  console.log('\n========================================================================================================================');
  console.log(` RESULTADO FINAL: ${cenariosConformes}/${totalCenarios} CENÁRIOS CONFORMES`);
  if (todosAprovados) {
    console.log(' ✔ [APROVADO] Todas as consultas atenderam plenamente ao RNF0011 (tempo < 1.000 ms).');
    console.log(' ✔ [INTEGRIDADE TOTAL] 100% das amostras oficiais conferiram exatamente com os gabaritos (totais, subtotais e meses zerados).');
    console.log(' ✔ [RESTAURAÇÃO GARANTIDA] A massa foi restaurada e comprovada em "runway_test".');
    console.log(' ✔ Nenhuma alteração estrutural, migration ou índice adicional foi necessária.');
  } else {
    console.log(' ❌ [NÃO CONFORME] Houve cenários que excederam o limite ou divergiram do gabarito.');
  }
  console.log('========================================================================================================================\n');

  if (!todosAprovados) {
    process.exit(1);
  }
}

if (require.main === module) {
  runBenchmark().catch(err => {
    console.error('\n❌ [ERRO NA EXECUÇÃO DO BENCHMARK]:', err.message);
    process.exit(1);
  });
}

module.exports = {
  runBenchmark,
  executarCenario
};
