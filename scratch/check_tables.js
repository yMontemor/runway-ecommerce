const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:123@localhost:5432/runway' });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('TROCA', 'ITEM_TROCA')");
  console.log('Tables found:', res.rows);
  const cols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'TROCA' ORDER BY ordinal_position");
  console.log('TROCA columns:', cols.rows);
  const seq = await client.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'troca_codigo_seq'");
  console.log('Sequences found:', seq.rows);
  await client.end();
}

main().catch(console.error);
