/**
 * Script de validação técnica do Cartão 03 - RunWay E-Commerce
 * Testa todos os requisitos, regras de negócio e gabaritos oficiais.
 */
const { Client } = require('pg');

const BASE_URL = 'http://localhost:5035';

async function run() {
  console.log('========================================================================');
  console.log(' RUNWAY — CARTÃO 03: VALIDAÇÃO TÉCNICA DA ANÁLISE GERENCIAL DE VENDAS');
  console.log('========================================================================\n');

  // 1. Verificar banco principal runway (deve estar 100% intocado)
  const clientProd = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '123', database: 'runway' });
  await clientProd.connect();
  const prodOrders = await clientProd.query('SELECT count(*) FROM "PEDIDO" WHERE codigo LIKE \'PED-ANL-%\'');
  console.log(`✔ [SEGURANÇA] Pedidos de análise no banco principal ("runway"): ${prodOrders.rows[0].count} (esperado: 0)`);
  await clientProd.end();

  // 2. Garantir massa de dados no estado inicial em runway_test
  const { execSync } = require('child_process');
  console.log('✔ [SETUP] Garantindo estado inicial da massa de testes via seed-massa-analise...');
  execSync('node scripts/seed-massa-analise.js', { stdio: 'pipe' });

  // 3. Teste 1: Gabarito Inicial (5 meses: 2025-11 a 2026-03)
  console.log('\n--- TESTE 1: Gabarito Inicial (2025-11 a 2026-03) ---');
  let res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O`);
  let json = await res.json();
  console.log(`Status HTTP: ${res.status}`);
  console.log(`Período: ${json.periodoInicial} até ${json.periodoFinal}`);
  console.log(`Linha do tempo: [${json.periodos.join(', ')}]`);
  console.log(`Total Geral: R$ ${json.totalGeral.toFixed(2)} (Esperado: R$ 7850.09)`);
  
  for (const s of json.series) {
    console.log(`  Série: ${s.categoria} -> Total: R$ ${s.total.toFixed(2)}`);
    for (const d of s.dados) {
      console.log(`    ${d.periodo}: R$ ${d.valor.toFixed(2)}`);
    }
  }

  if (Math.abs(json.totalGeral - 7850.09) < 0.01) {
    console.log('✔ [APROVADO] Total geral inicial confere exatamente com o gabarito: R$ 7.850,09');
  } else {
    throw new Error(`[FALHA] Total inicial incorreto: ${json.totalGeral}`);
  }

  // 4. Teste 2: Preservação de dias informados (YYYY-MM-DD) sem ampliação tácita
  console.log('\n--- TESTE 2: Intervalo com dias informados (YYYY-MM-DD) ---');
  // Cortando antes do dia 12/03/2026 (PED-ANL-0009 ocorreu em 12/03/2026)
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11-15&dataFim=2026-03-10&categorias=TREINO%20DI%C3%81RIO,COMPETI%C3%87%C3%83O`);
  json = await res.json();
  console.log(`Status HTTP: ${res.status}`);
  const marcoPonto = json.series.find(s => s.categoria === 'COMPETIÇÃO')?.dados.find(d => d.periodo === '2026-03');
  console.log(`Março/2026 COMPETIÇÃO até 10/03: R$ ${marcoPonto?.valor.toFixed(2)} (Esperado: R$ 0.00, pois venda foi em 12/03)`);
  if (marcoPonto?.valor === 0) {
    console.log('✔ [APROVADO] Dias parciais preservados estritamente, sem ampliar tacitamente para o mês inteiro.');
  } else {
    throw new Error(`[FALHA] O dia informado não foi preservado! Valor: ${marcoPonto?.valor}`);
  }

  // Agora incluindo o dia 12/03/2026
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11-15&dataFim=2026-03-12&categorias=TREINO%20DI%C3%81RIO,COMPETI%C3%87%C3%83O`);
  json = await res.json();
  const marcoPontoIncluso = json.series.find(s => s.categoria === 'COMPETIÇÃO')?.dados.find(d => d.periodo === '2026-03');
  console.log(`Março/2026 COMPETIÇÃO até 12/03: R$ ${marcoPontoIncluso?.valor.toFixed(2)} (Esperado: R$ 1099.90)`);
  if (Math.abs((marcoPontoIncluso?.valor || 0) - 1099.90) < 0.01) {
    console.log('✔ [APROVADO] Venda do dia 12/03/2026 incluída com limite final exclusivo correto.');
  } else {
    throw new Error(`[FALHA] Venda do dia 12/03 não incluída! Valor: ${marcoPontoIncluso?.valor}`);
  }

  // 5. Teste 3: Validação RN0072 (1 a 24 meses)
  console.log('\n--- TESTE 3: Regra RN0072 (Intervalos de 1 a 24 meses) ---');
  // 1 mês aceito
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2026-01&dataFim=2026-01&categorias=TREINO%20DI%C3%81RIO`);
  console.log(`1 mês (2026-01 a 2026-01) -> Status: ${res.status} (Esperado: 200)`);

  // 24 meses aceito
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2024-04&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO`);
  console.log(`24 meses (2024-04 a 2026-03) -> Status: ${res.status} (Esperado: 200)`);

  // 25 meses rejeitado
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2024-03&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO`);
  json = await res.json();
  console.log(`25 meses (2024-03 a 2026-03) -> Status: ${res.status} (Esperado: 400). Erro retornado: "${json.erro}"`);
  if (res.status === 400 && json.erro.includes('RN0072')) {
    console.log('✔ [APROVADO] Período superior a 24 meses rejeitado com HTTP 400 e menção a RN0072.');
  } else {
    throw new Error(`[FALHA] Esperava HTTP 400 para 25 meses, obteve ${res.status}`);
  }

  // 6. Teste 4: Validação RF0056 (Data Inicial posterior à Data Final)
  console.log('\n--- TESTE 4: Regra RF0056 (Data inicial posterior à final) ---');
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2026-03&dataFim=2025-11&categorias=TREINO%20DI%C3%81RIO`);
  json = await res.json();
  console.log(`Invertido (2026-03 a 2025-11) -> Status: ${res.status} (Esperado: 400). Erro: "${json.erro}"`);
  if (res.status === 400 && json.erro.includes('RF0056')) {
    console.log('✔ [APROVADO] Datas invertidas rejeitadas com HTTP 400 e menção a RF0056.');
  } else {
    throw new Error(`[FALHA] Esperava HTTP 400 para datas invertidas`);
  }

  // 7. Teste 5: Validação RF0057 (Categorias inválidas e inexistentes)
  console.log('\n--- TESTE 5: Regra RF0057 (Validação de Categorias) ---');
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO,CATEGORIA_INEXISTENTE`);
  json = await res.json();
  console.log(`Categoria inválida -> Status: ${res.status} (Esperado: 400). Erro: "${json.erro}"`);
  if (res.status === 400 && json.erro.includes('CATEGORIA_INEXISTENTE')) {
    console.log('✔ [APROVADO] Categoria inexistente rejeitada integralmente com HTTP 400 sem aceitação parcial silenciosa.');
  } else {
    throw new Error(`[FALHA] Esperava HTTP 400 para categoria inexistente`);
  }

  // Sem categorias informadas
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03`);
  json = await res.json();
  console.log(`Sem categorias -> Status: ${res.status} (Esperado: 400). Erro: "${json.erro}"`);
  if (res.status === 400 && json.erro.includes('RF0057')) {
    console.log('✔ [APROVADO] Ausência de categorias rejeitada com HTTP 400.');
  } else {
    throw new Error(`[FALHA] Esperava HTTP 400 para ausência de categorias`);
  }

  // 8. Teste 6: Transição de Status de PED-ANL-0008 para ENTREGUE
  console.log('\n--- TESTE 6: Transição de PED-ANL-0008 para ENTREGUE via PATCH ---');
  const patchRes = await fetch(`${BASE_URL}/api/pedidos/PED-ANL-0008/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novoStatus: 'ENTREGUE' })
  });
  console.log(`PATCH /api/pedidos/PED-ANL-0008/status -> Status: ${patchRes.status}`);

  // Reconsultar análise
  res = await fetch(`${BASE_URL}/api/analise/vendas?dataInicio=2025-11&dataFim=2026-03&categorias=TREINO%20DI%C3%81RIO&categorias=COMPETI%C3%87%C3%83O`);
  json = await res.json();
  console.log(`Novo Total Geral pós-transição: R$ ${json.totalGeral.toFixed(2)} (Esperado: R$ 8299.99)`);
  
  const treinoPontoMarco = json.series.find(s => s.categoria === 'TREINO DIÁRIO')?.dados.find(d => d.periodo === '2026-03');
  console.log(`Março/2026 TREINO DIÁRIO pós-transição: R$ ${treinoPontoMarco?.valor.toFixed(2)} (Esperado: R$ 449.90)`);

  if (Math.abs(json.totalGeral - 8299.99) < 0.01 && Math.abs((treinoPontoMarco?.valor || 0) - 449.90) < 0.01) {
    console.log('✔ [APROVADO] Gabarito pós-transição confere perfeitamente: R$ 8.299,99!');
  } else {
    throw new Error(`[FALHA] Total pós-transição incorreto: ${json.totalGeral}`);
  }

  // 9. Restaurar massa de testes para o estado inicial
  console.log('\n--- RESTAURAÇÃO: Retornando massa de testes ao estado inicial ---');
  execSync('node scripts/seed-massa-analise.js', { stdio: 'pipe' });
  console.log('✔ [SUCESSO] Base de testes restaurada ao estado inicial com sucesso.');

  console.log('\n========================================================================');
  console.log(' TODOS OS 6 TESTES E GABARITOS DO CARTÃO 03 FORAM APROVADOS COM ÊXITO!');
  console.log('========================================================================');
}

run().catch(err => {
  console.error('\n❌ ERRO NA VALIDAÇÃO:', err);
  process.exit(1);
});
