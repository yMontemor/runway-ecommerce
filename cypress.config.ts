import { defineConfig } from 'cypress';
import { Client } from 'pg';

function createTestDbClient(): Client {
  const envDb = process.env.PGDATABASE?.trim();
  if (envDb && envDb !== 'runway_test') {
    throw new Error(
      `[BLOQUEIO DE SEGURANÇA CYPRESS] PGDATABASE está configurado como "${envDb}".\n` +
      `As tasks do Cypress só podem operar exclusivamente sobre o banco "runway_test" para proteger o banco principal "runway".\n` +
      `Fallback silencioso para "runway" é proibido.`
    );
  }

  return new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '123',
    database: 'runway_test'
  });
}

async function withSafeTestDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { validarConexaoSegura } = require('./scripts/seed-massa-analise.js');
  const client = createTestDbClient();
  await client.connect();
  try {
    await validarConexaoSegura(client, 'runway_test');
    return await fn(client);
  } finally {
    await client.end();
  }
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: false,
    env: {
      RUNWAY_ADMIN_KEY: process.env.RUNWAY_ADMIN_KEY || process.env.CYPRESS_RUNWAY_ADMIN_KEY || ''
    },
    setupNodeEvents(on, config) {
      on('task', {
        obterAdminKey() {
          return process.env.RUNWAY_ADMIN_KEY || process.env.CYPRESS_RUNWAY_ADMIN_KEY || '';
        },

        async prepararCuponsCypress({ clienteId, clienteCodigo }: { clienteId?: number; clienteCodigo?: string }) {
          return withSafeTestDb(async (client) => {
            let targetClienteId = clienteId;
            if ((!targetClienteId || targetClienteId <= 0) && clienteCodigo) {
              const res = await client.query('SELECT id FROM "CLIENTE" WHERE codigo = $1', [clienteCodigo]);
              targetClienteId = res.rows[0]?.id;
            } else if (clienteCodigo) {
              const res = await client.query('SELECT id FROM "CLIENTE" WHERE codigo = $1', [clienteCodigo]);
              if (res.rows[0]?.id) {
                targetClienteId = res.rows[0].id;
              }
            }

            if (!targetClienteId) {
              throw new Error(`Cliente não encontrado para preparar cupons: id=${clienteId}, codigo=${clienteCodigo}`);
            }

            const ts = Date.now();
            const cupomResto5 = `CY-RESTO5-${ts}`;
            const cupomPromoResto5 = `CY-PROMO5-${ts}`;
            const cupomTrocaA = `CY-TROCA-A-${ts}`;
            const cupomTrocaB = `CY-TROCA-B-${ts}`;
            const cupomSobra = `CY-SOBRA-${ts}`;
            const cupomMenor = `CY-MENOR-${ts}`;
            const cupomMaior = `CY-MAIOR-${ts}`;
            const cupomSuperfluo = `CY-EXTRA-${ts}`;

            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 464.90, $2)`,
              [cupomResto5, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'PROMOCIONAL', 464.90, NULL)`,
              [cupomPromoResto5]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 300.00, $2)`,
              [cupomTrocaA, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 300.00, $2)`,
              [cupomTrocaB, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 600.00, $2)`,
              [cupomSobra, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 50.00, $2)`,
              [cupomMenor, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 150.00, $2)`,
              [cupomMaior, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 40.00, $2)`,
              [cupomSuperfluo, targetClienteId]
            );

            return { cupomResto5, cupomPromoResto5, cupomTrocaA, cupomTrocaB, cupomSobra, cupomMenor, cupomMaior, cupomSuperfluo };
          });
        },

        async limparCuponsCypressNaoUtilizados() {
          return withSafeTestDb(async (client) => {
            await client.query(`
              DELETE FROM "CUPOM"
              WHERE codigo LIKE 'CY-%'
                AND id NOT IN (SELECT cupom_id FROM "PAGAMENTO_PEDIDO" WHERE cupom_id IS NOT NULL)
            `);
            return true;
          });
        },

        async garantirCuponsPromocionais() {
          return withSafeTestDb(async (client) => {
            await client.query(`
              INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id)
              SELECT 'PROMO20', 'PROMOCIONAL', 20.00, NULL
              WHERE NOT EXISTS (SELECT 1 FROM "CUPOM" WHERE codigo = 'PROMO20');

              INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id)
              SELECT 'BEMVINDO50', 'PROMOCIONAL', 50.00, NULL
              WHERE NOT EXISTS (SELECT 1 FROM "CUPOM" WHERE codigo = 'BEMVINDO50');
            `);
            return true;
          });
        },

        async ajustarEstoqueVariacao({ variacaoId, quantidade }: { variacaoId: number; quantidade: number }) {
          return withSafeTestDb(async (client) => {
            // Cancelar apenas pedidos EM PROCESSAMENTO de testes (excluindo pedidos controlados PED-ANL-*)
            // para não inflar pedidosEmProcessamento na fórmula do estoque disponível
            await client.query(`
              UPDATE "PEDIDO"
              SET status = 'CANCELADA'
              WHERE status = 'EM PROCESSAMENTO'
                AND codigo NOT LIKE 'PED-ANL-%'
                AND cliente_id IN (SELECT id FROM "CLIENTE" WHERE codigo LIKE 'CLI-%')
                AND id IN (SELECT pedido_id FROM "ITEM_PEDIDO" WHERE produto_variacao_id = $1)
            `, [variacaoId]);

            await client.query(
              `UPDATE "ESTOQUE" SET quantidade = $1 WHERE produto_variacao_id = $2`,
              [quantidade, variacaoId]
            );
            return true;
          });
        },

        async obterEstoqueVariacao({ variacaoId }: { variacaoId: number }) {
          return withSafeTestDb(async (client) => {
            const res = await client.query(
              `SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`,
              [variacaoId]
            );
            return res.rows[0]?.quantidade !== undefined ? Number(res.rows[0].quantidade) : null;
          });
        },

        async expirarCarrinhoCliente({ clienteCodigo }: { clienteCodigo: string }) {
          return withSafeTestDb(async (client) => {
            await client.query(`
              UPDATE "CARRINHO"
              SET dt_criacao = NOW() - INTERVAL '25 minutes',
                  dt_atualizacao = NOW() - INTERVAL '25 minutes',
                  dt_expiracao = NOW() - INTERVAL '1 minute'
              WHERE cliente_id = (SELECT id FROM "CLIENTE" WHERE codigo = $1)
            `, [clienteCodigo]);
            return true;
          });
        },

        async obterPedidoPorCodigo({ codigoPedido }: { codigoPedido: string }) {
          return withSafeTestDb(async (client) => {
            const res = await client.query(
              'SELECT id, codigo, status, valor_total as "valorTotal", subtotal, valor_frete as "valorFrete" FROM "PEDIDO" WHERE codigo = $1',
              [codigoPedido]
            );
            return res.rows[0] || null;
          });
        },

        async obterTrocaPorCodigo({ codigoTroca }: { codigoTroca: string }) {
          return withSafeTestDb(async (client) => {
            const res = await client.query(`
              SELECT t.id, t.codigo, t.status, t.tipo, t.valor_total as "valorTotal",
                     t.retornou_ao_estoque as "retornouAoEstoque", t.cupom_id as "cupomId",
                     t.notificacao_cliente as "notificacaoCliente",
                     c.codigo as "cupomCodigo", c.valor as "cupomValor", c.tipo as "cupomTipo"
              FROM "TROCA" t
              LEFT JOIN "CUPOM" c ON c.id = t.cupom_id
              WHERE t.codigo = $1
            `, [codigoTroca]);
            return res.rows[0] || null;
          });
        },

        async obterPagamentoCupom({ cupomCodigo, pedidoCodigo }: { cupomCodigo: string; pedidoCodigo?: string }) {
          return withSafeTestDb(async (client) => {
            let sql = `
              SELECT pp.id, pp.pedido_id as "pedidoId", pp.forma_pagamento as "formaPagamento",
                     pp.valor, pp.cupom_id as "cupomId", c.codigo as "cupomCodigo", p.codigo as "pedidoCodigo"
              FROM "PAGAMENTO_PEDIDO" pp
              JOIN "CUPOM" c ON c.id = pp.cupom_id
              JOIN "PEDIDO" p ON p.id = pp.pedido_id
              WHERE c.codigo = $1
            `;
            const params: any[] = [cupomCodigo];
            if (pedidoCodigo) {
              sql += ' AND p.codigo = $2';
              params.push(pedidoCodigo);
            }
            const res = await client.query(sql, params);
            return res.rows[0] || null;
          });
        },

        async gerarCupomTrocaParaCenario11({ clienteCodigo }: { clienteCodigo: string }) {
          return withSafeTestDb(async (client) => {
            const clienteRes = await client.query('SELECT id FROM "CLIENTE" WHERE codigo = $1', [clienteCodigo]);
            const clienteId = clienteRes.rows[0]?.id;
            const codigoCupom = `TROCA-CY11-${Date.now().toString().slice(-6)}`;
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 449.90, $2)`,
              [codigoCupom, clienteId]
            );
            return codigoCupom;
          });
        },

        async prepararMassaAnalise() {
          const { restaurarMassaTesteControlada } = require('./scripts/seed-massa-analise.js');
          return withSafeTestDb(async (client) => {
            await restaurarMassaTesteControlada(client);
            return true;
          });
        },

        async restaurarMassaAnalise() {
          const { restaurarMassaTesteControlada } = require('./scripts/seed-massa-analise.js');
          return withSafeTestDb(async (client) => {
            const res = await restaurarMassaTesteControlada(client);
            return res;
          });
        },

        async consultarTotaisMassaAnalise() {
          const { consultarTotaisEsperados } = require('./scripts/seed-massa-analise.js');
          return withSafeTestDb(async (client) => {
            return await consultarTotaisEsperados(client);
          });
        },

        async consultarTotaisGlobaisAnalise({
          dataInicio = '2025-11-01',
          dataFim = '2026-12-31',
          categorias
        }: {
          dataInicio?: string;
          dataFim?: string;
          categorias?: string[];
        } = {}) {
          const { consultarTotaisGlobaisBanco } = require('./scripts/seed-massa-analise.js');
          return withSafeTestDb(async (client) => {
            const linhas = await consultarTotaisGlobaisBanco(client, dataInicio, dataFim, categorias || null);
            const porCategoria: Record<string, number> = {};
            let totalGeral = 0;

            for (const row of linhas) {
              const val = Number(row.valor_categoria);
              porCategoria[row.categoria] = Number(((porCategoria[row.categoria] || 0) + val).toFixed(2));
              totalGeral = Number((totalGeral + val).toFixed(2));
            }

            return {
              linhas: linhas.map((r: any) => ({
                periodo: r.periodo,
                categoria: r.categoria,
                valor: Number(r.valor_categoria),
                qtdPedidos: Number(r.qtd_pedidos)
              })),
              porCategoria,
              totalGeral
            };
          });
        },

        async confirmarBancoSeguro() {
          return withSafeTestDb(async () => {
            return { banco: 'runway_test', seguro: true };
          });
        },

        async obterPedidoDb({ codigoPedido }: { codigoPedido: string }) {
          return withSafeTestDb(async (client) => {
            const res = await client.query(
              `SELECT codigo, status, dt_pedido as "dataPedido" FROM "PEDIDO" WHERE codigo = $1`,
              [codigoPedido]
            );
            return res.rows[0] || null;
          });
        },

        async validarIntegridadeMassaAposTeste() {
          const { consultarTotaisEsperados, calcularTotalEsperadoCanonico } = require('./scripts/seed-massa-analise.js');
          return withSafeTestDb(async (client) => {
            const resPed8 = await client.query(`SELECT status FROM "PEDIDO" WHERE codigo = 'PED-ANL-0008'`);
            const resPed36 = await client.query(`SELECT status FROM "PEDIDO" WHERE codigo = 'PED-ANL-0036'`);
            const statusPed8 = resPed8.rows[0]?.status;
            const statusPed36 = resPed36.rows[0]?.status;

            const totais = await consultarTotaisEsperados(client);
            const totalGeral = Number(
              totais.reduce(
                (acc: number, t: { valor_categoria: number | string }) => acc + Number(t.valor_categoria),
                0
              ).toFixed(2)
            );
            const totalCanonicoEsperado = calcularTotalEsperadoCanonico();

            if (
              statusPed8 !== 'EM TRANSPORTE' ||
              statusPed36 !== 'EM TRANSPORTE' ||
              Math.abs(totalGeral - totalCanonicoEsperado) >= 0.01
            ) {
              throw new Error(
                `[FALHA FATAL NA RESTAURAÇÃO DA MASSA]\n` +
                `Status de PED-ANL-0008: "${statusPed8}" (esperado: "EM TRANSPORTE").\n` +
                `Status de PED-ANL-0036: "${statusPed36}" (esperado: "EM TRANSPORTE").\n` +
                `Total geral PED-ANL-*: R$ ${totalGeral.toFixed(2)} (esperado: R$ ${totalCanonicoEsperado.toFixed(2)}).`
              );
            }
            return { restaurado: true, totalGeral, totalCanonicoEsperado, statusPed8, statusPed36 };
          });
        }
      });

      return config;
    }
  }
});
