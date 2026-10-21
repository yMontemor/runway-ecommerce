/**
 * RunWay E-Commerce - Cartão 02: Preparação da Massa de Dados da Análise Gerencial
 * 
 * Este script popula o banco "runway_test" com uma massa de dados controlada,
 * reproduzível e auditável de 9 pedidos (PED-ANL-0001 a PED-ANL-0009) para validação
 * dos requisitos de análise gerencial de vendas (RF0055, RNF0043, RN0072, RN0073).
 * 
 * Regras e Decisões Técnicas:
 * 1. Agrupamento temporal: baseado estritamente na data de criação do pedido ("PEDIDO".dt_pedido).
 * 2. Composição financeira por categoria: soma exata de (quantidade * preco_unitario) dos itens
 *    pertencentes a cada categoria, sem rateio de frete e desconsiderando itens de outras categorias.
 * 3. Ressalva RN0012: O modelo atual implementa categoria escalar em "PRODUTO" (1:1).
 *    Esta massa inclui pedidos mistos (PED-ANL-0003) para testar a segregação contábil entre itens,
 *    sem presumir aprovação formal da simplificação nem alterar a modelagem existente.
 * 4. Segurança Estrita: opera EXCLUSIVAMENTE em "runway_test". Bloqueio fatal se outro banco for detectado.
 * 5. Limpeza Restrita: atua unicamente nos 9 códigos nominais PED-ANL-0001 a PED-ANL-0009.
 * 6. Cliente Determinístico: utiliza estritamente o cliente Ana Carolina Silva (CPF 11144477735 / CLI-0001).
 * 
 * Uso:
 *   node scripts/seed-massa-analise.js           # Prepara a massa (idempotente: limpa e reinsere)
 *   node scripts/seed-massa-analise.js --clean   # Restaura a base removendo os 9 pedidos
 *   node scripts/seed-massa-analise.js --status  # Apenas exibe o estado e agrupamento atual
 */

const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '123',
  database: process.env.PGDATABASE || 'runway_test'
};

const CODIGOS_PEDIDOS_ANALISE = [
  'PED-ANL-0001',
  'PED-ANL-0002',
  'PED-ANL-0003',
  'PED-ANL-0004',
  'PED-ANL-0005',
  'PED-ANL-0006',
  'PED-ANL-0007',
  'PED-ANL-0008',
  'PED-ANL-0009'
];

const PEDIDOS_PLANEJADOS = [
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
    status: 'EM TRANSPORTE', // Pedido para transição posterior via PATCH /api/pedidos/{codigo}/status
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
  }
];

async function validarConexaoSegura(client) {
  const res = await client.query('SELECT current_database() AS db');
  const dbName = res.rows[0]?.db;

  if (dbName !== 'runway_test') {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA INTOLERÁVEL]\n` +
      `Tentativa de operação em banco não autorizado: "${dbName}".\n` +
      `Este script está restrito EXCLUSIVAMENTE ao banco "runway_test".\n` +
      `Nenhuma operação de escrita foi realizada.`
    );
  }
  return dbName;
}

async function limparMassaExistente(client) {
  await client.query('BEGIN');
  try {
    // 1. Verificar se há registros em TROCA dependendo destes pedidos
    const checkTrocas = await client.query(
      `SELECT count(*) as c FROM "TROCA" WHERE pedido_id IN (SELECT id FROM "PEDIDO" WHERE codigo = ANY($1))`,
      [CODIGOS_PEDIDOS_ANALISE]
    );

    if (Number(checkTrocas.rows[0]?.c) > 0) {
      throw new Error(`Existem trocas vinculadas a pedidos da análise. Operação de exclusão cancelada.`);
    }

    // 2. Exclusão restrita aos 9 códigos nominais
    await client.query(
      `DELETE FROM "PAGAMENTO_PEDIDO" WHERE pedido_id IN (SELECT id FROM "PEDIDO" WHERE codigo = ANY($1))`,
      [CODIGOS_PEDIDOS_ANALISE]
    );

    await client.query(
      `DELETE FROM "ITEM_PEDIDO" WHERE pedido_id IN (SELECT id FROM "PEDIDO" WHERE codigo = ANY($1))`,
      [CODIGOS_PEDIDOS_ANALISE]
    );

    const delPed = await client.query(
      `DELETE FROM "PEDIDO" WHERE codigo = ANY($1)`,
      [CODIGOS_PEDIDOS_ANALISE]
    );

    await client.query('COMMIT');
    return delPed.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function obterClienteDeterministo(client) {
  // Busca estrita pela cliente Ana Carolina Silva do seed padrão (CPF 11144477735 ou código CLI-0001 / CLI-1048)
  const res = await client.query(
    `SELECT id, codigo, nome, cpf, email FROM "CLIENTE" WHERE cpf = '11144477735' LIMIT 1`
  );

  if (res.rows.length === 0) {
    throw new Error(
      `[ERRO FATAL: PRÉ-REQUISITO NÃO ATENDIDO]\n` +
      `A cliente determinística Ana Carolina Silva (CPF 11144477735) não foi encontrada no banco "runway_test".\n` +
      `Conforme as regras do Cartão 02, não é permitido o fallback automático para outro cliente.\n` +
      `Por favor, execute primeiro o seed inicial de clientes: node scripts/seed-runway-test.js`
    );
  }

  const cliente = res.rows[0];

  // Buscar endereço real cadastrado
  const endRes = await client.query(
    `SELECT id, tipo_residencia, tipo_logradouro, logradouro, numero, complemento, bairro, cep, cidade, estado, pais, observacoes
     FROM "ENDERECO" WHERE cliente_id = $1 LIMIT 1`,
    [cliente.id]
  );

  if (endRes.rows.length === 0) {
    throw new Error(`A cliente ${cliente.codigo} (${cliente.nome}) não possui endereço cadastrado no runway_test.`);
  }

  // Buscar cartão preferencial
  const cardRes = await client.query(
    `SELECT id, bandeira_id, numero_cartao, nome_impresso FROM "CARTAO" WHERE cliente_id = $1 AND preferencial = true LIMIT 1`,
    [cliente.id]
  );

  const cartaoId = cardRes.rows[0]?.id || (
    await client.query(`SELECT id FROM "CARTAO" WHERE cliente_id = $1 LIMIT 1`, [cliente.id])
  ).rows[0]?.id;

  if (!cartaoId) {
    throw new Error(`A cliente ${cliente.codigo} (${cliente.nome}) não possui cartão de crédito cadastrado no runway_test.`);
  }

  return {
    cliente,
    endereco: endRes.rows[0],
    cartaoId
  };
}

async function validarVariacoesExistentes(client) {
  const varIds = [4, 11, 31];
  const res = await client.query(
    `SELECT pv.id, pv.produto_id, pv.tamanho, p.codigo, p.nome, p.categoria, p.preco
     FROM "PRODUTO_VARIACAO" pv
     JOIN "PRODUTO" p ON p.id = pv.produto_id
     WHERE pv.id = ANY($1)`,
    [varIds]
  );

  if (res.rows.length < varIds.length) {
    const encontrados = res.rows.map(r => r.id);
    const faltantes = varIds.filter(id => !encontrados.includes(id));
    throw new Error(`As seguintes variações de calçado não foram encontradas no catálogo do runway_test: ${faltantes.join(', ')}`);
  }

  return res.rows;
}

async function inserirMassaAnalise(client, { cliente, endereco, cartaoId }) {
  await client.query('BEGIN');
  try {
    for (const p of PEDIDOS_PLANEJADOS) {
      const subtotal = p.itens.reduce((acc, i) => acc + (i.quantidade * i.precoUnitario), 0);
      const valorTotal = Number((subtotal + p.valorFrete).toFixed(2));

      // Inserir PEDIDO
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

      // Inserir ITENS_PEDIDO
      for (const item of p.itens) {
        await client.query(
          `INSERT INTO "ITEM_PEDIDO" (pedido_id, produto_variacao_id, quantidade, preco_unitario)
           VALUES ($1, $2, $3, $4)`,
          [pedidoId, item.produtoVariacaoId, item.quantidade, item.precoUnitario]
        );
      }

      // Inserir PAGAMENTO_PEDIDO (Cartão de crédito da cliente, respeitando chk_pagamento_origem)
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
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function consultarTotaisEsperados(client) {
  const sql = `
    SELECT 
      to_char(p.dt_pedido, 'YYYY-MM') AS periodo,
      prod.categoria,
      SUM(ip.quantidade * ip.preco_unitario) AS valor_categoria,
      COUNT(DISTINCT p.id) as qtd_pedidos
    FROM "PEDIDO" p
    JOIN "ITEM_PEDIDO" ip ON ip.pedido_id = p.id
    JOIN "PRODUTO_VARIACAO" pv ON pv.id = ip.produto_variacao_id
    JOIN "PRODUTO" prod ON prod.id = pv.produto_id
    WHERE p.status = 'ENTREGUE'
      AND p.codigo = ANY($1)
    GROUP BY to_char(p.dt_pedido, 'YYYY-MM'), prod.categoria
    ORDER BY periodo ASC, prod.categoria ASC;
  `;

  const res = await client.query(sql, [CODIGOS_PEDIDOS_ANALISE]);
  return res.rows;
}

async function main() {
  const args = process.argv.slice(2);
  const isClean = args.includes('--clean');
  const isStatus = args.includes('--status');

  console.log('========================================================================');
  console.log(' RUNWAY — CARTÃO 02: MASSA DE DADOS DA ANÁLISE GERENCIAL');
  console.log('========================================================================\n');

  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    const dbName = await validarConexaoSegura(client);
    console.log(`✔ [SEGURANÇA] Conectado com sucesso ao banco exclusivo: "${dbName}"\n`);

    if (isClean) {
      console.log('--- EXECUTANDO RESTAURAÇÃO / LIMPEZA RESTRITA DA MASSA ---');
      const count = await limparMassaExistente(client);
      console.log(`✔ [RESTAURAÇÃO CONCLUÍDA] Foram removidos exatamente ${count} pedidos da análise (${CODIGOS_PEDIDOS_ANALISE.join(', ')}).`);
      console.log('✔ Clientes, catálogo, estoques e demais pedidos permaneceram 100% preservados.\n');
      return;
    }

    if (isStatus) {
      console.log('--- RELATÓRIO DO ESTADO ATUAL NO BANCO ---');
      const totais = await consultarTotaisEsperados(client);
      console.table(totais);
      return;
    }

    // Modo Padrão: Preparação com Idempotência (Limpa e Reinsere)
    console.log('--- 1. VERIFICANDO PRÉ-REQUISITOS DETERMINÍSTICOS ---');
    const { cliente, endereco, cartaoId } = await obterClienteDeterministo(client);
    console.log(`✔ Cliente: ${cliente.codigo} - ${cliente.nome} (CPF: ${cliente.cpf})`);
    console.log(`✔ Endereço de Entrega ID ${endereco.id}: ${endereco.logradouro}, ${endereco.numero} - ${endereco.cidade}/${endereco.estado}`);
    console.log(`✔ Cartão de Crédito ID: ${cartaoId}`);

    const vars = await validarVariacoesExistentes(client);
    console.log(`✔ Calçados e variações confirmados: ${vars.length} variações ativas.`);

    console.log('\n--- 2. LIMPANDO EXECUÇÕES PRÉVIAS (IDEMPOTÊNCIA) ---');
    const removidos = await limparMassaExistente(client);
    console.log(`✔ ${removidos} registros anteriores limpos com sucesso.`);

    console.log('\n--- 3. INSERINDO 9 PEDIDOS CONTROLADOS DA ANÁLISE ---');
    await inserirMassaAnalise(client, { cliente, endereco, cartaoId });
    console.log(`✔ 9 pedidos, seus respectivos itens e pagamentos foram persistidos transacionalmente.`);

    console.log('\n--- 4. TOTAIS AGREGADOS CALCULADOS VIA SQL NO BANCO (APENAS STATUS ENTREGUE) ---');
    const totais = await consultarTotaisEsperados(client);
    console.table(totais.map(t => ({
      Periodo: t.periodo,
      Categoria: t.categoria,
      'Valor Categoria': Number(t.valor_categoria).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Qtd Pedidos': t.qtd_pedidos
    })));

    console.log('\n✔ [CONFORME] Massa de dados do Cartão 02 pronta e validada no runway_test!\n');
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
  CODIGOS_PEDIDOS_ANALISE,
  PEDIDOS_PLANEJADOS,
  validarConexaoSegura,
  limparMassaExistente,
  obterClienteDeterministo,
  validarVariacoesExistentes,
  inserirMassaAnalise,
  consultarTotaisEsperados
};
