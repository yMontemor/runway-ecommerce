const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123@localhost:5432/runway' });

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM "CUPOM"');
  console.log('Cupons no PostgreSQL:', res.rows);
  await client.end();
}

run().catch(console.error);
