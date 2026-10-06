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
    setupNodeEvents(on, config) {
      on('task', {
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
            const cupomSobra = `CY-SOBRA-${ts}`;
            const cupomMenor = `CY-MENOR-${ts}`;
            const cupomMaior = `CY-MAIOR-${ts}`;
            const cupomSuperfluo = `CY-EXTRA-${ts}`;

            // Inserir cupom de troca para residual de R$ 5,00 (compra Corre 4 R$ 449,90 + Frete SP R$ 20,00 = R$ 469,90)
            await client.query(
              `INSERT INTO "CUPOM" (codigo, tipo, valor, cliente_id) VALUES ($1, 'TROCA', 464.90, $2)`,
              [cupomResto5, targetClienteId]
            );

            // Inserir cupom de troca para excedente (R$ 600,00 para compra de R$ 469,90, excedente de R$ 130,10)
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

            return { cupomResto5, cupomSobra, cupomMenor, cupomMaior, cupomSuperfluo };
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
            await client.query(
              `UPDATE "ESTOQUE" SET quantidade = $1 WHERE produto_variacao_id = $2`,
              [quantidade, variacaoId]
            );
            return true;
          } finally {
            await client.end();
          }
        }
      });

      return config;
    }
  }
});
