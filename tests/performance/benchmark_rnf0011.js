const http = require('http');

async function measureRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          dataLength: body.length
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runBenchmark() {
  console.log('=== VALIDAÇÃO FORMAL DE DESEMPENHO (RNF0011: RESPOSTA < 1 SEGUNDO) ===\n');

  const operations = [
    {
      name: 'Listagem de Produtos',
      endpoint: 'GET /api/produtos',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/produtos',
        method: 'GET'
      }
    },
    {
      name: 'Consulta de Endereços do Cliente',
      endpoint: 'GET /api/clientes/CLI-0001/enderecos',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/clientes/CLI-0001/enderecos',
        method: 'GET'
      }
    },
    {
      name: 'Consulta de Cartões do Cliente',
      endpoint: 'GET /api/clientes/CLI-0001/cartoes',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/clientes/CLI-0001/cartoes',
        method: 'GET'
      }
    },
    {
      name: 'Listagem de Cupons de Troca do Cliente',
      endpoint: 'GET /api/cupons/troca/CLI-0001',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/cupons/troca/CLI-0001',
        method: 'GET'
      }
    },
    {
      name: 'Validação de Estoque',
      endpoint: 'POST /api/produtos/validar-estoque',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/produtos/validar-estoque',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      body: { itens: [{ produtoVariacaoId: 4, quantidade: 1 }] }
    },
    {
      name: 'Cálculo de Frete',
      endpoint: 'POST /api/frete/calcular',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/frete/calcular',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      body: { codigoCliente: 'CLI-0001', enderecoId: 1, itens: [{ produtoVariacaoId: 4, quantidade: 2 }] }
    },
    {
      name: 'Validação de Pagamento',
      endpoint: 'POST /api/pagamento/validar',
      options: {
        hostname: 'localhost',
        port: 5035,
        path: '/api/pagamento/validar',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      body: {
        codigoCliente: 'CLI-0001',
        itens: [{ produtoVariacaoId: 4, quantidade: 1 }],
        enderecoId: 1,
        cartoes: [{ cartaoId: 3, valor: 469.90 }]
      }
    }
  ];

  const results = [];

  for (const op of operations) {
    const samples = [];
    let lastStatus = 0;
    // Realiza 3 amostras
    for (let i = 0; i < 3; i++) {
      try {
        const res = await measureRequest(op.options, op.body);
        samples.push(res.durationMs);
        lastStatus = res.statusCode;
      } catch (err) {
        samples.push(NaN);
      }
    }
    const avg = Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2));
    const max = Math.max(...samples);
    const belowLimit = avg < 1000.0 && max < 1000.0;

    results.push({
      Operacao: op.name,
      Endpoint: op.endpoint,
      Status: lastStatus,
      'Amostras (ms)': samples.join(', '),
      'Média (ms)': avg,
      'Abaixo de 1s?': belowLimit ? 'SIM (CONFORME)' : 'NÃO'
    });
  }

  console.table(results);
}

runBenchmark();
