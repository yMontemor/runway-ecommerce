const { Client } = require('pg');

const BASE_URL = 'http://localhost:5035';

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function criarPedidoHelper(pgClient, codigoCliente, itens, cupons = []) {
  const resEnd = await fetch(`${BASE_URL}/api/clientes/${codigoCliente}/enderecos`);
  const ends = await resEnd.json();
  const enderecoId = (ends.find(e => e.entrega) || ends[0]).id;

  const resCard = await fetch(`${BASE_URL}/api/clientes/${codigoCliente}/cartoes`);
  const cards = await resCard.json();
  const cartaoId = cards[0].id;

  const freteRes = await fetch(`${BASE_URL}/api/frete/calcular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigoCliente,
      enderecoId,
      itens
    })
  });
  const freteData = await freteRes.json();
  const valorFrete = Number(freteData.valorFrete);

  let subtotal = 0;
  for (const it of itens) {
    const pRes = await pgClient.query('SELECT p.preco FROM "PRODUTO_VARIACAO" pv JOIN "PRODUTO" p ON pv.produto_id = p.id WHERE pv.id = $1', [it.produtoVariacaoId]);
    subtotal += Number(pRes.rows[0].preco) * it.quantidade;
  }

  let totalCupons = 0;
  for (const c of cupons) {
    const cRes = await pgClient.query('SELECT valor FROM "CUPOM" WHERE codigo = $1', [c]);
    if (cRes.rows.length > 0) totalCupons += Number(cRes.rows[0].valor);
  }

  const valorTotal = Math.round((subtotal + valorFrete) * 100) / 100;
  const valorCartao = Math.max(0, Math.round((valorTotal - totalCupons) * 100) / 100);
  const cartoesFinal = valorCartao > 0 ? [{ cartaoId, valor: valorCartao }] : [];

  const pedRes = await fetch(`${BASE_URL}/api/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigoCliente,
      itens,
      enderecoId,
      cupons,
      cartoes: cartoesFinal
    })
  });
  const pedData = await pedRes.json();
  return { status: pedRes.status, ok: pedRes.ok, data: pedData };
}

async function runTests() {
  console.log('================================================================');
  console.log(' RUNWAY - ETAPA D: SUÍTE DE TESTES TÉCNICOS INTEGRADOS');
  console.log('================================================================\n');

  const pgClient = new Client({ connectionString: 'postgresql://postgres:123@localhost:5432/runway' });
  await pgClient.connect();

  try {
    const cliRes = await pgClient.query("SELECT codigo FROM \"CLIENTE\" WHERE ativo = true ORDER BY id ASC LIMIT 2");
    const codCliente = cliRes.rows[0].codigo;
    const codClienteB = cliRes.rows[1].codigo;

    const varRes = await pgClient.query(`
      SELECT pv.id as variacao_id, p.nome, pv.tamanho, e.quantidade, p.preco
      FROM "PRODUTO_VARIACAO" pv
      JOIN "PRODUTO" p ON pv.produto_id = p.id
      JOIN "ESTOQUE" e ON e.produto_variacao_id = pv.id
      WHERE pv.ativo = true AND e.quantidade >= 10
      ORDER BY pv.id ASC
      LIMIT 2
    `);
    const var1 = varRes.rows[0];
    const var2 = varRes.rows[1];

    console.log(`Cliente A de teste: ${codCliente}`);
    console.log(`Cliente B de teste: ${codClienteB}`);
    console.log(`Variação 1: ${var1.nome} (ID: ${var1.variacao_id}, Tam: ${var1.tamanho}, Qtd Estoque: ${var1.quantidade})`);
    console.log(`Variação 2: ${var2.nome} (ID: ${var2.variacao_id}, Tam: ${var2.tamanho}, Qtd Estoque: ${var2.quantidade})\n`);

    // =========================================================================
    // SEÇÃO 1: CORREÇÃO PRÉVIA - PEDIDOS COM RESERVA EXPIRADA
    // =========================================================================
    console.log('--- SEÇÃO 1: Correção Prévia (Reserva Expirada de Pedido em Processamento) ---');

    // 1.1 Criar pedido para Cliente A em EM PROCESSAMENTO
    const pedidoExpRes = await criarPedidoHelper(pgClient, codCliente, [{ produtoVariacaoId: var1.variacao_id, quantidade: 2 }]);
    assert(pedidoExpRes.status === 201, `1.1 Criar pedido A em EM PROCESSAMENTO: ${pedidoExpRes.data?.codigo}`);
    const codPedidoExp = pedidoExpRes.data.codigo;

    // 1.2 Simular expiração dos 30 minutos alterando dt_pedido no PostgreSQL para 35 minutos atrás
    await pgClient.query(`UPDATE "PEDIDO" SET dt_pedido = NOW() - INTERVAL '35 minutes' WHERE codigo = $1`, [codPedidoExp]);
    console.log(`  -> dt_pedido do pedido ${codPedidoExp} alterado para 35 min atrás no PostgreSQL`);

    // 1.3 Reduzir estoque temporariamente para simular que Cliente B comprou as unidades liberadas
    const estoqueAntes = (await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [var1.variacao_id])).rows[0].quantidade;
    await pgClient.query(`UPDATE "ESTOQUE" SET quantidade = 1 WHERE produto_variacao_id = $1`, [var1.variacao_id]);
    console.log(`  -> Estoque temporariamente reduzido para 1 unidade (Cliente A precisa de 2)`);

    // 1.4 Cliente A tenta processar pagamento do pedido expirado
    const pagtoTardioRes = await request(`/api/pedidos/${codPedidoExp}/processar-pagamento`, {
      method: 'POST',
      body: JSON.stringify({ usuarioResponsavel: 'Sistema' })
    });
    assert(pagtoTardioRes.status === 200, `1.4 Chamada de pagamento tardio responde com 200`);
    assert(pagtoTardioRes.data.status === 'REPROVADA', `1.5 Pedido foi REPROVADO (RN0038) e não aprovado tardiamente: status=${pagtoTardioRes.data.status}`);

    // Restaurar estoque original
    await pgClient.query(`UPDATE "ESTOQUE" SET quantidade = $1 WHERE produto_variacao_id = $2`, [estoqueAntes, var1.variacao_id]);

    // 1.6 Verificar log de auditoria da reprovação no PostgreSQL
    const auditReprov = await pgClient.query(
      `SELECT operacao, dados_alterados FROM "LOG_AUDITORIA" WHERE entidade = 'PEDIDO' AND registro_id = $1 AND operacao = 'PAGAMENTO_REPROVADO' ORDER BY id DESC LIMIT 1`,
      [codPedidoExp]
    );
    assert(auditReprov.rows.length > 0, `1.6 Auditoria RNF0012 registrada para PAGAMENTO_REPROVADO do pedido ${codPedidoExp}`);

    // =========================================================================
    // SEÇÃO 2: FLUXO DE TROCAS (ETAPA D)
    // =========================================================================
    console.log('\n--- SEÇÃO 2: Validações de Elegibilidade e Bloqueio de Troca (RN0043) ---');

    // 2.1 Criar um novo pedido para testar o ciclo de vida
    const novoPedidoRes = await criarPedidoHelper(pgClient, codCliente, [
      { produtoVariacaoId: var1.variacao_id, quantidade: 2 },
      { produtoVariacaoId: var2.variacao_id, quantidade: 1 }
    ]);
    assert(novoPedidoRes.status === 201, `2.1 Criar pedido multi-item: ${novoPedidoRes.data?.codigo}`);
    const codPedidoReal = novoPedidoRes.data.codigo;
    const item1 = novoPedidoRes.data.itens.find(i => i.produtoVariacaoId === var1.variacao_id);
    const item2 = novoPedidoRes.data.itens.find(i => i.produtoVariacaoId === var2.variacao_id);

    // 2.2 Tentar solicitar troca com pedido ainda em EM PROCESSAMENTO (deve falhar - RN0043)
    const trocaBloq1 = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoReal,
        motivo: 'Tamanho ficou apertado',
        itens: [{ itemPedidoId: item1.id, quantidade: 1 }]
      })
    });
    assert(trocaBloq1.status === 400, `2.2 Bloqueio de troca em pedido EM PROCESSAMENTO: status=${trocaBloq1.status} (RN0043)`);

    // 2.3 Aprovar pagamento do pedido
    const aprRes = await request(`/api/pedidos/${codPedidoReal}/processar-pagamento`, {
      method: 'POST',
      body: JSON.stringify({ usuarioResponsavel: 'Operadora' })
    });
    assert(aprRes.data.status === 'APROVADA', `2.3 Pagamento aprovado: status=${aprRes.data.status}`);

    // 2.4 Tentar solicitar troca com pedido em APROVADA (deve falhar - RN0043)
    const trocaBloq2 = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoReal,
        motivo: 'Tamanho ficou apertado',
        itens: [{ itemPedidoId: item1.id, quantidade: 1 }]
      })
    });
    assert(trocaBloq2.status === 400, `2.4 Bloqueio de troca em pedido APROVADA: status=${trocaBloq2.status} (RN0043)`);

    // 2.5 Despachar pedido (EM TRANSPORTE)
    const despRes = await request(`/api/pedidos/${codPedidoReal}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ novoStatus: 'EM TRANSPORTE', usuarioResponsavel: 'Logística' })
    });
    assert(despRes.data.status === 'EM TRANSPORTE', `2.5 Pedido despachado: status=${despRes.data.status}`);

    // 2.6 Tentar solicitar troca com pedido em EM TRANSPORTE (deve falhar - RN0043)
    const trocaBloq3 = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoReal,
        motivo: 'Tamanho ficou apertado',
        itens: [{ itemPedidoId: item1.id, quantidade: 1 }]
      })
    });
    assert(trocaBloq3.status === 400, `2.6 Bloqueio de troca em pedido EM TRANSPORTE: status=${trocaBloq3.status} (RN0043)`);

    // 2.7 Confirmar entrega do pedido (ENTREGUE)
    const entRes = await request(`/api/pedidos/${codPedidoReal}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ novoStatus: 'ENTREGUE', usuarioResponsavel: 'Transportadora' })
    });
    assert(entRes.data.status === 'ENTREGUE', `2.7 Pedido entregue: status=${entRes.data.status}`);

    // 2.8 Consultar elegibilidade de troca
    const elegRes = await request(`/api/trocas/elegibilidade/${codPedidoReal}`);
    assert(elegRes.status === 200 && elegRes.data.podeSolicitarTroca === true, `2.8 Consulta de elegibilidade confirma pedido apto para troca`);
    assert(elegRes.data.itens.length === 2, `2.9 Retornou os 2 itens com quantidades elegíveis corretas`);

    console.log('\n--- SEÇÃO 3: Troca Parcial e Validações de Quantidade ---');

    // 3.1 Solicitar troca parcial de 1 unidade do Item 1 (compradas: 2)
    const trocaParcialRes = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoReal,
        motivo: 'Tamanho apertado no pé direito',
        itens: [{ itemPedidoId: item1.id, quantidade: 1 }]
      })
    });
    assert(trocaParcialRes.status === 201, `3.1 Solicitação de troca parcial criada com sucesso: ${trocaParcialRes.data?.codigo}`);
    const codTrocaParcial = trocaParcialRes.data.codigo;
    assert(trocaParcialRes.data.status === 'EM TROCA', `3.2 Status da troca é EM TROCA`);
    assert(trocaParcialRes.data.tipo === 'PARCIAL', `3.3 Tipo da troca é PARCIAL`);

    // 3.2 Verificar que o pedido principal PERMANECE em ENTREGUE na troca parcial
    const pedidoAposParcial = await request(`/api/pedidos/${codPedidoReal}`);
    assert(pedidoAposParcial.data.status === 'ENTREGUE', `3.4 Pedido principal permanece ENTREGUE na troca parcial: status=${pedidoAposParcial.data.status}`);

    // 3.3 Tentar solicitar troca de mais 2 unidades do Item 1 (deve falhar pois só resta 1 elegível)
    const trocaExcessoRes = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoReal,
        motivo: 'Tentativa de troca duplicada/excessiva',
        itens: [{ itemPedidoId: item1.id, quantidade: 2 }]
      })
    });
    assert(trocaExcessoRes.status === 400, `3.5 Bloqueio de quantidade excessiva/duplicada: status=${trocaExcessoRes.status}`);

    // 3.4 Tentar solicitar troca de pedido pertencente a outro cliente (deve falhar)
    const trocaOutroCliRes = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codClienteB,
        codigoPedido: codPedidoReal,
        motivo: 'Fraude de posse de pedido',
        itens: [{ itemPedidoId: item1.id, quantidade: 1 }]
      })
    });
    assert(trocaOutroCliRes.status === 400, `3.6 Bloqueio de solicitação de troca por cliente diferente do comprador: status=${trocaOutroCliRes.status}`);

    console.log('\n--- SEÇÃO 4: Autorização Administrativa e Notificação (RF0042 / RN0046) ---');

    // 4.1 Autorizar a troca parcial pelo admin
    const autRes = await request(`/api/trocas/${codTrocaParcial}/autorizar`, {
      method: 'POST',
      body: JSON.stringify({
        autorizado: true,
        usuarioResponsavel: 'Admin Logística'
      })
    });
    assert(autRes.status === 200, `4.1 Autorização administrativa processada com sucesso: status=${autRes.status}`);
    assert(autRes.data.status === 'TROCA AUTORIZADA', `4.2 Status da troca alterado para TROCA AUTORIZADA: status=${autRes.data.status}`);
    assert(autRes.data.adminAutorizacao === 'Admin Logística', `4.3 Responsável registrado: ${autRes.data.adminAutorizacao}`);
    assert(autRes.data.dataAutorizacao != null, `4.4 Data da autorização registrada`);

    // 4.2 Impedir autorizações duplicadas
    const autDupRes = await request(`/api/trocas/${codTrocaParcial}/autorizar`, {
      method: 'POST',
      body: JSON.stringify({ autorizado: true, usuarioResponsavel: 'Admin Outro' })
    });
    assert(autDupRes.status === 400, `4.5 Impedida autorização duplicada: status=${autDupRes.status}`);

    // 4.3 Consultar notificação persistida gerada para o cliente (RN0046)
    const notifRes = await request(`/api/trocas/${codTrocaParcial}/notificacao`);
    assert(notifRes.status === 200, `4.6 Endpoint de consulta de notificação responde 200`);
    assert(notifRes.data.mensagem?.includes('AUTORIZADA'), `4.7 Notificação interna persistida contém mensagem de autorização: "${notifRes.data.mensagem}"`);
    assert(notifRes.data.dataNotificacao != null, `4.8 Data da notificação registrada`);

    console.log('\n--- SEÇÃO 5: Confirmação de Recebimento, Reentrada em Estoque e Cupom (RF0044 / RF0045 / RF0054 / RN0042) ---');

    // 5.1 Verificar saldo de estoque antes do recebimento
    const estVar1Antes = (await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [var1.variacao_id])).rows[0].quantidade;
    console.log(`  -> Estoque antes do recebimento: ${estVar1Antes}`);

    // 5.2 Confirmar recebimento com retornarAoEstoque: true
    const recComEstoqueRes = await request(`/api/trocas/${codTrocaParcial}/recebimento`, {
      method: 'POST',
      body: JSON.stringify({
        retornarAoEstoque: true,
        usuarioResponsavel: 'Admin Estoque',
        observacoes: 'Produto recebido em perfeitas condições na caixa original'
      })
    });
    assert(recComEstoqueRes.status === 200, `5.1 Recebimento confirmado com sucesso: status=${recComEstoqueRes.status}`);
    assert(recComEstoqueRes.data.status === 'TROCADO', `5.2 Status da troca alterado para TROCADO (RN0042): status=${recComEstoqueRes.data.status}`);
    assert(recComEstoqueRes.data.retornouAoEstoque === true, `5.3 Registrado retorno ao estoque: true`);
    assert(recComEstoqueRes.data.codigoCupom != null, `5.4 Cupom de troca gerado: ${recComEstoqueRes.data.codigoCupom}`);
    assert(Number(recComEstoqueRes.data.valorCupom) === Number(item1.precoUnitario), `5.5 Valor do cupom gerado (R$ ${recComEstoqueRes.data.valorCupom}) corresponde exatamente ao item devolvido (R$ ${item1.precoUnitario})`);

    // 5.3 Verificar incremento REAL do estoque no PostgreSQL (RF0054)
    const estVar1Depois = (await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [var1.variacao_id])).rows[0].quantidade;
    console.log(`  -> Estoque após recebimento com reentrada: ${estVar1Depois} (Anterior: ${estVar1Antes})`);
    assert(estVar1Depois === estVar1Antes + 1, `5.6 Quantidade em estoque incrementada exatamente em 1 unidade (RF0054)`);

    // 5.4 Impedir recebimento duplicado
    const recDupRes = await request(`/api/trocas/${codTrocaParcial}/recebimento`, {
      method: 'POST',
      body: JSON.stringify({ retornarAoEstoque: true, usuarioResponsavel: 'Admin Repetido' })
    });
    assert(recDupRes.status === 400, `5.7 Impedida confirmação de recebimento duplicada: status=${recDupRes.status}`);

    // 5.5 Verificar cupom persistido no banco e vinculado ao cliente
    const cupomDb = await pgClient.query(`SELECT * FROM "CUPOM" WHERE codigo = $1`, [recComEstoqueRes.data.codigoCupom]);
    assert(cupomDb.rows.length === 1, `5.8 Cupom persistido na tabela CUPOM`);
    assert(cupomDb.rows[0].tipo === 'TROCA', `5.9 Tipo do cupom é TROCA`);
    assert(Number(cupomDb.rows[0].valor) === Number(item1.precoUnitario), `5.10 Valor do cupom persistido confere com o valor da troca`);

    // 5.6 Verificar log de auditoria no PostgreSQL
    const auditTrocaConcl = await pgClient.query(
      `SELECT operacao FROM "LOG_AUDITORIA" WHERE entidade = 'TROCA' AND registro_id = $1 AND operacao = 'RECEBIMENTO_TROCA'`,
      [codTrocaParcial]
    );
    assert(auditTrocaConcl.rows.length > 0, `5.11 Auditoria RNF0012 registrada para RECEBIMENTO_TROCA`);

    console.log('\n--- SEÇÃO 6: Troca Total (RN0041 / RN0042) e Recebimento SEM Retorno ao Estoque ---');

    // 6.1 Criar outro pedido com 1 item para testar Troca Total direta
    const pedidoTotalReq = await criarPedidoHelper(pgClient, codCliente, [{ produtoVariacaoId: var2.variacao_id, quantidade: 1 }]);
    const codPedidoTotal = pedidoTotalReq.data.codigo;
    await request(`/api/pedidos/${codPedidoTotal}/processar-pagamento`, { method: 'POST' });
    await request(`/api/pedidos/${codPedidoTotal}/status`, { method: 'PATCH', body: JSON.stringify({ novoStatus: 'EM TRANSPORTE' }) });
    await request(`/api/pedidos/${codPedidoTotal}/status`, { method: 'PATCH', body: JSON.stringify({ novoStatus: 'ENTREGUE' }) });

    const itemTotalPedido = pedidoTotalReq.data.itens[0];

    // 6.2 Solicitar troca total
    const trocaTotalRes = await request('/api/trocas', {
      method: 'POST',
      body: JSON.stringify({
        codigoCliente: codCliente,
        codigoPedido: codPedidoTotal,
        motivo: 'Defeito de fábrica na sola',
        itens: [{ itemPedidoId: itemTotalPedido.id, quantidade: 1 }]
      })
    });
    assert(trocaTotalRes.status === 201, `6.1 Troca total criada com sucesso: ${trocaTotalRes.data?.codigo}`);
    const codTrocaTotal = trocaTotalRes.data.codigo;
    assert(trocaTotalRes.data.tipo === 'TOTAL', `6.2 Tipo da troca registrado como TOTAL`);
    assert(trocaTotalRes.data.status === 'EM TROCA', `6.3 Status da troca é EM TROCA`);

    // 6.3 RN0041: Pedido principal também passa a EM TROCA na troca total!
    const pedTotalEmTroca = await request(`/api/pedidos/${codPedidoTotal}`);
    assert(pedTotalEmTroca.data.status === 'EM TROCA', `6.4 Pedido principal passou para EM TROCA conforme RN0041: status=${pedTotalEmTroca.data.status}`);

    // 6.4 Autorizar troca total
    const autTotalRes = await request(`/api/trocas/${codTrocaTotal}/autorizar`, {
      method: 'POST',
      body: JSON.stringify({ autorizado: true, usuarioResponsavel: 'Admin Garantia' })
    });
    assert(autTotalRes.data.status === 'TROCA AUTORIZADA', `6.5 Troca total autorizada: status=${autTotalRes.data.status}`);

    const pedTotalAutorizado = await request(`/api/pedidos/${codPedidoTotal}`);
    assert(pedTotalAutorizado.data.status === 'TROCA AUTORIZADA', `6.6 Pedido principal em TROCA AUTORIZADA`);

    // 6.5 Confirmar recebimento com retornarAoEstoque: false (produto avariado/descartado)
    const estVar2Antes = (await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [var2.variacao_id])).rows[0].quantidade;

    const recSemEstoqueRes = await request(`/api/trocas/${codTrocaTotal}/recebimento`, {
      method: 'POST',
      body: JSON.stringify({
        retornarAoEstoque: false,
        usuarioResponsavel: 'Admin Qualidade',
        observacoes: 'Produto danificado não retorna ao estoque comercializável'
      })
    });
    assert(recSemEstoqueRes.status === 200, `6.7 Recebimento sem retorno confirmado com sucesso`);
    assert(recSemEstoqueRes.data.status === 'TROCADO', `6.8 Status da troca é TROCADO (RN0042)`);
    assert(recSemEstoqueRes.data.retornouAoEstoque === false, `6.9 Registrado retorno ao estoque: false`);

    // 6.6 Verificar que estoque NÃO foi incrementado
    const estVar2Depois = (await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [var2.variacao_id])).rows[0].quantidade;
    assert(estVar2Depois === estVar2Antes, `6.10 Estoque permaneceu INALTERADO (RF0054): Antes=${estVar2Antes}, Depois=${estVar2Depois}`);

    // 6.7 RN0042: Pedido principal da troca total passou para TROCADO!
    const pedTotalConcluido = await request(`/api/pedidos/${codPedidoTotal}`);
    assert(pedTotalConcluido.data.status === 'TROCADO', `6.11 Pedido principal passou para TROCADO conforme RN0042: status=${pedTotalConcluido.data.status}`);

    console.log('\n--- SEÇÃO 7: Reutilização do Cupom de Troca em Nova Compra ---');

    // 7.1 Obter código do cupom gerado na troca total
    const cupomTrocaGerado = recSemEstoqueRes.data.codigoCupom;
    const valorCupomTroca = recSemEstoqueRes.data.valorCupom;
    console.log(`  -> Cupom gerado na troca total: ${cupomTrocaGerado} no valor de R$ ${valorCupomTroca}`);

    // 7.2 Reutilizar cupom de troca no checkout de um novo pedido
    const novaCompraRes = await criarPedidoHelper(pgClient, codCliente, [{ produtoVariacaoId: var1.variacao_id, quantidade: 1 }], [cupomTrocaGerado]);
    assert(novaCompraRes.status === 201, `7.1 Novo pedido finalizado com sucesso utilizando o cupom de troca gerado: ${novaCompraRes.data?.codigo}`);

    // 7.3 Verificar se o cupom foi associado ao pagamento do novo pedido
    const pgtoCupom = novaCompraRes.data.pagamentos.find(p => p.formaPagamento === 'CUPOM_TROCA');
    assert(pgtoCupom != null, `7.2 Cupom de troca registrado nos pagamentos do novo pedido: R$ ${pgtoCupom?.valor}`);

    // 7.4 Tentar reutilizar o mesmo cupom de troca novamente (deve ser rejeitado - RN0036)
    const compraCupomReuso = await criarPedidoHelper(pgClient, codCliente, [{ produtoVariacaoId: var1.variacao_id, quantidade: 1 }], [cupomTrocaGerado]);
    assert(compraCupomReuso.status === 400, `7.3 Rejeitado reuso concorrente do mesmo cupom de troca já utilizado (RN0036): status=${compraCupomReuso.status}`);

    console.log('\n--- SEÇÃO 8: Consultas de Trocas (RF0043) ---');

    // 8.1 Consultar trocas do cliente
    const trocasCliRes = await request(`/api/trocas/cliente/${codCliente}`);
    assert(trocasCliRes.status === 200, `8.1 Consulta de trocas do cliente responde 200`);
    assert(trocasCliRes.data.length >= 2, `8.2 Retornou ${trocasCliRes.data.length} trocas registradas para o cliente`);

    // 8.2 Consultar trocas no painel administrativo
    const trocasAdminRes = await request('/api/trocas/admin');
    assert(trocasAdminRes.status === 200, `8.3 Consulta administrativa de trocas responde 200`);
    assert(trocasAdminRes.data.length >= 2, `8.4 Retornou ${trocasAdminRes.data.length} trocas no painel admin`);

    // 8.3 Filtrar trocas por status no admin
    const trocasFiltradasRes = await request('/api/trocas/admin?status=TROCADO');
    assert(trocasFiltradasRes.status === 200, `8.5 Filtro de trocas por status TROCADO responde 200`);
    assert(trocasFiltradasRes.data.every(t => t.status === 'TROCADO'), `8.6 Todas as trocas filtradas possuem status TROCADO`);

  } finally {
    await pgClient.end();
  }

  console.log('\n================================================================');
  console.log(` RESULTADO FINAL: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
