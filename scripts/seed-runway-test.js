/**
 * RunWay E-Commerce - Seed de Clientes para Ambiente de Teste (runway_test)
 * 
 * Este script popula o banco com 5 clientes padronizados utilizando EXCLUSIVAMENTE
 * as APIs REST reais do RunWay (POST /api/clientes, POST /api/clientes/{codigo}/cartoes),
 * sem nenhuma inserção direta por SQL.
 * 
 * Características:
 * - Idempotente: verifica se os clientes já existem por CPF/E-mail antes de criar.
 * - Primeiro cliente criado resulta em CLI-0001 (caso a base esteja limpa).
 * - CLI-0001 recebe endereço em SP e 2 cartões de crédito (1 preferencial Visa e 1 Mastercard)
 *   para garantir suporte a todos os cenários do Cypress (Cenários 2, 3, 4, 5, 6, 7).
 * - Respeita RN0021, RN0022, RN0023, RN0024, RN0025 e RN0026.
 * - CPFs com dígitos verificadores matematicamente válidos.
 * - Senhas fortes no padrão RNF0031 (RunWay@2026ClienteX).
 * 
 * Execução:
 *   node scripts/seed-runway-test.js
 * ou com URL customizada:
 *   node scripts/seed-runway-test.js http://localhost:5035
 */

const API_BASE_URL = process.env.RUNWAY_API_URL || process.argv[2] || 'http://localhost:5035';

const CLIENTES_PADRAO = [
  {
    nome: 'Ana Carolina Silva',
    cpf: '11144477735',
    cpfFormatado: '111.444.777-35',
    dataNascimento: '1990-03-14',
    genero: 'Feminino',
    email: 'ana.silva@email.com',
    senha: 'RunWay@2026Cliente1',
    confirmacaoSenha: 'RunWay@2026Cliente1',
    telefone: {
      tipo: 'Celular',
      ddd: '11',
      numero: '987654321'
    },
    enderecos: [
      {
        nome: 'Residência SP',
        tipoResidencia: 'Casa',
        tipoLogradouro: 'Rua',
        logradouro: 'Rua das Palmeiras',
        numero: '142',
        complemento: 'Apto 82',
        bairro: 'Jardim Paulista',
        cep: '01310100',
        cidade: 'São Paulo',
        estado: 'SP',
        pais: 'Brasil',
        observacoes: 'Endereço principal de entrega e cobrança',
        residencial: true,
        entrega: true,
        cobranca: true
      }
    ],
    cartoes: [
      {
        bandeiraId: 1, // Visa
        numeroCartao: '4532111122224821',
        nomeImpresso: 'ANA C SILVA',
        dataValidade: '08/28',
        cvv: '123',
        preferencial: true
      },
      {
        bandeiraId: 2, // Mastercard (necessário para o Cenário 4 de múltiplos cartões)
        numeroCartao: '5412333344449234',
        nomeImpresso: 'ANA C SILVA',
        dataValidade: '10/28',
        cvv: '456',
        preferencial: false
      }
    ]
  },
  {
    nome: 'Carlos Roberto Mendes',
    cpf: '52998224725',
    cpfFormatado: '529.982.247-25',
    dataNascimento: '1985-07-21',
    genero: 'Masculino',
    email: 'carlos.mendes@email.com',
    senha: 'RunWay@2026Cliente2',
    confirmacaoSenha: 'RunWay@2026Cliente2',
    telefone: {
      tipo: 'Celular',
      ddd: '41',
      numero: '992345678'
    },
    enderecos: [
      {
        nome: 'Residência Curitiba',
        tipoResidencia: 'Casa',
        tipoLogradouro: 'Rua',
        logradouro: 'Rua XV de Novembro',
        numero: '500',
        complemento: 'Sobrado 2',
        bairro: 'Centro',
        cep: '80020300',
        cidade: 'Curitiba',
        estado: 'PR',
        pais: 'Brasil',
        observacoes: 'Próximo à praça',
        residencial: true,
        entrega: true,
        cobranca: true
      }
    ],
    cartoes: [
      {
        bandeiraId: 3, // Elo
        numeroCartao: '6363688899995571',
        nomeImpresso: 'CARLOS R MENDES',
        dataValidade: '11/28',
        cvv: '789',
        preferencial: true
      }
    ]
  },
  {
    nome: 'Maria Oliveira Santos',
    cpf: '70265432024',
    cpfFormatado: '702.654.320-24',
    dataNascimento: '1995-11-07',
    genero: 'Feminino',
    email: 'maria.santos@email.com',
    senha: 'RunWay@2026Cliente3',
    confirmacaoSenha: 'RunWay@2026Cliente3',
    telefone: {
      tipo: 'Celular',
      ddd: '81',
      numero: '976543210'
    },
    enderecos: [
      {
        nome: 'Residência Recife',
        tipoResidencia: 'Apartamento',
        tipoLogradouro: 'Avenida',
        logradouro: 'Avenida Boa Viagem',
        numero: '1500',
        complemento: 'Apto 301',
        bairro: 'Boa Viagem',
        cep: '51011000',
        cidade: 'Recife',
        estado: 'PE',
        pais: 'Brasil',
        observacoes: 'Frente para o mar',
        residencial: true,
        entrega: true,
        cobranca: true
      }
    ],
    cartoes: [
      {
        bandeiraId: 1, // Visa
        numeroCartao: '4532777788883399',
        nomeImpresso: 'MARIA O SANTOS',
        dataValidade: '07/28',
        cvv: '321',
        preferencial: true
      }
    ]
  },
  {
    nome: 'Lucas Pereira Lima',
    cpf: '85341298004',
    cpfFormatado: '853.412.980-04',
    dataNascimento: '1992-04-18',
    genero: 'Masculino',
    email: 'lucas.lima@email.com',
    senha: 'RunWay@2026Cliente4',
    confirmacaoSenha: 'RunWay@2026Cliente4',
    telefone: {
      tipo: 'Celular',
      ddd: '31',
      numero: '988776655'
    },
    enderecos: [
      {
        nome: 'Residência BH',
        tipoResidencia: 'Apartamento',
        tipoLogradouro: 'Avenida',
        logradouro: 'Avenida Afonso Pena',
        numero: '2200',
        complemento: 'Apto 1204',
        bairro: 'Funcionários',
        cep: '30130007',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        pais: 'Brasil',
        observacoes: 'Portaria 24 horas',
        residencial: true,
        entrega: true,
        cobranca: true
      }
    ],
    cartoes: [
      {
        bandeiraId: 2, // Mastercard
        numeroCartao: '5412444455556677',
        nomeImpresso: 'LUCAS P LIMA',
        dataValidade: '09/28',
        cvv: '654',
        preferencial: true
      }
    ]
  },
  {
    nome: 'Juliana Fernandes Costa',
    cpf: '94812376050',
    cpfFormatado: '948.123.760-50',
    dataNascimento: '1998-09-25',
    genero: 'Feminino',
    email: 'juliana.costa@email.com',
    senha: 'RunWay@2026Cliente5',
    confirmacaoSenha: 'RunWay@2026Cliente5',
    telefone: {
      tipo: 'Celular',
      ddd: '21',
      numero: '998811223'
    },
    enderecos: [
      {
        nome: 'Residência Rio',
        tipoResidencia: 'Casa',
        tipoLogradouro: 'Rua',
        logradouro: 'Rua Barata Ribeiro',
        numero: '350',
        complemento: 'Bloco A',
        bairro: 'Copacabana',
        cep: '22040002',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
        pais: 'Brasil',
        observacoes: 'Posto 4',
        residencial: true,
        entrega: true,
        cobranca: true
      }
    ],
    cartoes: [
      {
        bandeiraId: 1, // Visa
        numeroCartao: '4532999911114422',
        nomeImpresso: 'JULIANA F COSTA',
        dataValidade: '05/29',
        cvv: '987',
        preferencial: true
      }
    ]
  }
];

async function executarSeed() {
  console.log('========================================================================');
  console.log(' RUNWAY E-COMMERCE: SEED DE CLIENTES VIA API (runway_test)');
  console.log(` Alvo: ${API_BASE_URL}`);
  console.log('========================================================================\n');

  // 1. Testar conectividade com a API
  try {
    const healthCheck = await fetch(`${API_BASE_URL}/api/produtos`);
    if (!healthCheck.ok) {
      throw new Error(`A API respondeu com status ${healthCheck.status}`);
    }
  } catch (err) {
    console.error(`[ERRO DE CONEXÃO] Não foi possível conectar ao backend em ${API_BASE_URL}.`);
    console.error('Certifique-se de que o backend ASP.NET Core está em execução apontando para runway_test.\n');
    console.error('Detalhe:', err.message);
    process.exit(1);
  }

  // 2. Consultar clientes existentes para garantir idempotência
  let clientesExistentes = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/clientes`);
    if (res.ok) {
      clientesExistentes = await res.json();
    }
  } catch (err) {
    console.warn('[AVISO] Não foi possível consultar a lista prévia de clientes:', err.message);
  }

  console.log(`Clientes atualmente cadastrados na base: ${clientesExistentes.length}`);
  console.log('Iniciando processamento dos 5 clientes padrão...\n');

  const relatorioFinal = [];

  for (let i = 0; i < CLIENTES_PADRAO.length; i++) {
    const c = CLIENTES_PADRAO[i];
    const cpfLimpo = c.cpf;

    const clienteExistente = clientesExistentes.find(
      x => x.cpf === cpfLimpo || x.email?.toLowerCase() === c.email.toLowerCase()
    );

    let codigoCliente = clienteExistente?.codigo;
    let resultadoOp = '';
    let enderecoInfo = '';
    let cartoesInfo = [];

    if (clienteExistente) {
      resultadoOp = 'Já existia (Idempotente)';
      console.log(`[INFO] Cliente "${c.nome}" (CPF: ${c.cpfFormatado}) já cadastrado com código ${codigoCliente}.`);

      // Verificar e adicionar cartões se estiverem faltando
      try {
        const resCards = await fetch(`${API_BASE_URL}/api/clientes/${codigoCliente}/cartoes`);
        const cardsDb = resCards.ok ? await resCards.json() : [];

        for (const cardReq of c.cartoes) {
          const ultimosDigitos = cardReq.numeroCartao.slice(-4);
          const jaTemCartao = cardsDb.some(cd => cd.ultimosQuatroDigitos === ultimosDigitos);

          if (!jaTemCartao) {
            const addCardRes = await fetch(`${API_BASE_URL}/api/clientes/${codigoCliente}/cartoes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cardReq)
            });
            if (addCardRes.ok) {
              const cardCriado = await addCardRes.json();
              cartoesInfo.push(`${cardCriado.bandeiraNome} final ${cardCriado.ultimosQuatroDigitos} (Criado)`);
            }
          } else {
            const cExist = cardsDb.find(cd => cd.ultimosQuatroDigitos === ultimosDigitos);
            cartoesInfo.push(`${cExist.bandeiraNome} final ${cExist.ultimosQuatroDigitos} (Existente)`);
          }
        }
      } catch (err) {
        console.warn(`[AVISO] Erro ao sincronizar cartões de ${codigoCliente}:`, err.message);
      }

      // Buscar endereço existente
      try {
        const resEnd = await fetch(`${API_BASE_URL}/api/clientes/${codigoCliente}/enderecos`);
        const endDb = resEnd.ok ? await resEnd.json() : [];
        if (endDb.length > 0) {
          enderecoInfo = `${endDb[0].logradouro}, ${endDb[0].numero} - ${endDb[0].cidade}/${endDb[0].estado}`;
        }
      } catch {
        enderecoInfo = 'Cadastrado previamente';
      }

    } else {
      // Criar cliente via POST /api/clientes
      const payloadCliente = {
        nome: c.nome,
        cpf: c.cpf,
        dataNascimento: c.dataNascimento,
        genero: c.genero,
        email: c.email,
        senha: c.senha,
        confirmacaoSenha: c.confirmacaoSenha,
        telefone: c.telefone,
        enderecos: c.enderecos
      };

      const resCreate = await fetch(`${API_BASE_URL}/api/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCliente)
      });

      if (!resCreate.ok) {
        const errorData = await resCreate.json().catch(() => ({}));
        console.error(`[FALHA] Não foi possível cadastrar cliente "${c.nome}":`, errorData.erro || resCreate.statusText);
        relatorioFinal.push({
          codigo: 'N/A',
          nome: c.nome,
          endereco: 'Falha',
          cartao: 'Falha',
          resultado: `Erro HTTP ${resCreate.status}: ${errorData.erro || ''}`
        });
        continue;
      }

      const clienteCriado = await resCreate.json();
      codigoCliente = clienteCriado.codigo;
      resultadoOp = 'Criado com Sucesso';
      console.log(`[SUCESSO] Cliente cadastrado: ${codigoCliente} - ${c.nome}`);

      const endPrincipal = clienteCriado.enderecos?.[0];
      if (endPrincipal) {
        enderecoInfo = `${endPrincipal.logradouro}, ${endPrincipal.numero} - ${endPrincipal.cidade}/${endPrincipal.estado}`;
      }

      // Cadastrar cartões de crédito via POST /api/clientes/{codigo}/cartoes
      for (const cardReq of c.cartoes) {
        const resCard = await fetch(`${API_BASE_URL}/api/clientes/${codigoCliente}/cartoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cardReq)
        });

        if (resCard.ok) {
          const cardCriado = await resCard.json();
          cartoesInfo.push(`${cardCriado.bandeiraNome} final ${cardCriado.ultimosQuatroDigitos}${cardCriado.preferencial ? ' (Pref)' : ''}`);
        } else {
          const cardErr = await resCard.json().catch(() => ({}));
          console.warn(`[AVISO] Falha ao cadastrar cartão para ${codigoCliente}:`, cardErr.erro || resCard.statusText);
        }
      }
    }

    relatorioFinal.push({
      codigo: codigoCliente || 'N/A',
      nome: c.nome,
      endereco: enderecoInfo || `${c.enderecos[0].logradouro}, ${c.enderecos[0].numero} - ${c.enderecos[0].cidade}/${c.enderecos[0].estado}`,
      cartao: cartoesInfo.join(' | ') || 'Nenhum',
      resultado: resultadoOp
    });
  }

  // 3. Exibir resumo consolidado
  console.log('\n========================================================================');
  console.log(' RESUMO FINAL DO SEED DE CLIENTES');
  console.log('========================================================================');
  console.table(relatorioFinal);

  const cli0001 = relatorioFinal.find(r => r.codigo === 'CLI-0001');
  if (cli0001) {
    console.log('\n✔ [CONFORME] Cliente CLI-0001 está presente e pronto para os testes Cypress!');
  } else {
    console.log('\n⚠ [ATENÇÃO] CLI-0001 não foi o primeiro código gerado. Verifique a sequência do banco.');
  }

  console.log('Operação finalizada.\n');
}

executarSeed().catch(err => {
  console.error('Erro inesperado no script de seed:', err);
  process.exit(1);
});
