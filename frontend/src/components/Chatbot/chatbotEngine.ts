import { products } from '../../data/products';
import type { Product } from '../../types';

export interface ChatContext {
  runningGoal?: 'TREINO DIÁRIO' | 'LONGA DISTÂNCIA' | 'VELOCIDADE' | 'COMPETIÇÃO' | 'TRAIL';
  distance?: string;
  shoeSize?: number;
  maxPrice?: number;
  brand?: string;
  preference?: string;
  surface?: string;
  lastRecommendedProducts: Product[];
  recommendedHistoryIds: string[];
  pendingQuestion?: 'goal' | 'size' | 'price' | 'distance' | null;
}

export interface BotReply {
  text: string;
  recommendations?: Product[];
  suggestions: string[];
  context: ChatContext;
}

export const initialChatContext: ChatContext = {
  lastRecommendedProducts: [],
  recommendedHistoryIds: [],
  pendingQuestion: null
};

// Normalizar texto para busca insensível a acentos
function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Extrair numeração de calçado
function extractShoeSize(normText: string, originalText: string): number | null {
  // Padrões como: tamanho 39, tam 40, no 39, num 41, número 42
  const explicitSizeMatch = normText.match(/(?:tamanho|tam\.?|numero|num\.?|no|na)\s*(\d{2})/);
  if (explicitSizeMatch) {
    const size = parseInt(explicitSizeMatch[1], 10);
    if (size >= 36 && size <= 46) return size;
  }

  // Se a mensagem for só um número (ex: "39", "40", "38")
  const onlyNumberMatch = normText.match(/^(\d{2})$/);
  if (onlyNumberMatch) {
    const size = parseInt(onlyNumberMatch[1], 10);
    if (size >= 36 && size <= 46) return size;
  }

  // Procurar por número solto de 36 a 46 que não seja preço ou distância
  const tokens = originalText.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[^\w]/g, '');
    const num = parseInt(t, 10);
    if (num >= 36 && num <= 46) {
      // Verificar se a palavra anterior ou posterior não é km, r$, reais
      const prev = i > 0 ? tokens[i - 1].toLowerCase() : '';
      const next = i < tokens.length - 1 ? tokens[i + 1].toLowerCase() : '';
      if (!prev.includes('r$') && !prev.includes('reais') && !next.includes('km') && !next.includes('k') && !next.includes('reais')) {
        return num;
      }
    }
  }

  return null;
}

// Extrair preço máximo
function extractMaxPrice(normText: string): number | null {
  // Padrões: até R$ 1.000, até 1000, no maximo 800, até r$800, menor que 900
  const priceMatch = normText.match(/(?:ate|no maximo|abaixo de|menos de|custando ate|por ate|orcamento de ate|valor ate|faixa de ate|maximo)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+)/);
  if (priceMatch) {
    const cleanNum = priceMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanNum);
    if (parsed > 50 && parsed < 20000) return parsed;
  }

  // Padrões como: "R$ 800", "800 reais", "R$1000"
  const explicitCurrencyMatch = normText.match(/(?:r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+)|\b(\d{3,4})\s*reais\b)/);
  if (explicitCurrencyMatch) {
    const val = explicitCurrencyMatch[1] || explicitCurrencyMatch[2];
    const cleanNum = val.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanNum);
    if (parsed > 50 && parsed < 20000) return parsed;
  }

  return null;
}

// Extrair objetivo / categoria
function extractGoal(normText: string): 'TREINO DIÁRIO' | 'LONGA DISTÂNCIA' | 'VELOCIDADE' | 'COMPETIÇÃO' | 'TRAIL' | null {
  if (
    normText.includes('trilha') ||
    normText.includes('trail') ||
    normText.includes('terra') ||
    normText.includes('lama') ||
    normText.includes('montanha') ||
    normText.includes('irregular')
  ) {
    return 'TRAIL';
  }

  if (
    normText.includes('competicao') ||
    normText.includes('competir') ||
    normText.includes('placa de carbono') ||
    normText.includes('maratona oficial') ||
    normText.includes('elite') ||
    normText.includes('supertenis') ||
    normText.includes('super tenis')
  ) {
    return 'COMPETIÇÃO';
  }

  if (
    normText.includes('longa distancia') ||
    normText.includes('longao') ||
    normText.includes('longas distancias') ||
    normText.includes('maratona') ||
    normText.includes('meia maratona') ||
    normText.includes('21km') ||
    normText.includes('42km') ||
    normText.includes('rodagem longa')
  ) {
    return 'LONGA DISTÂNCIA';
  }

  if (
    normText.includes('velocidade') ||
    normText.includes('tiro') ||
    normText.includes('tiros') ||
    normText.includes('ritmo') ||
    normText.includes('tempo run') ||
    normText.includes('sprint') ||
    normText.includes('rapido') ||
    normText.includes('bater recorde')
  ) {
    return 'VELOCIDADE';
  }

  if (
    normText.includes('treino diario') ||
    normText.includes('dia a dia') ||
    normText.includes('cotidiano') ||
    normText.includes('rodagem') ||
    normText.includes('iniciante') ||
    normText.includes('comecar') ||
    normText.includes('5km') ||
    normText.includes('10km') ||
    normText.includes('academia') ||
    normText.includes('caminhada')
  ) {
    return 'TREINO DIÁRIO';
  }

  return null;
}

// Extrair marca
function extractBrand(normText: string): string | null {
  if (normText.includes('nike')) return 'Nike';
  if (normText.includes('adidas')) return 'Adidas';
  if (normText.includes('asics')) return 'Asics';
  if (normText.includes('olympikus')) return 'Olympikus';
  if (normText.includes('saucony')) return 'Saucony';
  if (normText.includes('salomon')) return 'Salomon';
  if (normText.includes('new balance') || normText.includes('nb')) return 'New Balance';
  return null;
}

// Extrair modelo específico mencionado
function extractProductModel(normText: string): Product | null {
  return (
    products.find(p => {
      const nameNorm = normalizeText(p.name);
      return normText.includes(nameNorm) || (nameNorm.includes(' ') && normText.includes(nameNorm.split(' ')[0]));
    }) || null
  );
}

// Filtrar e ranquear produtos de acordo com os critérios informados
function filterProducts(ctx: ChatContext, excludeIds: string[] = []): Product[] {
  return products.filter(p => {
    if (excludeIds.includes(p.id)) return false;

    // 1. Objetivo / Categoria
    if (ctx.runningGoal) {
      const hasCat = p.categories.includes(ctx.runningGoal) || p.category === ctx.runningGoal;
      if (!hasCat) return false;
    }

    // 2. Numeração disponível
    if (ctx.shoeSize && !p.sizes.includes(ctx.shoeSize)) {
      return false;
    }

    // 3. Preço Máximo
    if (ctx.maxPrice && p.price > ctx.maxPrice) {
      return false;
    }

    // 4. Marca
    if (ctx.brand && p.brand.toLowerCase() !== ctx.brand.toLowerCase()) {
      return false;
    }

    return true;
  });
}

// Gerar explicação rica e baseada estritamente nos dados do mock
function buildRecommendationDescription(product: Product, ctx: ChatContext): string {
  const catText = product.categories.join(' e ');
  const sizeText = ctx.shoeSize ? `tamanho ${ctx.shoeSize} disponível` : `tamanhos do ${Math.min(...product.sizes)} ao ${Math.max(...product.sizes)}`;
  const priceFormatted = product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const techText = product.technologies.length > 0 ? ` (Tecnologias: ${product.technologies.slice(0, 2).join(', ')})` : '';

  return `• **${product.brand} ${product.name}** (${priceFormatted}): Indicado para ${catText}, com ${sizeText}.${techText} ${product.description}`;
}

export function generateBotResponse(userInput: string, currentContext: ChatContext): BotReply {
  const norm = normalizeText(userInput);
  const updatedContext: ChatContext = { ...currentContext };

  // 1. Verificar intenção de RESET / LIMPAR FILTROS
  if (norm.includes('limpar') || norm.includes('recomecar') || norm.includes('novo filtro') || norm === 'inicio') {
    return {
      text: 'Filtros limpos! Me conte: qual é o seu foco de corrida hoje? (Treino diário, longas distâncias, velocidade, competição ou trilha)',
      suggestions: ['Treino diário', 'Longas distâncias', 'Velocidade', 'Opções até R$ 800', 'Me ajude a escolher'],
      context: { ...initialChatContext }
    };
  }

  // 2. Extrair parâmetros da mensagem do usuário e acumular no contexto
  const detectedGoal = extractGoal(norm);
  const detectedSize = extractShoeSize(norm, userInput);
  const detectedPrice = extractMaxPrice(norm);
  const detectedBrand = extractBrand(norm);
  const specificProduct = extractProductModel(norm);

  if (detectedGoal) updatedContext.runningGoal = detectedGoal;
  if (detectedSize) updatedContext.shoeSize = detectedSize;
  if (detectedPrice) updatedContext.maxPrice = detectedPrice;
  if (detectedBrand) updatedContext.brand = detectedBrand;

  // 3. CONSULTA DIRETA: QUAL O TÊNIS MAIS BARATO?
  if (
    norm.includes('mais barato') ||
    norm.includes('menor preco') ||
    norm.includes('mais em conta') ||
    norm.includes('mais acessivel') ||
    norm.includes('menor valor')
  ) {
    const cheapest = [...products].sort((a, b) => a.price - b.price)[0];
    updatedContext.lastRecommendedProducts = [cheapest];
    updatedContext.recommendedHistoryIds = Array.from(new Set([...updatedContext.recommendedHistoryIds, cheapest.id]));

    return {
      text: `O tênis mais acessível do nosso catálogo atual é o **${cheapest.brand} ${cheapest.name}**, custando **${cheapest.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}**.\n\nEle é classificado para **${cheapest.categories.join(' e ')}** e possui tamanhos do ${Math.min(...cheapest.sizes)} ao ${Math.max(...cheapest.sizes)} disponíveis. ${cheapest.description}`,
      recommendations: [cheapest],
      suggestions: ['Ver opções até R$ 800', 'Tênis para longa distância', 'Tênis de velocidade', 'Qual o mais caro?'],
      context: updatedContext
    };
  }

  // 4. CONSULTA DIRETA: QUAL O TÊNIS MAIS CARO / TOPO DE LINHA?
  if (
    norm.includes('mais caro') ||
    norm.includes('maior preco') ||
    norm.includes('topo de linha') ||
    norm.includes('mais avancado') ||
    norm.includes('mais premium')
  ) {
    const mostExpensive = [...products].sort((a, b) => b.price - a.price)[0];
    updatedContext.lastRecommendedProducts = [mostExpensive];
    updatedContext.recommendedHistoryIds = Array.from(new Set([...updatedContext.recommendedHistoryIds, mostExpensive.id]));

    return {
      text: `O modelo topo de linha mais avançado do catálogo é o **${mostExpensive.brand} ${mostExpensive.name}**, por **${mostExpensive.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}**.\n\nEle é focado em **${mostExpensive.categories.join(' e ')}**, com tecnologias como ${mostExpensive.technologies.join(', ')}. ${mostExpensive.description}`,
      recommendations: [mostExpensive],
      suggestions: ['Tênis para competição', 'Tênis até R$ 1.000', 'Qual o mais barato?', 'Ver treino diário'],
      context: updatedContext
    };
  }

  // 5. CONSULTA DIRETA: QUAIS CATEGORIAS EXISTEM?
  if (norm.includes('quais categorias') || norm.includes('quais tipos') || norm.includes('que categorias') || norm.includes('categorias existem')) {
    return {
      text: 'No catálogo da RunWay trabalhamos com 5 categorias especializadas de tênis de corrida:\n\n' +
        '1. **Treino Diário**: Versatilidade, durabilidade e amortecimento equilibrado para o dia a dia.\n' +
        '2. **Longa Distância**: Alto amortecimento e suporte para rodagens longas e meias/maratonas.\n' +
        '3. **Velocidade**: Leveza e propulsão ágil para treinos de tiro e ritmo.\n' +
        '4. **Competição**: Modelos de alta performance com placas de carbono/propulsão para o dia da prova.\n' +
        '5. **Trail**: Aderência e proteção para corridas em trilha, terra e montanha.\n\n' +
        'Qual dessas categorias você gostaria de explorar?',
      suggestions: ['Treino Diário', 'Longa Distância', 'Velocidade', 'Competição', 'Trail'],
      context: updatedContext
    };
  }

  // 6. CONSULTA ESPECÍFICA DE PREÇO/DETALHE DE UM MODELO (ex: "Quanto custa o Pegasus 41?")
  if (specificProduct && (norm.includes('quanto custa') || norm.includes('valor') || norm.includes('preco') || norm.includes('informacoes') || norm.includes('detalhes'))) {
    updatedContext.lastRecommendedProducts = [specificProduct];
    updatedContext.recommendedHistoryIds = Array.from(new Set([...updatedContext.recommendedHistoryIds, specificProduct.id]));

    return {
      text: `O **${specificProduct.brand} ${specificProduct.name}** custa **${specificProduct.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}**.\n\n• **Categorias**: ${specificProduct.categories.join(', ')}\n• **Drop**: ${specificProduct.drop} | **Peso**: ${specificProduct.weight}\n• **Numerações**: ${Math.min(...specificProduct.sizes)} ao ${Math.max(...specificProduct.sizes)}\n• **Tecnologias**: ${specificProduct.technologies.join(', ')}\n\n${specificProduct.description}`,
      recommendations: [specificProduct],
      suggestions: [`Tem no tamanho 39?`, `Tem no tamanho 41?`, 'Tem outro modelo parecido?', 'Ver opções até R$ 800'],
      context: updatedContext
    };
  }

  // 7. FOLLOW-UP: "E tem no 39?" / "Tem tamanho X?"
  if (detectedSize && (norm.includes('tem no') || norm.includes('tem tamanho') || norm.includes('e no') || norm.startsWith('tem') || (updatedContext.lastRecommendedProducts.length > 0 && norm.length <= 15))) {
    if (updatedContext.lastRecommendedProducts.length > 0) {
      const lastProd = updatedContext.lastRecommendedProducts[0];
      const hasSize = lastProd.sizes.includes(detectedSize);
      if (hasSize) {
        return {
          text: `Sim! O **${lastProd.brand} ${lastProd.name}** possui o tamanho **${detectedSize}** disponível no nosso estoque (numerações disponíveis: ${Math.min(...lastProd.sizes)} ao ${Math.max(...lastProd.sizes)}).`,
          recommendations: [lastProd],
          suggestions: ['Ver detalhes do produto', 'Tem outra opção nesse tamanho?', 'Ver opções para longão'],
          context: updatedContext
        };
      } else {
        // Encontrar alternativas no mesmo tamanho
        const matchingAlternatives = products.filter(p => p.sizes.includes(detectedSize) && p.id !== lastProd.id).slice(0, 2);
        return {
          text: `O **${lastProd.brand} ${lastProd.name}** não possui o tamanho ${detectedSize} disponível no catálogo (tamanhos disponíveis: ${lastProd.sizes.join(', ')}).\n\nMas separei estes outros modelos que temos no tamanho **${detectedSize}**:`,
          recommendations: matchingAlternatives,
          suggestions: [`Outros modelos tamanho ${detectedSize}`, 'Treino diário', 'Longa distância', 'Limpar filtros'],
          context: updatedContext
        };
      }
    }
  }

  // 8. FOLLOW-UP: "Tem outro?" / "Outra opção"
  if (
    norm.includes('tem outro') ||
    norm.includes('outra opcao') ||
    norm.includes('outras opcoes') ||
    norm.includes('outro modelo') ||
    norm.includes('mais algum') ||
    norm.includes('tem mais') ||
    norm.includes('mostre outro')
  ) {
    const remainingMatches = filterProducts(updatedContext, updatedContext.recommendedHistoryIds);

    if (remainingMatches.length > 0) {
      const nextBatch = remainingMatches.slice(0, 3);
      updatedContext.lastRecommendedProducts = nextBatch;
      updatedContext.recommendedHistoryIds = Array.from(new Set([...updatedContext.recommendedHistoryIds, ...nextBatch.map(p => p.id)]));

      const descriptions = nextBatch.map(p => buildRecommendationDescription(p, updatedContext)).join('\n\n');
      return {
        text: `Aqui estão outras opções do catálogo compatíveis com suas preferências:\n\n${descriptions}`,
        recommendations: nextBatch,
        suggestions: ['Tem mais algum?', 'Ver opções até R$ 800', 'Ver o mais barato', 'Limpar filtros'],
        context: updatedContext
      };
    } else {
      // Sem mais opções com esses filtros exatos
      return {
        text: 'Você já visualizou todas as opções disponíveis no catálogo para esses critérios específicos. Se quiser, podemos flexibilizar a faixa de preço ou explorar outra categoria!',
        suggestions: ['Ver todas as categorias', 'Opções até R$ 1.000', 'Ver mais baratos', 'Limpar filtros'],
        context: updatedContext
      };
    }
  }

  // 9. SAUDAÇÃO PURA OU PERGUNTA GENÉRICA ("Quero um tênis para correr", "Me ajude a escolher", "Oi")
  const isGeneric = (
    norm === 'oi' ||
    norm === 'ola' ||
    norm === 'bom dia' ||
    norm === 'boa tarde' ||
    norm === 'boa noite' ||
    norm === 'quero um tenis' ||
    norm === 'quero correr' ||
    norm === 'me ajude a escolher' ||
    norm === 'ajuda' ||
    norm === 'quero comprar um tenis' ||
    norm === 'tenis para correr'
  );

  if (isGeneric && !detectedGoal && !detectedSize && !detectedPrice) {
    return {
      text: 'Claro! Para te indicar as melhores opções do catálogo RunWay, me conta: você procura um tênis para **treino diário**, **longas distâncias**, **velocidade**, **competição** ou **trilha**?',
      suggestions: ['Treino diário', 'Longas distâncias', 'Velocidade', 'Competição', 'Trilha'],
      context: updatedContext
    };
  }

  // 10. FLUXO PROGRESSIVO: Usuário informou apenas objetivo (ex: "Quero para longa distância")
  if (detectedGoal && !updatedContext.shoeSize && !updatedContext.maxPrice && norm.split(' ').length <= 4) {
    updatedContext.pendingQuestion = 'size';
    return {
      text: `Excelente escolha! Para corridas de **${detectedGoal.toLowerCase()}**, temos ótimos modelos focados em conforto e amortecimento.\n\nQual é a sua numeração para que eu verifique os tamanhos disponíveis no estoque?`,
      suggestions: ['Tamanho 39', 'Tamanho 40', 'Tamanho 41', 'Tamanho 42', 'Ver todos os tamanhos'],
      context: updatedContext
    };
  }

  // 11. BUSCA GERAL COM OS FILTROS DO CONTEXTO
  const matchingProducts = filterProducts(updatedContext);

  if (matchingProducts.length > 0) {
    const topPicks = matchingProducts.slice(0, 3);
    updatedContext.lastRecommendedProducts = topPicks;
    updatedContext.recommendedHistoryIds = Array.from(new Set([...updatedContext.recommendedHistoryIds, ...topPicks.map(p => p.id)]));

    let intro = 'Encontrei excelentes opções no nosso catálogo';
    const criteriaParts: string[] = [];
    if (updatedContext.runningGoal) criteriaParts.push(`para **${updatedContext.runningGoal.toLowerCase()}**`);
    if (updatedContext.shoeSize) criteriaParts.push(`no **tamanho ${updatedContext.shoeSize}**`);
    if (updatedContext.maxPrice) criteriaParts.push(`com valor de até **${updatedContext.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`);
    if (updatedContext.brand) criteriaParts.push(`da marca **${updatedContext.brand}**`);

    if (criteriaParts.length > 0) {
      intro += ` ${criteriaParts.join(', ')}:`;
    } else {
      intro += ':';
    }

    const descriptions = topPicks.map(p => buildRecommendationDescription(p, updatedContext)).join('\n\n');

    return {
      text: `${intro}\n\n${descriptions}`,
      recommendations: topPicks,
      suggestions: ['Tem outro modelo?', 'Qual é o mais barato?', 'Opções com placa de carbono', 'Limpar filtros'],
      context: updatedContext
    };
  }

  // 12. QUANDO NÃO HÁ PRODUTO COMPATÍVEL (Nenhum resultado nos dados mockados)
  let noMatchMsg = 'Não encontrei no catálogo atual uma opção que atenda a todos esses critérios juntos';
  if (updatedContext.shoeSize && updatedContext.maxPrice) {
    noMatchMsg += ` (tamanho ${updatedContext.shoeSize} até ${updatedContext.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
  } else if (updatedContext.maxPrice) {
    noMatchMsg += ` com valor de até ${updatedContext.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  } else if (updatedContext.shoeSize) {
    noMatchMsg += ` no tamanho ${updatedContext.shoeSize}`;
  }
  noMatchMsg += '.';

  // Procurar opção mais próxima flexibilizando preço ou categoria
  let alternativeSuggestion = '';
  let alternativeRecs: Product[] = [];
  if (updatedContext.maxPrice) {
    const closestByPrice = [...products]
      .filter(p => (!updatedContext.shoeSize || p.sizes.includes(updatedContext.shoeSize)))
      .sort((a, b) => a.price - b.price);

    if (closestByPrice.length > 0) {
      const nearest = closestByPrice[0];
      alternativeRecs = [nearest];
      alternativeSuggestion = ` A opção mais próxima disponível é o **${nearest.brand} ${nearest.name}** por **${nearest.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** (${nearest.categories.join(', ')}). Deseja ver opções acima dessa faixa de preço ou explorar outros modelos?`;
    }
  }

  if (!alternativeSuggestion) {
    alternativeSuggestion = ' Posso te mostrar outros modelos do catálogo se flexibilizarmos a faixa de preço ou o tipo de treino.';
  }

  return {
    text: `${noMatchMsg}${alternativeSuggestion}`,
    recommendations: alternativeRecs,
    suggestions: ['Ver opções até R$ 800', 'Ver modelo mais barato', 'Tênis para treino diário', 'Limpar filtros'],
    context: updatedContext
  };
}
