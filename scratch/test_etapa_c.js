const http = require('http');
const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'runway',
  user: 'postgres',
  password: '123'
};

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5035,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  const pgClient = new Client(dbConfig);
  await pgClient.connect();
  console.log('--- INICIANDO BATERIA DE VALIDAÇÕES DA ETAPA C ---');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc} -> ${detail}`);
      failed++;
    }
  }

  try {
    // 0. Limpar carrinhos de teste existentes
    await request('DELETE', '/api/carrinho/CLI-0001');
    await request('DELETE', '/api/carrinho/CLI-0002');

    // =========================================================================
    // TESTE 1: Validar constraint chk_estoque_quantidade_nao_negativa no PostgreSQL
    // =========================================================================
    const resConstraint = await pgClient.query(`
      SELECT conname FROM pg_constraint WHERE conname = 'chk_estoque_quantidade_nao_negativa';
    `);
    assert('Constraint chk_estoque_quantidade_nao_negativa existe no PostgreSQL', resConstraint.rows.length > 0);

    // =========================================================================
    // TESTE 2: Adicionar produto e confirmar persistência real no PostgreSQL (RF0031 / RF0032)
    // =========================================================================
    // Obter uma variação existente
    const resVar = await pgClient.query(`
      SELECT pv.id, pv.produto_id, pv.tamanho, e.quantidade
      FROM "PRODUTO_VARIACAO" pv
      JOIN "ESTOQUE" e ON e.produto_variacao_id = pv.id
      WHERE pv.ativo = true AND e.quantidade >= 5
      ORDER BY pv.id ASC
      LIMIT 1;
    `);
    const varTeste1 = resVar.rows[0];
    const variacaoId1 = varTeste1.id;

    const resAdd = await request('POST', '/api/carrinho/CLI-0001/itens', {
      produtoVariacaoId: variacaoId1,
      quantidade: 1
    });

    assert('Adicionar item ao carrinho retorna 200 OK', resAdd.status === 200);
    assert('Item retornado no response com quantidade 1', resAdd.body?.itens?.some(i => i.produtoVariacaoId === variacaoId1 && i.quantidade === 1));
    assert('Prazo de expiração retornado (~20 minutos)', resAdd.body?.tempoRestanteSegundos >= 1150 && resAdd.body?.tempoRestanteSegundos <= 1200);

    // Confirmar persistência direta no PostgreSQL
    const resPgCart = await pgClient.query(`
      SELECT c.id, c.cliente_id, c.dt_expiracao, ic.produto_variacao_id, ic.quantidade
      FROM "CARRINHO" c
      JOIN "CLIENTE" cl ON cl.id = c.cliente_id
      JOIN "ITEM_CARRINHO" ic ON ic.carrinho_id = c.id
      WHERE cl.codigo = 'CLI-0001';
    `);
    assert('Registro persistido no banco na tabela CARRINHO e ITEM_CARRINHO', resPgCart.rows.length === 1 && resPgCart.rows[0].quantidade === 1);

    // =========================================================================
    // TESTE 3: Recarregar a página e confirmar que o carrinho permanece
    // =========================================================================
    const resGetCart = await request('GET', '/api/carrinho/CLI-0001');
    assert('Consultar carrinho do cliente ativo retorna 200 OK', resGetCart.status === 200);
    assert('Carrinho preserva itens após recarga', resGetCart.body?.itens?.length === 1 && resGetCart.body.itens[0].produtoVariacaoId === variacaoId1);

    // =========================================================================
    // TESTE 4: Alterar quantidade e validar atualização de reserva (RN0044)
    // =========================================================================
    const resUpdateQty = await request('PUT', `/api/carrinho/CLI-0001/itens/${variacaoId1}`, {
      quantidade: 2
    });
    assert('Alterar quantidade retorna 200 OK', resUpdateQty.status === 200);
    assert('Quantidade atualizada para 2 no carrinho', resUpdateQty.body?.itens?.[0]?.quantidade === 2);
    assert('Rolling window reiniciou contagem de 20 minutos', resUpdateQty.body?.tempoRestanteSegundos >= 1150);

    // =========================================================================
    // TESTE 5: Remover item e validar liberação imediata de reserva
    // =========================================================================
    const resRemove = await request('DELETE', `/api/carrinho/CLI-0001/itens/${variacaoId1}`);
    assert('Remover item retorna 200 OK', resRemove.status === 200);
    assert('Carrinho ficou vazio após remoção', resRemove.body?.itens?.length === 0);

    // =========================================================================
    // TESTE 6: Concorrência - Dois clientes tentando reservar a última unidade
    // =========================================================================
    // Ajustar temporariamente estoque de uma variação para exatamente 1 unidade
    const resVarEscassa = await pgClient.query(`
      SELECT pv.id
      FROM "PRODUTO_VARIACAO" pv
      JOIN "ESTOQUE" e ON e.produto_variacao_id = pv.id
      WHERE pv.ativo = true
      ORDER BY pv.id DESC
      LIMIT 1;
    `);
    const varEscassaId = resVarEscassa.rows[0].id;
    await pgClient.query(`UPDATE "ESTOQUE" SET quantidade = 1 WHERE produto_variacao_id = $1`, [varEscassaId]);

    // Cliente 1 adiciona a única unidade disponível
    const resCli1Add = await request('POST', '/api/carrinho/CLI-0001/itens', {
      produtoVariacaoId: varEscassaId,
      quantidade: 1
    });
    assert('Cliente 1 reserva com sucesso a última unidade disponível', resCli1Add.status === 200);

    // Cliente 2 tenta reservar a mesma unidade
    const resCli2Add = await request('POST', '/api/carrinho/CLI-0002/itens', {
      produtoVariacaoId: varEscassaId,
      quantidade: 1
    });
    assert('Cliente 2 é bloqueado ao tentar reservar unidade já reservada (400 Bad Request)', resCli2Add.status === 400);

    // Limpar reserva do Cliente 1 para restaurar
    await request('DELETE', '/api/carrinho/CLI-0001');

    // =========================================================================
    // TESTE 7: Expiração de carrinho sem depender da página aberta e RNF0042
    // =========================================================================
    // Cliente 1 adiciona item escasso novamente
    await request('POST', '/api/carrinho/CLI-0001/itens', {
      produtoVariacaoId: varEscassaId,
      quantidade: 1
    });

    // Simula passagem de 25 minutos no PostgreSQL diretamente no banco (criado há 25min, expirado há 5min)
    await pgClient.query(`
      UPDATE "CARRINHO" c
      SET dt_criacao = NOW() - INTERVAL '25 minutes',
          dt_atualizacao = NOW() - INTERVAL '25 minutes',
          dt_expiracao = NOW() - INTERVAL '5 minutes'
      FROM "CLIENTE" cl
      WHERE c.cliente_id = cl.id AND cl.codigo = 'CLI-0001';
    `);

    // Agora, mesmo sem o Cliente 1 ter aberto o navegador, a disponibilidade já deve estar liberada para Cliente 2!
    const resCli2AddAposExpiracao = await request('POST', '/api/carrinho/CLI-0002/itens', {
      produtoVariacaoId: varEscassaId,
      quantidade: 1
    });
    assert('Estoque é liberado automaticamente após expiração sem depender de navegador aberto', resCli2AddAposExpiracao.status === 200);

    // Quando Cliente 1 abre seu carrinho, o backend identifica expiração e informa itens removidos (RNF0042)
    const resCli1AposExp = await request('GET', '/api/carrinho/CLI-0001');
    assert('Cliente 1 recebe aviso de carrinho expirado', resCli1AposExp.body?.expirado === true);
    assert('Cliente 1 visualiza lista de itens expirados', resCli1AposExp.body?.itensExpirados?.length > 0);
    assert('Itens expirados não estão mais no carrinho ativo', resCli1AposExp.body?.itens?.length === 0);

    // Limpar carrinhos
    await request('DELETE', '/api/carrinho/CLI-0001');
    await request('DELETE', '/api/carrinho/CLI-0002');
    // Restaurar estoque de varEscassaId
    await pgClient.query(`UPDATE "ESTOQUE" SET quantidade = 10 WHERE produto_variacao_id = $1`, [varEscassaId]);

    // =========================================================================
    // TESTE 8: Alerta de expiração iminente 5 minutos antes (RN0044)
    // =========================================================================
    await request('POST', '/api/carrinho/CLI-0001/itens', {
      produtoVariacaoId: variacaoId1,
      quantidade: 1
    });

    // Ajusta expiração para faltar exatamente 4 minutos (240 segundos)
    await pgClient.query(`
      UPDATE "CARRINHO" c
      SET dt_expiracao = NOW() + INTERVAL '4 minutes'
      FROM "CLIENTE" cl
      WHERE c.cliente_id = cl.id AND cl.codigo = 'CLI-0001';
    `);

    const resAlerta = await request('GET', '/api/carrinho/CLI-0001');
    assert('Alerta de expiração é ativado 5 minutos antes (alertaExpirando = true)', resAlerta.body?.alertaExpirando === true);
    assert('Tempo restante coerente (< 300 segundos)', resAlerta.body?.tempoRestanteSegundos <= 250);

    // =========================================================================
    // TESTE 9: Transferência de reserva do carrinho para Pedido EM PROCESSAMENTO
    // =========================================================================
    // Obter estoque antes do pedido
    const resEstoqueAntes = await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [variacaoId1]);
    const estoqueFisicoInicial = resEstoqueAntes.rows[0].quantidade;

    // Obter endereco e cartao de CLI-0001
    const resCliInfo = await pgClient.query(`
      SELECT e.id as endereco_id, ca.id as cartao_id
      FROM "CLIENTE" cl
      JOIN "ENDERECO" e ON e.cliente_id = cl.id
      JOIN "CARTAO" ca ON ca.cliente_id = cl.id
      WHERE cl.codigo = 'CLI-0001'
      LIMIT 1;
    `);
    const enderecoIdCli1 = resCliInfo.rows[0].endereco_id;
    const cartaoIdCli1 = resCliInfo.rows[0].cartao_id;

    // Obter preco do produto
    const resProdPreco = await pgClient.query(`
      SELECT p.preco FROM "PRODUTO" p
      JOIN "PRODUTO_VARIACAO" pv ON pv.produto_id = p.id
      WHERE pv.id = $1
    `, [variacaoId1]);
    const precoUnit = parseFloat(resProdPreco.rows[0].preco);
    const valorTotalEsperado = precoUnit + 20.00; // Frete SP 1 item = 20.00

    // Criar pedido a partir do item no carrinho
    const resPedido = await request('POST', '/api/pedidos', {
      codigoCliente: 'CLI-0001',
      itens: [{ produtoVariacaoId: variacaoId1, quantidade: 1 }],
      enderecoId: enderecoIdCli1,
      cupons: [],
      cartoes: [{
        cartaoId: cartaoIdCli1,
        valor: valorTotalEsperado
      }]
    });

    assert('Pedido criado com sucesso em status EM PROCESSAMENTO', resPedido.status === 201 && resPedido.body?.status === 'EM PROCESSAMENTO', JSON.stringify(resPedido));
    const codigoPedido = resPedido.body?.codigo;

    // Verificar que carrinho do cliente foi limpo atomicamente
    const resCartAposPedido = await request('GET', '/api/carrinho/CLI-0001');
    assert('Carrinho do cliente é atualizado/limpo após criação do pedido', resCartAposPedido.body?.itens?.length === 0);

    // Verificar que o estoque físico ainda NÃO sofreu baixa definitiva (RN0028)
    const resEstoqueFisicoAposCriar = await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [variacaoId1]);
    assert('Estoque físico NÃO é baixado durante EM PROCESSAMENTO', resEstoqueFisicoAposCriar.rows[0].quantidade === estoqueFisicoInicial);

    // Verificar que o estoque disponível foi reduzido pelo pedido em processamento (reserva transferida)
    const resDispAposCriar = await request('GET', '/api/produtos');
    const prodRef = resDispAposCriar.body.find(p => p.variacoes.some(v => v.id === variacaoId1));
    const varDisp = prodRef?.variacoes?.find(v => v.id === variacaoId1);
    assert('Estoque disponível bloqueia a unidade do pedido em processamento', varDisp?.quantidadeEstoque === estoqueFisicoInicial - 1);

    // =========================================================================
    // TESTE 10: Aprovação de pagamento e BAIXA DEFINITIVA ÚNICA (RF0053 / RN0028)
    // =========================================================================
    const resAprovar = await request('POST', `/api/pedidos/${codigoPedido}/processar-pagamento`, {
      forcarResultado: 'APROVADA'
    });
    assert('Pagamento aprovado com sucesso', resAprovar.status === 200 && resAprovar.body?.status === 'APROVADA');

    // Verificar baixa definitiva única no PostgreSQL
    const resEstoqueAposAprovar = await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [variacaoId1]);
    assert('Estoque físico sofre baixa definitiva única de 1 unidade', resEstoqueAposAprovar.rows[0].quantidade === estoqueFisicoInicial - 1);

    // =========================================================================
    // TESTE 11: Reprovação de pagamento e LIBERAÇÃO DE RESERVA
    // =========================================================================
    // Adicionar item ao carrinho
    await request('POST', '/api/carrinho/CLI-0001/itens', {
      produtoVariacaoId: variacaoId1,
      quantidade: 1
    });

    const resEstoqueAntesReprovar = await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [variacaoId1]);
    const estoqueFisicoAntesRep = resEstoqueAntesReprovar.rows[0].quantidade;

    // Criar novo pedido para reprovação
    const resPedidoRep = await request('POST', '/api/pedidos', {
      codigoCliente: 'CLI-0001',
      itens: [{ produtoVariacaoId: variacaoId1, quantidade: 1 }],
      enderecoId: enderecoIdCli1,
      cupons: [],
      cartoes: [{
        cartaoId: cartaoIdCli1,
        valor: valorTotalEsperado
      }]
    });
    const codPedidoRep = resPedidoRep.body?.codigo;

    // Reprovar pedido
    const resReprovar = await request('POST', `/api/pedidos/${codPedidoRep}/processar-pagamento`, {
      forcarResultado: 'REPROVADA',
      motivo: 'Simulação de reprovação controlada'
    });
    assert('Pedido alterado para REPROVADA', resReprovar.status === 200 && resReprovar.body?.status === 'REPROVADA');

    // Confirmar que o estoque físico não foi alterado
    const resEstoqueAposReprovar = await pgClient.query(`SELECT quantidade FROM "ESTOQUE" WHERE produto_variacao_id = $1`, [variacaoId1]);
    assert('Estoque físico intacto após reprovação', resEstoqueAposReprovar.rows[0].quantidade === estoqueFisicoAntesRep);

    // Confirmar que a disponibilidade foi liberada
    const resDispAposReprovar = await request('GET', '/api/produtos');
    const prodRep = resDispAposReprovar.body.find(p => p.variacoes.some(v => v.id === variacaoId1));
    const varDispRep = prodRep?.variacoes?.find(v => v.id === variacaoId1);
    assert('Disponibilidade de estoque é totalmente liberada após reprovação', varDispRep?.quantidadeEstoque === estoqueFisicoAntesRep);

    // =========================================================================
    // TESTE 12: Restrição de ForcarResultado em Produção
    // =========================================================================
    // A API está em Development, então forcarResultado funciona. Vamos verificar a trava de validação se status for inválido
    const resInvalido = await request('POST', `/api/pedidos/${codigoPedido}/processar-pagamento`, {
      forcarResultado: 'INVALIDO'
    });
    assert('Tentativa de forçar status desconhecido retorna 400 Bad Request', resInvalido.status === 400);

    // Limpeza final de carrinhos de teste
    await request('DELETE', '/api/carrinho/CLI-0001');
    await request('DELETE', '/api/carrinho/CLI-0002');

  } catch (err) {
    console.error('Erro na execução dos testes:', err);
    failed++;
  } finally {
    await pgClient.end();
  }

  console.log('\n=========================================');
  console.log(`TOTAL DE TESTES: ${passed + failed}`);
  console.log(`PASSARAM: ${passed}`);
  console.log(`FALHARAM: ${failed}`);
  console.log('=========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
