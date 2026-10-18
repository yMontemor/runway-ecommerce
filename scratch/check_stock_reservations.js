const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:123@localhost:5432/runway' });
  await client.connect();
  
  const estoques = await client.query('SELECT * FROM "Estoques" WHERE "ProdutoVariacaoId" = 4');
  console.log('ESTOQUE 4:', estoques.rows);

  const pedidos = await client.query(`
    SELECT p."Codigo", p."Status", p."DataPedido", ip."ProdutoVariacaoId", ip."Quantidade" 
    FROM "Pedidos" p 
    JOIN "ItensPedido" ip ON ip."PedidoId" = p."Id" 
    WHERE ip."ProdutoVariacaoId" = 4 AND p."Status" = 'EM PROCESSAMENTO'
  `);
  console.log('PEDIDOS EM PROCESSAMENTO COM VAR 4:', pedidos.rows);

  const carrinhos = await client.query(`
    SELECT c."ClienteId", c."DataExpiracao", ic."ProdutoVariacaoId", ic."Quantidade" 
    FROM "ItensCarrinho" ic 
    JOIN "Carrinhos" c ON c."Id" = ic."CarrinhoId" 
    WHERE ic."ProdutoVariacaoId" = 4
  `);
  console.log('CARRINHOS COM VAR 4:', carrinhos.rows);

  const clientes = await client.query('SELECT "Id", "Codigo", "Nome" FROM "Clientes"');
  console.log('CLIENTES:', clientes.rows);

  await client.end();
}

main().catch(console.error);
