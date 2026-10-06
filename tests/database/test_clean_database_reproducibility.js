const { Client } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

const adminClient = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '123',
  database: 'postgres'
});

async function main() {
  console.log('--- 1. Criando banco limpo temporário: runway_clean_test ---');
  await adminClient.connect();
  await adminClient.query('DROP DATABASE IF EXISTS runway_clean_test WITH (FORCE);');
  await adminClient.query('CREATE DATABASE runway_clean_test;');
  await adminClient.end();
  console.log('Banco runway_clean_test criado com sucesso.');

  console.log('\n--- 2. Executando dotnet ef database update no banco limpo ---');
  const backendDir = path.resolve(__dirname, '../../backend');
  const connStr = 'Host=localhost;Port=5432;Database=runway_clean_test;Username=postgres;Password=123';
  
  const output = execSync(`dotnet ef database update --connection "${connStr}"`, {
    cwd: backendDir,
    encoding: 'utf8'
  });
  console.log(output);

  console.log('\n--- 3. Inspecionando dados gerados no banco limpo: runway_clean_test ---');
  const cleanClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123',
    database: 'runway_clean_test'
  });

  await cleanClient.connect();

  const prods = await cleanClient.query('SELECT count(*) as c, min(id) as min_id, max(id) as max_id FROM "PRODUTO"');
  const vars = await cleanClient.query('SELECT count(*) as c, min(id) as min_id, max(id) as max_id FROM "PRODUTO_VARIACAO"');
  const ests = await cleanClient.query('SELECT count(*) as c, min(id) as min_id, max(id) as max_id FROM "ESTOQUE"');

  console.log(`PRODUTO: ${prods.rows[0].c} registros (Range ID: ${prods.rows[0].min_id} a ${prods.rows[0].max_id})`);
  console.log(`PRODUTO_VARIACAO: ${vars.rows[0].c} registros (Range ID: ${vars.rows[0].min_id} a ${vars.rows[0].max_id})`);
  console.log(`ESTOQUE: ${ests.rows[0].c} registros (Range ID: ${ests.rows[0].min_id} a ${ests.rows[0].max_id})`);

  // Validar produtos 1 a 6
  const prods6 = await cleanClient.query('SELECT id, codigo, nome FROM "PRODUTO" WHERE id BETWEEN 1 AND 6 ORDER BY id');
  console.log('\nPrimeiros 6 produtos no banco limpo:');
  for (const r of prods6.rows) {
    console.log(` - ID ${r.id}: ${r.codigo} ("${r.nome}")`);
  }

  // Validar variações do Corre 4 (ID 1)
  const varCorre4 = await cleanClient.query(`
    SELECT pv.id as var_id, pv.produto_id, pv.tamanho, e.quantidade
    FROM "PRODUTO_VARIACAO" pv
    JOIN "ESTOQUE" e ON e.produto_variacao_id = pv.id
    WHERE pv.produto_id = 1
    ORDER BY pv.tamanho
  `);
  console.log('\nVariações e estoques do Corre 4 (Produto ID 1):');
  console.table(varCorre4.rows);

  // Validar especificamente variação 4 (tamanho 41, usada no Cypress)
  const var4 = varCorre4.rows.find(v => v.var_id === 4);
  console.log('Verificação Variação ID 4:', var4 ? `OK (Tamanho ${var4.tamanho}, Estoque ${var4.quantidade})` : 'ERRO');

  // Validar sequence values
  const seqProd = await cleanClient.query(`SELECT last_value FROM "PRODUTO_id_seq"`);
  const seqVar = await cleanClient.query(`SELECT last_value FROM "PRODUTO_VARIACAO_id_seq"`);
  const seqEst = await cleanClient.query(`SELECT last_value FROM "ESTOQUE_id_seq"`);
  console.log(`\nSequences no banco limpo:`);
  console.log(` - PRODUTO_id_seq: last_value = ${seqProd.rows[0]?.last_value}`);
  console.log(` - PRODUTO_VARIACAO_id_seq: last_value = ${seqVar.rows[0]?.last_value}`);
  console.log(` - ESTOQUE_id_seq: last_value = ${seqEst.rows[0]?.last_value}`);

  await cleanClient.end();
  console.log('\nValidação em banco limpo concluída com sucesso!');
}

main().catch(err => {
  console.error('Erro na validação do banco limpo:', err);
  process.exit(1);
});
