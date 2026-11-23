/**
 * RunWay E-Commerce — Massa Histórica Determinística da Análise Gerencial (01/11/2025 a 31/12/2026)
 *
 * Popula de forma explícita, determinística, transacional, não destrutiva e idempotente
 * 43 pedidos controlados (PED-ANL-0001 a PED-ANL-0043) nos bancos autorizados ("runway_test" ou "runway").
 *
 * Garantias:
 * 1. Destino explícito obrigatório (--target=runway_test ou --target=runway). Nunca há fallback silencioso para "runway".
 * 2. Preserva integralmente PED-ANL-0001 a PED-ANL-0009 (gabarito Nov/2025..Mar/2026 de TREINO DIÁRIO + COMPETIÇÃO = R$ 7.850,09).
 * 3. Preserva integralmente todos os pedidos preexistentes (ex.: RW-*) em ambos os bancos.
 * 4. Não executa exclusões nem sobrescritas na inserção padrão: pedidos já existentes idênticos são preservados (idempotência);
 *    se houver código existente com conteúdo divergente, a operação é abortada com erro explícito de conflito.
 * 5. Preserva Junho/2026 sem vendas ENTREGUE (contém apenas pedidos não entregues para validar RN0073 e exclusão de status).
 * 6. Agrupamento mensal sempre no fuso de negócio America/Sao_Paulo e cálculo financeiro estritamente por SUM(quantidade * preco_unitario).
 *
 * Uso:
 *   node scripts/seed-massa-analise.js --target=runway_test           # Insere apenas pedidos faltantes (idempotente)
 *   node scripts/seed-massa-analise.js --target=runway                # Insere apenas pedidos faltantes em runway (não destrutivo)
 *   node scripts/seed-massa-analise.js --target=runway_test --status  # Exibe resumo atual (somente leitura)
 *   node scripts/seed-massa-analise.js --target=runway_test --restore # Restaura status dos pedidos de transição (somente runway_test)
 */

const { Client } = require('pg');

const TARGETS_AUTORIZADOS = ['runway_test', 'runway'];

const MIGRATIONS_OBRIGATORIAS = [
  '20261004200848_AddSeedCatalogoCompletoRunWay',
  '20261017170215_AddEstruturaTrocasDevolucoes'
];

// Pedidos reservados para testar a transição EM TRANSPORTE -> ENTREGUE nos testes automatizados
const PEDIDOS_TRANSICAO_CONTROLADOS = ['PED-ANL-0008', 'PED-ANL-0036'];

function criarDbConfig(targetDb) {
  if (!TARGETS_AUTORIZADOS.includes(targetDb)) {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA] Banco de destino inválido ou não informado: "${targetDb || ''}".\n` +
      `Informe explicitamente --target=runway_test ou --target=runway. Fallback silencioso não é permitido.`
    );
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '123',
    database: targetDb
  };
}

// Mantido para compatibilidade com scripts de teste que operam estritamente em runway_test
const DB_CONFIG = criarDbConfig('runway_test');

const PEDIDOS_PLANEJADOS = [
  // =========================================================================
  // BLOCO ORIGINAL PRESERVADO (PED-ANL-0001 a PED-ANL-0009) — NÃO ALTERAR!
  // Gabarito TREINO DIÁRIO + COMPETIÇÃO (2025-11 a 2026-03) = R$ 7.850,09
  // =========================================================================
  {
    codigo: 'PED-ANL-0001',
    dataPedido: '2025-11-15T10:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 4, quantidade: 1, precoUnitario: 449.90 } // Corre 4 (TREINO DIÁRIO)
    ]
  },
  {
    codigo: 'PED-ANL-0002',
    dataPedido: '2025-11-20T14:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 31, quantidade: 1, precoUnitario: 1099.90 } // VaporFly 4 (COMPETIÇÃO)
    ]
  },
  {
    codigo: 'PED-ANL-0003',
    dataPedido: '2025-12-10T11:15:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 4, quantidade: 2, precoUnitario: 449.90 },  // Corre 4 (TREINO DIÁRIO) -> R$ 899,80
      { produtoVariacaoId: 31, quantidade: 1, precoUnitario: 1099.90 } // VaporFly 4 (COMPETIÇÃO) -> R$ 1.099,90
    ]
  },
  {
    codigo: 'PED-ANL-0004',
    dataPedido: '2026-01-14T09:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 11, quantidade: 1, precoUnitario: 550.99 } // Pegasus 41 (TREINO DIÁRIO)
    ]
  },
  {
    codigo: 'PED-ANL-0005',
    dataPedido: '2026-01-22T16:45:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 31, quantidade: 2, precoUnitario: 1099.90 } // VaporFly 4 (COMPETIÇÃO) -> R$ 2.199,80
    ]
  },
  {
    codigo: 'PED-ANL-0006',
    dataPedido: '2026-02-18T15:20:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 4, quantidade: 1, precoUnitario: 449.90 } // Corre 4 (TREINO DIÁRIO)
    ]
  },
  {
    codigo: 'PED-ANL-0007',
    dataPedido: '2026-02-25T18:00:00.000Z',
    status: 'APROVADA', // Pedido aprovado não entregue (deve ser ignorado)
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 31, quantidade: 1, precoUnitario: 1099.90 } // VaporFly 4 (COMPETIÇÃO)
    ]
  },
  {
    codigo: 'PED-ANL-0008',
    dataPedido: '2026-03-05T10:10:00.000Z',
    status: 'EM TRANSPORTE', // Pedido para transição via PATCH /api/pedidos/{codigo}/status
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 4, quantidade: 1, precoUnitario: 449.90 } // Corre 4 (TREINO DIÁRIO)
    ]
  },
  {
    codigo: 'PED-ANL-0009',
    dataPedido: '2026-03-12T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 31, quantidade: 1, precoUnitario: 1099.90 } // VaporFly 4 (COMPETIÇÃO)
    ]
  },

  // =========================================================================
  // AMPLIAÇÃO HISTÓRICA DETERMINÍSTICA (PED-ANL-0010 a PED-ANL-0043)
  // Período: 01/11/2025 a 31/12/2026 | 5 categorias | Junho/2026 sem ENTREGUE
  // =========================================================================

  // --- NOVEMBRO/2025 (LONGA DISTÂNCIA, VELOCIDADE, TRAIL) ---
  {
    codigo: 'PED-ANL-0010',
    dataPedido: '2025-11-12T13:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 70, quantidade: 1, precoUnitario: 949.99 } // Vomero 18 (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0011',
    dataPedido: '2025-11-25T16:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 54, quantidade: 1, precoUnitario: 699.99 }, // Corre Turbo (VELOCIDADE)
      { produtoVariacaoId: 38, quantidade: 1, precoUnitario: 629.99 }  // Speedcross 6 (TRAIL)
    ]
  },

  // --- DEZEMBRO/2025 (LONGA DISTÂNCIA, TRAIL, VELOCIDADE) ---
  {
    codigo: 'PED-ANL-0012',
    dataPedido: '2025-12-08T15:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 78, quantidade: 1, precoUnitario: 1849.90 } // Triumph 23 (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0013',
    dataPedido: '2025-12-19T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 46, quantidade: 2, precoUnitario: 599.99 } // Corre Trilha 3 (TRAIL) -> R$ 1.199,98
    ]
  },
  {
    codigo: 'PED-ANL-0014',
    dataPedido: '2025-12-22T17:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 93, quantidade: 1, precoUnitario: 1299.90 } // Endorphin Speed 5 (VELOCIDADE)
    ]
  },

  // --- JANEIRO/2026 (Preserva total ENTREGUE Jan/26 = R$ 2.750,79 nas 5 categorias) ---
  {
    codigo: 'PED-ANL-0015',
    dataPedido: '2026-01-27T12:00:00.000Z',
    status: 'REPROVADA', // Não entregue (deve ser excluído do gráfico)
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 86, quantidade: 1, precoUnitario: 1234.99 } // Vomero Plus (LONGA DISTÂNCIA)
    ]
  },

  // --- FEVEREIRO/2026 (LONGA DISTÂNCIA, TRAIL, VELOCIDADE) ---
  {
    codigo: 'PED-ANL-0016',
    dataPedido: '2026-02-10T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 86, quantidade: 1, precoUnitario: 1234.99 }, // Vomero Plus (LONGA DISTÂNCIA)
      { produtoVariacaoId: 134, quantidade: 1, precoUnitario: 1044.99 } // Pegasus Trail 5 (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0017',
    dataPedido: '2026-02-16T11:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 100, quantidade: 1, precoUnitario: 1399.99 } // Adizero Boston 13 (VELOCIDADE)
    ]
  },

  // --- MARÇO/2026 (TRAIL, VELOCIDADE) ---
  {
    codigo: 'PED-ANL-0018',
    dataPedido: '2026-03-18T13:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 127, quantidade: 1, precoUnitario: 1499.90 } // Terrex Agravic Speed Ultra (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0019',
    dataPedido: '2026-03-24T16:15:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 54, quantidade: 2, precoUnitario: 699.99 } // Corre Turbo (VELOCIDADE) -> R$ 1.399,98
    ]
  },

  // --- ABRIL/2026 (TREINO DIÁRIO, COMPETIÇÃO, LONGA DISTÂNCIA, TRAIL + EM TROCA em VELOCIDADE) ---
  {
    codigo: 'PED-ANL-0020',
    dataPedido: '2026-04-07T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 18, quantidade: 1, precoUnitario: 999.90 },  // Ultraboost 5 (TREINO DIÁRIO)
      { produtoVariacaoId: 106, quantidade: 1, precoUnitario: 1699.90 } // Adios Pro 4 (COMPETIÇÃO)
    ]
  },
  {
    codigo: 'PED-ANL-0021',
    dataPedido: '2026-04-15T15:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 70, quantidade: 2, precoUnitario: 949.99 } // Vomero 18 (LONGA DISTÂNCIA) -> R$ 1.899,98
    ]
  },
  {
    codigo: 'PED-ANL-0022',
    dataPedido: '2026-04-21T11:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 38, quantidade: 1, precoUnitario: 629.99 } // Speedcross 6 (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0023',
    dataPedido: '2026-04-26T17:00:00.000Z',
    status: 'EM TROCA', // Não entregue (deve ser excluído do gráfico)
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 93, quantidade: 1, precoUnitario: 1299.90 } // Endorphin Speed 5 (VELOCIDADE)
    ]
  },

  // --- MAIO/2026 (TREINO DIÁRIO, VELOCIDADE, TRAIL, COMPETIÇÃO) ---
  {
    codigo: 'PED-ANL-0024',
    dataPedido: '2026-05-06T12:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 24, quantidade: 2, precoUnitario: 849.90 } // Gel-Nimbus 26 (TREINO DIÁRIO) -> R$ 1.699,80
    ]
  },
  {
    codigo: 'PED-ANL-0025',
    dataPedido: '2026-05-14T16:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 93, quantidade: 1, precoUnitario: 1299.90 },  // Endorphin Speed 5 (VELOCIDADE)
      { produtoVariacaoId: 134, quantidade: 1, precoUnitario: 1044.99 }  // Pegasus Trail 5 (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0026',
    dataPedido: '2026-05-23T14:45:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 113, quantidade: 1, precoUnitario: 2299.90 } // Alphafly 3 (COMPETIÇÃO)
    ]
  },

  // --- JUNHO/2026 (MÊS ZERADO DE ENTREGAS — RN0073 + pontos coincidentes R$ 0,00) ---
  {
    codigo: 'PED-ANL-0027',
    dataPedido: '2026-06-11T13:00:00.000Z',
    status: 'APROVADA', // Não entregue (deve ser excluído do gráfico)
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 78, quantidade: 1, precoUnitario: 1849.90 } // Triumph 23 (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0028',
    dataPedido: '2026-06-20T15:00:00.000Z',
    status: 'TROCADO', // Status TROCADO não entra na regra estrita ENTREGUE
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 62, quantidade: 1, precoUnitario: 599.99 } // Corre 5 (TREINO DIÁRIO)
    ]
  },

  // --- JULHO/2026 (TREINO DIÁRIO, LONGA DISTÂNCIA, COMPETIÇÃO, VELOCIDADE) ---
  {
    codigo: 'PED-ANL-0029',
    dataPedido: '2026-07-08T13:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 142, quantidade: 1, precoUnitario: 1199.99 }, // NB 1080 V15 (TREINO DIÁRIO)
      { produtoVariacaoId: 86, quantidade: 1, precoUnitario: 1234.99 }   // Vomero Plus (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0030',
    dataPedido: '2026-07-19T17:15:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 120, quantidade: 1, precoUnitario: 1799.90 }, // Endorphin Pro (COMPETIÇÃO)
      { produtoVariacaoId: 100, quantidade: 1, precoUnitario: 1399.99 }  // Adizero Boston 13 (VELOCIDADE)
    ]
  },

  // --- AGOSTO/2026 (TREINO DIÁRIO, TRAIL, LONGA DISTÂNCIA) ---
  {
    codigo: 'PED-ANL-0031',
    dataPedido: '2026-08-05T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 62, quantidade: 2, precoUnitario: 599.99 } // Corre 5 (TREINO DIÁRIO) -> R$ 1.199,98
    ]
  },
  {
    codigo: 'PED-ANL-0032',
    dataPedido: '2026-08-14T16:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 127, quantidade: 2, precoUnitario: 1499.90 } // Terrex Agravic Speed Ultra (TRAIL) -> R$ 2.999,80
    ]
  },
  {
    codigo: 'PED-ANL-0033',
    dataPedido: '2026-08-22T12:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 78, quantidade: 1, precoUnitario: 1849.90 } // Triumph 23 (LONGA DISTÂNCIA)
    ]
  },

  // --- SETEMBRO/2026 (COMPETIÇÃO, VELOCIDADE, TREINO DIÁRIO, TRAIL + EM TRANSPORTE LONGA DISTÂNCIA) ---
  {
    codigo: 'PED-ANL-0034',
    dataPedido: '2026-09-09T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 106, quantidade: 1, precoUnitario: 1699.90 }, // Adios Pro 4 (COMPETIÇÃO)
      { produtoVariacaoId: 54, quantidade: 2, precoUnitario: 699.99 }    // Corre Turbo (VELOCIDADE) -> R$ 1.399,98
    ]
  },
  {
    codigo: 'PED-ANL-0035',
    dataPedido: '2026-09-18T11:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 11, quantidade: 1, precoUnitario: 550.99 }, // Pegasus 41 (TREINO DIÁRIO)
      { produtoVariacaoId: 38, quantidade: 1, precoUnitario: 629.99 }  // Speedcross 6 (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0036',
    dataPedido: '2026-09-25T15:00:00.000Z',
    status: 'EM TRANSPORTE', // Segundo pedido disponível para transição EM TRANSPORTE -> ENTREGUE
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 70, quantidade: 1, precoUnitario: 949.99 } // Vomero 18 (LONGA DISTÂNCIA)
    ]
  },

  // --- OUTUBRO/2026 (COMPETIÇÃO, LONGA DISTÂNCIA, TRAIL, VELOCIDADE; soma-se aos RW-* preexistentes) ---
  {
    codigo: 'PED-ANL-0037',
    dataPedido: '2026-10-12T15:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 120, quantidade: 1, precoUnitario: 1799.90 }, // Endorphin Pro (COMPETIÇÃO)
      { produtoVariacaoId: 70, quantidade: 1, precoUnitario: 949.99 }    // Vomero 18 (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0038',
    dataPedido: '2026-10-21T16:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 46, quantidade: 1, precoUnitario: 599.99 },  // Corre Trilha 3 (TRAIL)
      { produtoVariacaoId: 93, quantidade: 1, precoUnitario: 1299.90 }  // Endorphin Speed 5 (VELOCIDADE)
    ]
  },

  // --- NOVEMBRO/2026 (TODAS AS 5 CATEGORIAS ENTREGUES) ---
  {
    codigo: 'PED-ANL-0039',
    dataPedido: '2026-11-08T14:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 18, quantidade: 1, precoUnitario: 999.90 },   // Ultraboost 5 (TREINO DIÁRIO)
      { produtoVariacaoId: 113, quantidade: 1, precoUnitario: 2299.90 }, // Alphafly 3 (COMPETIÇÃO)
      { produtoVariacaoId: 86, quantidade: 1, precoUnitario: 1234.99 }   // Vomero Plus (LONGA DISTÂNCIA)
    ]
  },
  {
    codigo: 'PED-ANL-0040',
    dataPedido: '2026-11-16T17:00:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 100, quantidade: 1, precoUnitario: 1399.99 }, // Adizero Boston 13 (VELOCIDADE)
      { produtoVariacaoId: 134, quantidade: 1, precoUnitario: 1044.99 }  // Pegasus Trail 5 (TRAIL)
    ]
  },

  // --- DEZEMBRO/2026 (TODAS AS 5 CATEGORIAS ENTREGUES + EM PROCESSAMENTO) ---
  {
    codigo: 'PED-ANL-0041',
    dataPedido: '2026-12-05T13:30:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 142, quantidade: 2, precoUnitario: 1199.99 }, // NB 1080 V15 (TREINO DIÁRIO) -> R$ 2.399,98
      { produtoVariacaoId: 106, quantidade: 1, precoUnitario: 1699.90 }  // Adios Pro 4 (COMPETIÇÃO)
    ]
  },
  {
    codigo: 'PED-ANL-0042',
    dataPedido: '2026-12-14T15:45:00.000Z',
    status: 'ENTREGUE',
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 78, quantidade: 1, precoUnitario: 1849.90 },  // Triumph 23 (LONGA DISTÂNCIA)
      { produtoVariacaoId: 93, quantidade: 1, precoUnitario: 1299.90 },  // Endorphin Speed 5 (VELOCIDADE)
      { produtoVariacaoId: 127, quantidade: 1, precoUnitario: 1499.90 }  // Terrex Agravic Speed Ultra (TRAIL)
    ]
  },
  {
    codigo: 'PED-ANL-0043',
    dataPedido: '2026-12-20T16:00:00.000Z',
    status: 'EM PROCESSAMENTO', // Não entregue (deve ser excluído do gráfico; usa variação 24 para não reservar variação 4 dos testes de carrinho)
    valorFrete: 20.00,
    itens: [
      { produtoVariacaoId: 24, quantidade: 1, precoUnitario: 849.90 } // Gel-Nimbus 26 (TREINO DIÁRIO)
    ]
  }
];

const CODIGOS_PEDIDOS_ANALISE = PEDIDOS_PLANEJADOS.map(p => p.codigo);

function calcularSubtotalPedido(pedido) {
  return Number(
    pedido.itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0).toFixed(2)
  );
}

function calcularTotalEsperadoCanonico() {
  return Number(
    PEDIDOS_PLANEJADOS
      .filter(p => p.status === 'ENTREGUE')
      .reduce((acc, p) => acc + calcularSubtotalPedido(p), 0)
      .toFixed(2)
  );
}

async function validarConexaoSegura(client, expectedDb = 'runway_test') {
  if (!TARGETS_AUTORIZADOS.includes(expectedDb)) {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA] Destino não autorizado: "${expectedDb}". Permitidos: ${TARGETS_AUTORIZADOS.join(', ')}.`
    );
  }

  const res = await client.query('SELECT current_database() AS db');
  const dbName = res.rows[0]?.db;

  if (dbName !== expectedDb) {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA]\n` +
      `Banco conectado ("${dbName}") diverge do destino explicitamente solicitado ("${expectedDb}").\n` +
      `Nenhuma operação de escrita foi realizada.`
    );
  }
  return dbName;
}

async function validarMigrationsObrigatorias(client) {
  const res = await client.query(`SELECT "MigrationId" FROM "__EFMigrationsHistory"`);
  const aplicadas = new Set(res.rows.map(r => r.MigrationId));
  const faltantes = MIGRATIONS_OBRIGATORIAS.filter(m => !aplicadas.has(m));

  if (faltantes.length > 0) {
    throw new Error(
      `[ERRO FATAL: MIGRATIONS PENDENTES]\n` +
      `As seguintes migrations obrigatórias não foram aplicadas no banco: ${faltantes.join(', ')}.`
    );
  }
  return Array.from(aplicadas);
}

async function obterClienteDeterministo(client) {
  // Busca estrita pela cliente Ana Carolina Silva (CPF 11144477735), presente em runway_test e runway
  const res = await client.query(
    `SELECT id, codigo, nome, cpf, email FROM "CLIENTE" WHERE cpf = '11144477735' LIMIT 1`
  );

  if (res.rows.length === 0) {
    throw new Error(
      `[ERRO FATAL: PRÉ-REQUISITO NÃO ATENDIDO]\n` +
      `A cliente determinística Ana Carolina Silva (CPF 11144477735) não foi encontrada no banco conectado.\n` +
      `Execute o seed de clientes (node scripts/seed-runway-test.js) antes de inserir a massa de análise.`
    );
  }

  const cliente = res.rows[0];

  const endRes = await client.query(
    `SELECT id, tipo_residencia, tipo_logradouro, logradouro, numero, complemento, bairro, cep, cidade, estado, pais, observacoes
     FROM "ENDERECO" WHERE cliente_id = $1 ORDER BY id ASC LIMIT 1`,
    [cliente.id]
  );

  if (endRes.rows.length === 0) {
    throw new Error(`A cliente ${cliente.codigo} (${cliente.nome}) não possui endereço cadastrado no banco.`);
  }

  const cardRes = await client.query(
    `SELECT id, bandeira_id, numero_cartao, nome_impresso
     FROM "CARTAO" WHERE cliente_id = $1 AND preferencial = true ORDER BY id ASC LIMIT 1`,
    [cliente.id]
  );

  const cartaoId = cardRes.rows[0]?.id || (
    await client.query(`SELECT id FROM "CARTAO" WHERE cliente_id = $1 ORDER BY id ASC LIMIT 1`, [cliente.id])
  ).rows[0]?.id;

  if (!cartaoId) {
    throw new Error(`A cliente ${cliente.codigo} (${cliente.nome}) não possui cartão de crédito cadastrado no banco.`);
  }

  return {
    cliente,
    endereco: endRes.rows[0],
    cartaoId
  };
}

async function validarVariacoesExistentes(client) {
  const varIds = Array.from(
    new Set(PEDIDOS_PLANEJADOS.flatMap(p => p.itens.map(i => i.produtoVariacaoId)))
  ).sort((a, b) => a - b);

  const res = await client.query(
    `SELECT pv.id, pv.produto_id, pv.tamanho, p.codigo, p.nome, p.categoria, p.preco
     FROM "PRODUTO_VARIACAO" pv
     JOIN "PRODUTO" p ON p.id = pv.produto_id
     WHERE pv.id = ANY($1) AND pv.ativo = true AND p.ativo = true`,
    [varIds]
  );

  if (res.rows.length < varIds.length) {
    const encontrados = res.rows.map(r => r.id);
    const faltantes = varIds.filter(id => !encontrados.includes(id));
    throw new Error(
      `As seguintes variações de calçado ativas não foram encontradas no catálogo do banco: ${faltantes.join(', ')}`
    );
  }

  return res.rows;
}

function normalizarItensParaComparacao(itens) {
  return [...itens]
    .map(i => ({
      produtoVariacaoId: Number(i.produtoVariacaoId),
      quantidade: Number(i.quantidade),
      precoUnitario: Number(Number(i.precoUnitario).toFixed(2))
    }))
    .sort((a, b) => a.produtoVariacaoId - b.produtoVariacaoId || a.quantidade - b.quantidade);
}

function compararPedidoComPlanejado(existente, planejado) {
  const divergencias = [];

  const dtExistenteMs = new Date(existente.dt_pedido).getTime();
  const dtPlanejadoMs = new Date(planejado.dataPedido).getTime();
  if (dtExistenteMs !== dtPlanejadoMs) {
    divergencias.push(`dt_pedido (banco=${new Date(existente.dt_pedido).toISOString()}, planejado=${planejado.dataPedido})`);
  }

  if (existente.status !== planejado.status) {
    divergencias.push(`status (banco="${existente.status}", planejado="${planejado.status}")`);
  }

  const subtotalEsperado = calcularSubtotalPedido(planejado);
  const valorTotalEsperado = Number((subtotalEsperado + planejado.valorFrete).toFixed(2));

  if (Math.abs(Number(existente.subtotal) - subtotalEsperado) >= 0.01) {
    divergencias.push(`subtotal (banco=${existente.subtotal}, planejado=${subtotalEsperado.toFixed(2)})`);
  }

  if (Math.abs(Number(existente.valor_frete) - planejado.valorFrete) >= 0.01) {
    divergencias.push(`valor_frete (banco=${existente.valor_frete}, planejado=${planejado.valorFrete.toFixed(2)})`);
  }

  if (Math.abs(Number(existente.valor_total) - valorTotalEsperado) >= 0.01) {
    divergencias.push(`valor_total (banco=${existente.valor_total}, planejado=${valorTotalEsperado.toFixed(2)})`);
  }

  const itensExistentes = normalizarItensParaComparacao(existente.itens || []);
  const itensPlanejados = normalizarItensParaComparacao(planejado.itens);
  if (JSON.stringify(itensExistentes) !== JSON.stringify(itensPlanejados)) {
    divergencias.push(
      `itens (banco=${JSON.stringify(itensExistentes)}, planejado=${JSON.stringify(itensPlanejados)})`
    );
  }

  return divergencias;
}

/**
 * Sincronização idempotente e NÃO DESTRUTIVA:
 * - Nunca exclui registros existentes (nem PED-ANL-*, nem RW-*).
 * - Preserva pedidos já existentes quando idênticos ao planejamento.
 * - Interrompe com erro de conflito sem sobrescrever se algum código existir com conteúdo diferente.
 * - Insere transacionalmente apenas os pedidos planejados ausentes.
 */
async function sincronizarMassaAnalise(client, { cliente, endereco, cartaoId }) {
  await client.query('BEGIN');
  try {
    const existentesRes = await client.query(
      `SELECT p.id, p.codigo, p.dt_pedido, p.status, p.subtotal, p.valor_frete, p.valor_total,
              COALESCE(
                json_agg(
                  json_build_object(
                    'produtoVariacaoId', ip.produto_variacao_id,
                    'quantidade', ip.quantidade,
                    'precoUnitario', ip.preco_unitario
                  )
                ) FILTER (WHERE ip.id IS NOT NULL),
                '[]'::json
              ) AS itens
       FROM "PEDIDO" p
       LEFT JOIN "ITEM_PEDIDO" ip ON ip.pedido_id = p.id
       WHERE p.codigo = ANY($1)
       GROUP BY p.id`,
      [CODIGOS_PEDIDOS_ANALISE]
    );

    const mapaExistentes = new Map(existentesRes.rows.map(r => [r.codigo, r]));
    const conflitos = [];
    const pedidosParaInserir = [];

    for (const p of PEDIDOS_PLANEJADOS) {
      const existente = mapaExistentes.get(p.codigo);
      if (existente) {
        const diffs = compararPedidoComPlanejado(existente, p);
        if (diffs.length > 0) {
          conflitos.push(`${p.codigo}: ${diffs.join('; ')}`);
        }
      } else {
        pedidosParaInserir.push(p);
      }
    }

    if (conflitos.length > 0) {
      throw new Error(
        `[CONFLITO DETECTADO — OPERAÇÃO INTERROMPIDA SEM SOBRESCREVER]\n` +
        `Os seguintes códigos planejados já existem no banco com conteúdo diferente:\n` +
        conflitos.map(c => `  - ${c}`).join('\n')
      );
    }

    for (const p of pedidosParaInserir) {
      const subtotal = calcularSubtotalPedido(p);
      const valorTotal = Number((subtotal + p.valorFrete).toFixed(2));

      const pedRes = await client.query(
        `INSERT INTO "PEDIDO" (
          codigo, cliente_id, endereco_entrega_id, dt_pedido, status,
          subtotal, valor_frete, valor_total,
          entrega_tipo_residencia, entrega_tipo_logradouro, entrega_logradouro,
          entrega_numero, entrega_complemento, entrega_bairro, entrega_cep,
          entrega_cidade, entrega_estado, entrega_pais, entrega_observacoes
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19
        ) RETURNING id`,
        [
          p.codigo,
          cliente.id,
          endereco.id,
          p.dataPedido,
          p.status,
          subtotal,
          p.valorFrete,
          valorTotal,
          endereco.tipo_residencia || 'Casa',
          endereco.tipo_logradouro || 'Rua',
          endereco.logradouro,
          endereco.numero,
          endereco.complemento || null,
          endereco.bairro,
          endereco.cep,
          endereco.cidade,
          endereco.estado,
          endereco.pais || 'Brasil',
          'Endereço de teste oficial - Análise Gerencial'
        ]
      );

      const pedidoId = pedRes.rows[0].id;

      for (const item of p.itens) {
        await client.query(
          `INSERT INTO "ITEM_PEDIDO" (pedido_id, produto_variacao_id, quantidade, preco_unitario)
           VALUES ($1, $2, $3, $4)`,
          [pedidoId, item.produtoVariacaoId, item.quantidade, item.precoUnitario]
        );
      }

      await client.query(
        `INSERT INTO "PAGAMENTO_PEDIDO" (
          pedido_id, forma_pagamento, valor, cartao_id, bandeira_id,
          cartao_ultimos_digitos, cartao_nome_impresso, cupom_id
        ) VALUES (
          $1, 'CARTAO_CREDITO', $2, $3, NULL,
          NULL, NULL, NULL
        )`,
        [pedidoId, valorTotal, cartaoId]
      );
    }

    await client.query('COMMIT');
    return {
      inseridos: pedidosParaInserir.length,
      jaExistentes: PEDIDOS_PLANEJADOS.length - pedidosParaInserir.length,
      totalPlanejados: PEDIDOS_PLANEJADOS.length,
      codigosInseridos: pedidosParaInserir.map(p => p.codigo)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Restauração controlada exclusiva para o banco de testes "runway_test":
 * - Restaura apenas o status inicial ('EM TRANSPORTE') dos pedidos controlados de transição (PED-ANL-0008 e PED-ANL-0036)
 *   caso tenham sido promovidos para 'ENTREGUE' durante a execução dos testes automatizados.
 * - Garante que todos os 43 pedidos controlados estejam presentes (sem excluir nem modificar pedidos RW-*).
 */
async function restaurarMassaTesteControlada(client) {
  await validarConexaoSegura(client, 'runway_test');
  await validarMigrationsObrigatorias(client);
  const prereqs = await obterClienteDeterministo(client);
  await validarVariacoesExistentes(client);

  await client.query('BEGIN');
  try {
    await client.query(
      `UPDATE "PEDIDO"
       SET status = 'EM TRANSPORTE'
       WHERE codigo = ANY($1) AND status <> 'EM TRANSPORTE'`,
      [PEDIDOS_TRANSICAO_CONTROLADOS]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  return sincronizarMassaAnalise(client, prereqs);
}

/**
 * Consulta os totais agregados dos pedidos controlados (PED-ANL-*) com status ENTREGUE,
 * usando estritamente o fuso horário America/Sao_Paulo (idêntico ao AnaliseService.cs).
 */
async function consultarTotaisEsperados(client) {
  const sql = `
    SELECT
      to_char(p.dt_pedido AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS periodo,
      prod.categoria,
      SUM(ip.quantidade * ip.preco_unitario)::numeric(10,2) AS valor_categoria,
      COUNT(DISTINCT p.id)::int AS qtd_pedidos
    FROM "PEDIDO" p
    JOIN "ITEM_PEDIDO" ip ON ip.pedido_id = p.id
    JOIN "PRODUTO_VARIACAO" pv ON pv.id = ip.produto_variacao_id
    JOIN "PRODUTO" prod ON prod.id = pv.produto_id
    WHERE p.status = 'ENTREGUE'
      AND p.codigo = ANY($1)
    GROUP BY 1, 2
    ORDER BY periodo ASC, prod.categoria ASC;
  `;

  const res = await client.query(sql, [CODIGOS_PEDIDOS_ANALISE]);
  return res.rows;
}

/**
 * Consulta os totais agregados de TODOS os pedidos ENTREGUE do banco (incluindo preexistentes RW-*)
 * em um intervalo opcional [dataInicioIso, dataFimIso] no fuso America/Sao_Paulo.
 */
async function consultarTotaisGlobaisBanco(client, dataInicio = '2025-11-01', dataFim = '2026-12-31', categorias = null) {
  const params = [dataInicio, dataFim];
  let filtroCat = '';
  if (Array.isArray(categorias) && categorias.length > 0) {
    params.push(categorias);
    filtroCat = `AND prod.categoria = ANY($3)`;
  }

  const sql = `
    SELECT
      to_char(p.dt_pedido AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS periodo,
      prod.categoria,
      SUM(ip.quantidade * ip.preco_unitario)::numeric(10,2) AS valor_categoria,
      COUNT(DISTINCT p.id)::int AS qtd_pedidos
    FROM "PEDIDO" p
    JOIN "ITEM_PEDIDO" ip ON ip.pedido_id = p.id
    JOIN "PRODUTO_VARIACAO" pv ON pv.id = ip.produto_variacao_id
    JOIN "PRODUTO" prod ON prod.id = pv.produto_id
    WHERE p.status = 'ENTREGUE'
      AND (p.dt_pedido AT TIME ZONE 'America/Sao_Paulo')::date >= $1::date
      AND (p.dt_pedido AT TIME ZONE 'America/Sao_Paulo')::date <= $2::date
      ${filtroCat}
    GROUP BY 1, 2
    ORDER BY periodo ASC, prod.categoria ASC;
  `;

  const res = await client.query(sql, params);
  return res.rows;
}

function extrairTargetCli(args) {
  const argIgual = args.find(a => a.startsWith('--target='));
  if (argIgual) {
    return argIgual.split('=')[1]?.trim();
  }
  const idx = args.indexOf('--target');
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1].trim();
  }
  return '';
}

async function main() {
  const args = process.argv.slice(2);
  const targetDb = extrairTargetCli(args);
  const isStatus = args.includes('--status');
  const isRestore = args.includes('--restore');

  if (!TARGETS_AUTORIZADOS.includes(targetDb)) {
    throw new Error(
      `Destino obrigatório não informado ou inválido ("${targetDb}").\n` +
      `Uso correto:\n` +
      `  node scripts/seed-massa-analise.js --target=runway_test\n` +
      `  node scripts/seed-massa-analise.js --target=runway\n` +
      `  node scripts/seed-massa-analise.js --target=runway_test --status\n` +
      `  node scripts/seed-massa-analise.js --target=runway_test --restore`
    );
  }

  if (isRestore && targetDb !== 'runway_test') {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA] O modo --restore é permitido EXCLUSIVAMENTE em "runway_test". Operação abortada.`
    );
  }

  console.log('========================================================================');
  console.log(` RUNWAY — MASSA HISTÓRICA DA ANÁLISE GERENCIAL (DESTINO: ${targetDb})`);
  console.log('========================================================================\n');

  const client = new Client(criarDbConfig(targetDb));
  await client.connect();

  try {
    const dbName = await validarConexaoSegura(client, targetDb);
    console.log(`✔ [1/5 SEGURANÇA] Conectado e confirmado no banco de destino: "${dbName}"`);

    const migrations = await validarMigrationsObrigatorias(client);
    console.log(`✔ [2/5 MIGRATIONS] ${migrations.length} migrations verificadas no banco "${dbName}".`);

    const resumoAntes = await client.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE codigo LIKE 'PED-ANL-%')::int AS total_anl,
        count(*) FILTER (WHERE codigo NOT LIKE 'PED-ANL-%')::int AS total_outros
      FROM "PEDIDO"
    `);
    const antes = resumoAntes.rows[0];
    console.log(
      `✔ [3/5 INVENTÁRIO ATUAL] Total em PEDIDO: ${antes.total} ` +
      `(PED-ANL-*: ${antes.total_anl} | Outros preservados: ${antes.total_outros})`
    );

    if (isStatus) {
      console.log('\n--- RELATÓRIO SOMENTE LEITURA (PED-ANL-* ENTREGUE — America/Sao_Paulo) ---');
      const totais = await consultarTotaisEsperados(client);
      console.table(totais);
      return;
    }

    const prereqs = await obterClienteDeterministo(client);
    const vars = await validarVariacoesExistentes(client);
    console.log(
      `✔ [4/5 PRÉ-REQUISITOS] Cliente ${prereqs.cliente.codigo} (${prereqs.cliente.nome}), ` +
      `Endereço ID ${prereqs.endereco.id}, Cartão ID ${prereqs.cartaoId}, ${vars.length} variações válidas.`
    );

    const faltantesEstimados = PEDIDOS_PLANEJADOS.length - antes.total_anl;
    console.log(
      `✔ [5/5 PLANEJAMENTO] Massa planejada: ${PEDIDOS_PLANEJADOS.length} pedidos (01/11/2025 a 31/12/2026) | ` +
      `Novos previstos: ~${Math.max(0, faltantesEstimados)}.`
    );

    const resultado = isRestore
      ? await restaurarMassaTesteControlada(client)
      : await sincronizarMassaAnalise(client, prereqs);

    console.log('\n--- RESULTADO DA OPERAÇÃO TRANSACIONAL ---');
    console.log(`✔ Novos pedidos inseridos:            ${resultado.inseridos}`);
    console.log(`✔ Pedidos já existentes preservados:  ${resultado.jaExistentes}`);
    console.log(`✔ Total da massa controlada:          ${resultado.totalPlanejados}`);
    console.log(`✔ Total canônico ENTREGUE (PED-ANL):  R$ ${calcularTotalEsperadoCanonico().toFixed(2)}`);

    const resumoDepois = await client.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE codigo LIKE 'PED-ANL-%')::int AS total_anl,
        count(*) FILTER (WHERE codigo NOT LIKE 'PED-ANL-%')::int AS total_outros
      FROM "PEDIDO"
    `);
    const depois = resumoDepois.rows[0];
    console.log(
      `✔ Pós-execução em "${dbName}": Total=${depois.total} ` +
      `(PED-ANL-*=${depois.total_anl} | Outros preservados=${depois.total_outros})\n`
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ [ERRO NA EXECUÇÃO DA MASSA]:', err.message);
    process.exit(1);
  });
}

module.exports = {
  DB_CONFIG,
  TARGETS_AUTORIZADOS,
  PEDIDOS_TRANSICAO_CONTROLADOS,
  CODIGOS_PEDIDOS_ANALISE,
  PEDIDOS_PLANEJADOS,
  criarDbConfig,
  calcularSubtotalPedido,
  calcularTotalEsperadoCanonico,
  validarConexaoSegura,
  validarMigrationsObrigatorias,
  obterClienteDeterministo,
  validarVariacoesExistentes,
  sincronizarMassaAnalise,
  restaurarMassaTesteControlada,
  consultarTotaisEsperados,
  consultarTotaisGlobaisBanco
};
