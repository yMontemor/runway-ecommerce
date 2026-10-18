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

async function testCouponApplication() {
  console.log('=== TESTE DE REUTILIZAÇÃO DO CUPOM DE TROCA GERADO (RN0034) ===\n');

  const cupomCodigo = 'TROCA-TR-2026-0009';

  console.log(`1. Consultando validade do cupom ${cupomCodigo}...`);
  const resConsulta = await request('/api/cupons/consultar', {
    method: 'POST',
    body: { codigoCupom: cupomCodigo, codigoCliente: 'CLI-0001' }
  });
  console.log('Consulta status:', resConsulta.status, resConsulta.data);
  if (resConsulta.status !== 200) throw new Error('Cupom deveria ser válido para consulta');

  console.log('\n2. Criando novo pedido utilizando o cupom de troca...');
  const resProdutos = await request('/api/produtos');
  const variacao = resProdutos.data[0].variacoes.find(v => v.quantidadeEstoque >= 1);
  const precoUnit = resProdutos.data[0].preco; // 449.90
  const frete = 20.00; // Frete exato de SP calculado pela API
  const saldoRestanteCartao = frete; // Cupom abate os 449.90 do produto, restando frete no cartão

  const payloadNovoPedido = {
    codigoCliente: 'CLI-0001',
    enderecoId: 556,
    itens: [{ produtoVariacaoId: variacao.id, quantidade: 1 }],
    cupons: [cupomCodigo],
    cartoes: [{ cartaoId: 67, valor: saldoRestanteCartao }]
  };

  const resNovoPedido = await request('/api/pedidos', {
    method: 'POST',
    body: payloadNovoPedido
  });
  console.log(`Status criação novo pedido: ${resNovoPedido.status}`);
  if (resNovoPedido.status !== 201) {
    console.error('Erro na criação com cupom:', resNovoPedido.data);
    throw new Error('Falha ao criar pedido com cupom');
  }
  console.log(`Novo pedido criado: ${resNovoPedido.data.codigo}, Pagamentos:`, resNovoPedido.data.pagamentos.map(p => ({ forma: p.formaPagamento, valor: p.valor, cupom: p.cupomCodigo })));

  console.log('\n3. Tentando reutilizar o mesmo cupom em outra compra (esperado erro: cupom já utilizado)...');
  const resReuso = await request('/api/pedidos', {
    method: 'POST',
    body: payloadNovoPedido
  });
  console.log(`Status de reuso: ${resReuso.status} (esperado 400 Bad Request)`);
  console.log('Mensagem de bloqueio:', resReuso.data);
  if (resReuso.status !== 400) throw new Error('Backend não barrou reutilização de cupom de troca já utilizado');

  console.log('\n=== TESTE DE APLICAÇÃO E CONSUMO DE CUPOM DE TROCA APROVADO! ===');
}

testCouponApplication().catch(err => {
  console.error('\n❌ ERRO NO TESTE DE CUPOM:', err);
  process.exit(1);
});
