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

async function testCumulativeToFullExchange() {
  console.log('=== TESTE DE TROCA CUMULATIVA ATÉ CONCLUSÃO TOTAL (RN0042) ===\n');

  const codigoPedido = 'RW-2026-0143';

  console.log(`1. Consultando elegibilidade residual do pedido ${codigoPedido}...`);
  const resElig = await request(`/api/trocas/elegibilidade/${codigoPedido}`);
  console.log('Elegibilidade:', resElig.data.itens);

  const itemResidual = resElig.data.itens[0];
  console.log(`Comprada: ${itemResidual.quantidadeComprada}, Já em troca: ${itemResidual.quantidadeJaEmTroca}, Elegível: ${itemResidual.quantidadeElegivel}`);
  if (itemResidual.quantidadeElegivel !== 1) throw new Error(`Esperava 1 unidade elegível, obteve ${itemResidual.quantidadeElegivel}`);

  console.log('\n2. Solicitando troca da última unidade restante...');
  const resTroca2 = await request('/api/trocas', {
    method: 'POST',
    body: {
      codigoCliente: 'CLI-0001',
      codigoPedido: codigoPedido,
      motivo: 'Segunda unidade também precisa ser trocada',
      itens: [{ itemPedidoId: itemResidual.itemPedidoId, quantidade: 1 }]
    }
  });
  console.log(`Troca 2 criada: ${resTroca2.data.codigo}, Tipo: ${resTroca2.data.tipo}, Status: ${resTroca2.data.status}`);
  // Como agora 100% das unidades estão em troca, tipo é TOTAL e pedido pai passa para EM TROCA!
  const resPaiEmTroca = await request(`/api/pedidos/${codigoPedido}`);
  console.log(`Status do pedido pai agora com 100% em troca: ${resPaiEmTroca.data.status}`);
  if (resPaiEmTroca.data.status !== 'EM TROCA') throw new Error(`Pedido pai deveria estar EM TROCA com 100% em troca, veio: ${resPaiEmTroca.data.status}`);

  console.log('\n3. Autorizando segunda troca...');
  await request(`/api/trocas/${resTroca2.data.codigo}/autorizar`, {
    method: 'POST',
    body: { autorizado: true, usuarioResponsavel: 'Admin' }
  });

  console.log('\n4. Confirmando recebimento da segunda troca...');
  const resRec2 = await request(`/api/trocas/${resTroca2.data.codigo}/recebimento`, {
    method: 'POST',
    body: { retornarAoEstoque: true, usuarioResponsavel: 'Admin' }
  });
  console.log(`Segunda troca concluída: ${resRec2.data.status}, Cupom: ${resRec2.data.codigoCupom}`);

  console.log('\n5. Verificando status final do pedido pai após todas as unidades concluídas...');
  const resPaiFinal = await request(`/api/pedidos/${codigoPedido}`);
  console.log(`Status FINAL do pedido pai: ${resPaiFinal.data.status}`);
  if (resPaiFinal.data.status !== 'TROCADO') throw new Error(`Pedido pai deveria estar TROCADO, veio: ${resPaiFinal.data.status}`);

  console.log('\n=== TESTE CUMULATIVO RN0042 APROVADO COM PERFEIÇÃO! ===');
}

testCumulativeToFullExchange().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
