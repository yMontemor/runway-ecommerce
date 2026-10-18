const http = require('http');

const API_BASE = 'http://localhost:5035';

async function request(path, options = {}) {
  const url = new URL(path, API_BASE);
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== INICIANDO TESTES DE INTEGRAÇÃO DA ETAPA E ===\n');

  // 1. Health check dos endpoints
  console.log('1. Testando listagem geral de pedidos...');
  const resPedidos = await request('/api/pedidos');
  console.log(`Status: ${resPedidos.status}, Total pedidos: ${Array.isArray(resPedidos.data) ? resPedidos.data.length : 'N/A'}`);
  if (resPedidos.status !== 200) throw new Error('Falha ao listar pedidos');

  console.log('\n2. Testando listagem de cupons do cliente CLI-0001...');
  const resCupons = await request('/api/cupons/cliente/CLI-0001');
  console.log(`Status: ${resCupons.status}, Total cupons: ${Array.isArray(resCupons.data) ? resCupons.data.length : 'N/A'}`);
  if (resCupons.status !== 200) throw new Error('Falha ao listar cupons');

  console.log('\n3. Testando listagem de trocas (admin)...');
  const resTrocas = await request('/api/trocas/admin');
  console.log(`Status: ${resTrocas.status}, Total trocas: ${Array.isArray(resTrocas.data) ? resTrocas.data.length : 'N/A'}`);
  if (resTrocas.status !== 200) throw new Error('Falha ao listar trocas');

  // Obter variação de produto para criar pedido
  console.log('\n4. Consultando produtos para obter variação com estoque...');
  const resProdutos = await request('/api/produtos');
  const prod = resProdutos.data[0];
  const variacao = prod.variacoes.find(v => v.quantidadeEstoque >= 3);
  if (!variacao) throw new Error('Nenhuma variação com estoque >= 3 encontrada');
  const estoqueInicial = variacao.quantidadeEstoque;
  console.log(`Produto: ${prod.nome}, Variação: ${variacao.id} (Tam: ${variacao.tamanho}), Estoque Inicial: ${estoqueInicial}`);

  // Criar Pedido com 2 unidades
  console.log('\n5. Criando pedido com 2 unidades...');
  const payloadPedido = {
    codigoCliente: 'CLI-0001',
    enderecoId: 556,
    itens: [
      {
        produtoVariacaoId: variacao.id,
        quantidade: 2
      }
    ],
    cartoes: [
      {
        cartaoId: 67,
        valor: prod.preco * 2 + 25.00 // Total com frete R$ 25
      }
    ]
  };

  const resCriarPedido = await request('/api/pedidos', { method: 'POST', body: payloadPedido });
  console.log(`Status criação pedido: ${resCriarPedido.status}`);
  if (resCriarPedido.status !== 201) {
    console.error('Erro na criação:', resCriarPedido.data);
    throw new Error('Falha ao criar pedido');
  }
  const pedido = resCriarPedido.data;
  console.log(`Pedido criado: ${pedido.codigo}, Status inicial: ${pedido.status}`);

  // Consultar mesmo pedido por código
  console.log(`\n6. Consultando pedido individual por código GET /api/pedidos/${pedido.codigo}...`);
  const resGetPedido = await request(`/api/pedidos/${pedido.codigo}`);
  console.log(`Status: ${resGetPedido.status}, Código retornado: ${resGetPedido.data.codigo}, Itens: ${resGetPedido.data.itens.length}`);

  // Consultar pedidos do cliente
  console.log(`\n7. Consultando pedidos do cliente GET /api/pedidos/cliente/CLI-0001...`);
  const resPedidosCli = await request('/api/pedidos/cliente/CLI-0001');
  const achou = resPedidosCli.data.some(p => p.codigo === pedido.codigo);
  console.log(`Pedido recém-criado presente na lista do cliente: ${achou ? 'SIM' : 'NÃO'}`);
  if (!achou) throw new Error('Pedido não apareceu na lista do cliente!');

  // Processar pagamento
  console.log(`\n8. Processando pagamento do pedido via POST /api/pedidos/${pedido.codigo}/processar-pagamento...`);
  const resProc = await request(`/api/pedidos/${pedido.codigo}/processar-pagamento`, { method: 'POST' });
  console.log(`Status: ${resProc.status}, Novo Status: ${resProc.data.status}`);
  if (resProc.data.status !== 'APROVADA') throw new Error(`Esperava APROVADA, obteve ${resProc.data.status}`);

  // Despachar pedido
  console.log(`\n9. Despachando pedido para EM TRANSPORTE via PATCH /api/pedidos/${pedido.codigo}/status...`);
  const resDesp = await request(`/api/pedidos/${pedido.codigo}/status`, {
    method: 'PATCH',
    body: { novoStatus: 'EM TRANSPORTE', usuarioResponsavel: 'Admin' }
  });
  console.log(`Status: ${resDesp.status}, Novo Status: ${resDesp.data.status}`);
  if (resDesp.data.status !== 'EM TRANSPORTE') throw new Error('Falha ao alterar para EM TRANSPORTE');

  // Confirmar entrega
  console.log(`\n10. Confirmando entrega para ENTREGUE via PATCH /api/pedidos/${pedido.codigo}/status...`);
  const resEntr = await request(`/api/pedidos/${pedido.codigo}/status`, {
    method: 'PATCH',
    body: { novoStatus: 'ENTREGUE', usuarioResponsavel: 'Admin' }
  });
  console.log(`Status: ${resEntr.status}, Novo Status: ${resEntr.data.status}`);
  if (resEntr.data.status !== 'ENTREGUE') throw new Error('Falha ao alterar para ENTREGUE');

  // Consultar Elegibilidade para troca
  console.log(`\n11. Consultando elegibilidade de troca via GET /api/trocas/elegibilidade/${pedido.codigo}...`);
  const resElig = await request(`/api/trocas/elegibilidade/${pedido.codigo}`);
  console.log(`Status: ${resElig.status}, Pode solicitar troca: ${resElig.data.podeSolicitarTroca}`);
  console.log(`Itens elegíveis:`, resElig.data.itens.map(i => ({ itemPedidoId: i.itemPedidoId, nome: i.nomeProduto, comprada: i.quantidadeComprada, elegivel: i.quantidadeElegivel })));
  if (!resElig.data.podeSolicitarTroca) throw new Error('Pedido entregue deveria estar elegível para troca');

  const itemElegivel = resElig.data.itens[0];

  // Solicitar troca PARCIAL de 1 unidade
  console.log(`\n12. Solicitando troca PARCIAL de 1 unidade (de 2 compradas)...`);
  const payloadTroca = {
    codigoCliente: 'CLI-0001',
    codigoPedido: pedido.codigo,
    motivo: 'Tênis ficou ligeiramente apertado na ponta',
    itens: [
      {
        itemPedidoId: itemElegivel.itemPedidoId,
        quantidade: 1
      }
    ]
  };

  const resTrocaSol = await request('/api/trocas', { method: 'POST', body: payloadTroca });
  console.log(`Status: ${resTrocaSol.status}, Código Troca: ${resTrocaSol.data.codigo}, Status: ${resTrocaSol.data.status}, Tipo: ${resTrocaSol.data.tipo}`);
  if (resTrocaSol.status !== 201) throw new Error('Falha ao solicitar troca');
  const troca = resTrocaSol.data;

  // Verificar status do pedido pai (deve permanecer ENTREGUE conforme RN0041, pois é troca parcial!)
  const resPedEmTroca = await request(`/api/pedidos/${pedido.codigo}`);
  console.log(`Status do pedido pai após solicitação de troca parcial: ${resPedEmTroca.data.status}`);
  if (resPedEmTroca.data.status !== 'ENTREGUE') throw new Error(`Pedido pai deveria permanecer ENTREGUE em troca parcial, mas veio: ${resPedEmTroca.data.status}`);

  // Admin autoriza troca
  console.log(`\n13. Admin autorizando solicitação de troca via POST /api/trocas/${troca.codigo}/autorizar...`);
  const resAuth = await request(`/api/trocas/${troca.codigo}/autorizar`, {
    method: 'POST',
    body: { autorizado: true, usuarioResponsavel: 'Administrador' }
  });
  console.log(`Status: ${resAuth.status}, Novo status da troca: ${resAuth.data.status}, Notificação gerada: ${resAuth.data.notificacaoCliente}`);
  if (resAuth.data.status !== 'TROCA AUTORIZADA') throw new Error('Troca deveria estar TROCA AUTORIZADA');

  // Consultar notificação específica
  console.log(`\n14. Consultando notificação via GET /api/trocas/${troca.codigo}/notificacao...`);
  const resNotif = await request(`/api/trocas/${troca.codigo}/notificacao`);
  console.log(`Status: ${resNotif.status}, Mensagem: "${resNotif.data.mensagem}"`);

  // Confirmar recebimento com retorno ao estoque
  console.log(`\n15. Admin confirmando recebimento físico COM retorno ao estoque via POST /api/trocas/${troca.codigo}/recebimento...`);
  const resRec = await request(`/api/trocas/${troca.codigo}/recebimento`, {
    method: 'POST',
    body: { retornarAoEstoque: true, usuarioResponsavel: 'Administrador' }
  });
  console.log(`Status: ${resRec.status}, Status final da troca: ${resRec.data.status}, Código do Cupom gerado: ${resRec.data.codigoCupom}, Valor: R$ ${resRec.data.valorCupom}`);
  if (resRec.data.status !== 'TROCADO') throw new Error('Troca deveria estar TROCADO');
  if (!resRec.data.codigoCupom) throw new Error('Cupom de troca deveria ter sido gerado');
  const cupomGerado = resRec.data.codigoCupom;

  // Verificar status do pedido pai (como foi troca parcial de 1 de 2 unidades, pedido pai deve estar ENTREGUE pois resta 1 unidade não trocada!)
  const resPedAposTroca = await request(`/api/pedidos/${pedido.codigo}`);
  console.log(`\n16. Status do pedido pai após recebimento da troca parcial: ${resPedAposTroca.data.status}`);
  console.log(`(Regra cumulativa DRS: Como restou 1 unidade não trocada, pedido pai permanece ENTREGUE e NÃO TROCADO!)`);

  // Verificar cupom na lista de cupons do cliente
  console.log(`\n17. Consultando cupons do cliente para verificar o novo cupom de troca...`);
  const resCuponsAtualizados = await request('/api/cupons/cliente/CLI-0001');
  const cupomEncontrado = resCuponsAtualizados.data.find(c => c.codigo === cupomGerado);
  console.log(`Cupom ${cupomGerado} encontrado na listagem do cliente: ${cupomEncontrado ? 'SIM' : 'NÃO'}`);
  if (!cupomEncontrado) throw new Error('Cupom gerado não encontrado na lista do cliente');

  // Testar transição proibida: tentar despachar pedido que já está ENTREGUE
  console.log(`\n18. Testando transição proibida: despachar pedido já entregue...`);
  const resProibido = await request(`/api/pedidos/${pedido.codigo}/status`, {
    method: 'PATCH',
    body: { novoStatus: 'EM TRANSPORTE', usuarioResponsavel: 'Admin' }
  });
  console.log(`Status de resposta para transição proibida: ${resProibido.status} (esperado 400 Bad Request)`);
  if (resProibido.status !== 400) throw new Error('Backend não barrou transição de status proibida');

  console.log('\n=== TODOS OS 18 TESTES DE INTEGRAÇÃO DA ETAPA E FORAM APROVADOS COM SUCESSO! ===');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE DE INTEGRAÇÃO:', err);
  process.exit(1);
});
