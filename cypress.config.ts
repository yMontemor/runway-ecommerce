import { defineConfig } from 'cypress';
import { Client } from 'pg';

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
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
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

            // Inserir cupom de troca para residual de R$ 5,00 (compra Corre 4 R$ 449,90 + Frete SP R$ 20,00 = R$ 469,90)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 464.90, $2)`,
              [cupomResto5, targetClienteId]
            );

            // Inserir cupom PROMOCIONAL para residual de R$ 5,00 (Cenário 3 obrigatório)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'PROMOCIONAL', 464.90, NULL)`,
              [cupomPromoResto5]
            );

            // Inserir par de cupons de troca (R$ 300,00 cada = R$ 600,00 para compra de R$ 469,90, excedente de R$ 130,10 - Cenário 4 obrigatório)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 300.00, $2)`,
              [cupomTrocaA, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 300.00, $2)`,
              [cupomTrocaB, targetClienteId]
            );

            // Inserir cupom de troca para excedente único (R$ 600,00 para compra de R$ 469,90, excedente de R$ 130,10)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 600.00, $2)`,
              [cupomSobra, targetClienteId]
            );

            // Cupons de valores distintos para validar ordenação decrescente de valor (RN0035)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 50.00, $2)`,
              [cupomMenor, targetClienteId]
            );
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 150.00, $2)`,
              [cupomMaior, targetClienteId]
            );

            // Cupom extra para validar rejeição de cupom supérfluo/desnecessário (RN0036)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 40.00, $2)`,
              [cupomSuperfluo, targetClienteId]
            );

            return { cupomResto5, cupomPromoResto5, cupomTrocaA, cupomTrocaB, cupomSobra, cupomMenor, cupomMaior, cupomSuperfluo };
          } finally {
            await client.end();
          }
        },

        async limparCuponsCypressNaoUtilizados() {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            await client.query(`
              DELETE FROM "CUPOM" 
              WHERE codigo LIKE 'CY-%' 
                AND id NOT IN (SELECT cupom_id FROM "PAGAMENTO_PEDIDO" WHERE cupom_id IS NOT NULL)
            `);
            return true;
          } finally {
            await client.end();
          }
        },

        async garantirCuponsPromocionais() {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            await client.query(`
              INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id)
              SELECT 'PROMO20', 'PROMOCIONAL', 20.00, NULL
              WHERE NOT EXISTS (SELECT 1 FROM "CUPOM" WHERE codigo = 'PROMO20');

              INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id)
              SELECT 'BEMVINDO50', 'PROMOCIONAL', 50.00, NULL
              WHERE NOT EXISTS (SELECT 1 FROM "CUPOM" WHERE codigo = 'BEMVINDO50');
            `);
            return true;
          } finally {
            await client.end();
          }
        },

        async ajustarEstoqueVariacao({ variacaoId, quantidade }: { variacaoId: number; quantidade: number }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            // Cancelar pedidos EM PROCESSAMENTO de clientes de teste (CLI-%) que contenham esta variação
            // para não inflar artificialmente pedidosEmProcessamento na fórmula do estoque disponível
            await client.query(`
              UPDATE "PEDIDO"
              SET status = 'CANCELADA'
              WHERE status = 'EM PROCESSAMENTO'
                AND cliente_id IN (SELECT id FROM "CLIENTE" WHERE codigo LIKE 'CLI-%')
                AND id IN (SELECT pedido_id FROM "ITEM_PEDIDO" WHERE produto_variacao_id = $1)
            `, [variacaoId]);

            // Atualizar estoque físico no banco
            await client.query(
              `UPDATE "ESTOQUE" SET quantidade = $1 WHERE produto_variacao_id = $2`,
              [quantidade, variacaoId]
            );
            return true;
          } finally {
            await client.end();
          }
        },

        async obterEstoqueVariacao({ variacaoId }: { variacaoId: number }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            const res = await client.query(
              `SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`,
              [variacaoId]
            );
            return res.rows[0]?.quantidade !== undefined ? Number(res.rows[0].quantidade) : null;
          } finally {
            await client.end();
          }
        },

        async expirarCarrinhoCliente({ clienteCodigo }: { clienteCodigo: string }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            await client.query(`
              UPDATE "CARRINHO"
              SET dt_criacao = NOW() - INTERVAL '25 minutes',
                  dt_atualizacao = NOW() - INTERVAL '25 minutes',
                  dt_expiracao = NOW() - INTERVAL '1 minute'
              WHERE cliente_id = (SELECT id FROM "CLIENTE" WHERE codigo = $1)
            `, [clienteCodigo]);
            return true;
          } finally {
            await client.end();
          }
        },

        async obterPedidoPorCodigo({ codigoPedido }: { codigoPedido: string }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            const res = await client.query(
              'SELECT id, codigo, status, valor_total as "valorTotal", subtotal, valor_frete as "valorFrete" FROM "PEDIDO" WHERE codigo = $1',
              [codigoPedido]
            );
            return res.rows[0] || null;
          } finally {
            await client.end();
          }
        },

        async obterTrocaPorCodigo({ codigoTroca }: { codigoTroca: string }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
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
          } finally {
            await client.end();
          }
        },

        async obterPagamentoCupom({ cupomCodigo, pedidoCodigo }: { cupomCodigo: string; pedidoCodigo?: string }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
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
          } finally {
            await client.end();
          }
        },

        async gerarCupomTrocaParaCenario11({ clienteCodigo }: { clienteCodigo: string }) {
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: process.env.PGDATABASE || 'runway'
          });

          await client.connect();
          try {
            const clienteRes = await client.query('SELECT id FROM "CLIENTE" WHERE codigo = $1', [clienteCodigo]);
            const clienteId = clienteRes.rows[0]?.id;
            const codigoCupom = `TROCA-CY11-${Date.now().toString().slice(-6)}`;
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 449.90, $2)`,
              [codigoCupom, clienteId]
            );
            return codigoCupom;
          } finally {
            await client.end();
          }
        },

        async prepararMassaAnalise() {
          const { validarConexaoSegura, limparMassaExistente, obterClienteDeterministo, validarVariacoesExistentes, inserirMassaAnalise } = require('./scripts/seed-massa-analise.js');
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: 'runway_test'
          });
          await client.connect();
          try {
            await validarConexaoSegura(client);
            const { cliente, endereco, cartaoId } = await obterClienteDeterministo(client);
            await validarVariacoesExistentes(client);
            await limparMassaExistente(client);
            await inserirMassaAnalise(client, { cliente, endereco, cartaoId });
            return true;
          } finally {
            await client.end();
          }
        },

        async restaurarMassaAnalise() {
          const { validarConexaoSegura, limparMassaExistente } = require('./scripts/seed-massa-analise.js');
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: 'runway_test'
          });
          await client.connect();
          try {
            await validarConexaoSegura(client);
            const count = await limparMassaExistente(client);
            return count;
          } finally {
            await client.end();
          }
        },

        async consultarTotaisMassaAnalise() {
          const { validarConexaoSegura, consultarTotaisEsperados } = require('./scripts/seed-massa-analise.js');
          const client = new Client({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '123',
            database: 'runway_test'
          });
          await client.connect();
          try {
            await validarConexaoSegura(client);
            const totais = await consultarTotaisEsperados(client);
            return totais;
          } finally {
            await client.end();
          }
        }
      });

      return config;
    }
  }
});
