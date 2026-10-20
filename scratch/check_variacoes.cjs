const { Client } = require('pg');
const client = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '123', database: 'runway' });
client.connect().then(async () => {
  const res = await client.query(`
    SELECT pv.id, p.codigo, p.nome, pv.tamanho, e.quantidade
    FROM "PRODUTO_VARIACAO" pv
    JOIN "PRODUTO" p ON p.id = pv.produto_id
    LEFT JOIN "ESTOQUE" e ON e.produto_variacao_id = pv.id
    WHERE p.codigo IN ('olympikus_corre_4', 'fila_float_maxxi')
    ORDER BY p.codigo, pv.tamanho
  `);
  console.table(res.rows);
  await client.end();
}).catch(console.error);
