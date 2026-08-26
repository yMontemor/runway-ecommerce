import { products } from '../../data/products';
import type { Product } from '../../types';

export interface ChatContext {
  runningGoal?: 'TREINO DIÁRIO' | 'LONGA DISTÂNCIA' | 'VELOCIDADE' | 'COMPETIÇÃO' | 'TRAIL';
  distance?: '5km' | '10km' | '21km' | '42km' | string;
  surface?: 'TRAIL' | 'ASFALTO';
  shoeSize?: number;
  maxPrice?: number;
  brand?: string;
  hasPlate?: boolean;
  lightweight?: boolean;
  cushioning?: boolean;
  specificTech?: string[];
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

// Normalizar texto para busca insensível a acentos e pontuações
function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s$.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Verifica se a ficha do produto indica tecnologia de placa real (não inclui EnergyRods/hastes)
function productHasPlate(p: Product): boolean {
  const combined = (p.technologies.join(' ') + ' ' + p.description).toLowerCase();
  return (
    combined.includes('placa') ||
    combined.includes('flyplate') ||
    combined.includes('carbon plate')
  );
}

// Extrair numeração de calçado
function extractShoeSize(normText: string, originalText: string): { size: number | null; clearSize: boolean } {
  // Comandos de liberação de tamanho
  if (
    normText.includes('qualquer tamanho') ||
    normText.includes('todos os tamanhos') ||
    normText.includes('sem tamanho') ||
    normText.includes('independente do tamanho')
  ) {
    return { size: null, clearSize: true };
  }

  // Padrões como: tamanho 39, tam 40, no 39, num 41, número 42
  const explicitSizeMatch = normText.match(/(?:tamanho|tam\.?|numero|num\.?|no|na|no tamanho|no tam)\s*(\d{2})/);
  if (explicitSizeMatch) {
    const size = parseInt(explicitSizeMatch[1], 10);
    if (size >= 36 && size <= 46) return { size, clearSize: false };
  }

  // Se a mensagem for apenas um número (ex: "39", "40", "38")
  const onlyNumberMatch = normText.match(/^(\d{2})$/);
  if (onlyNumberMatch) {
    const size = parseInt(onlyNumberMatch[1], 10);
    if (size >= 36 && size <= 46) return { size, clearSize: false };
  }

  // Procurar por número de 36 a 46 que não seja preço ou distância
  const tokens = originalText.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[^\w]/g, '');
    const num = parseInt(t, 10);
    if (num >= 36 && num <= 46) {
      const prev = i > 0 ? tokens[i - 1].toLowerCase() : '';
      const next = i < tokens.length - 1 ? tokens[i + 1].toLowerCase() : '';
      if (
        !prev.includes('r$') &&
        !prev.includes('reais') &&
        !next.includes('km') &&
        !next.includes('k') &&
        !next.includes('reais')
      ) {
        return { size: num, clearSize: false };
      }
    }
  }

  return { size: null, clearSize: false };
}

// Extrair preço máximo
function extractMaxPrice(normText: string): { maxPrice: number | null; clearPrice: boolean } {
  // Comandos de liberação de preço
  if (
    normText.includes('sem limite de preco') ||
    normText.includes('sem limite de valor') ||
    normText.includes('qualquer preco') ||
    normText.includes('qualquer valor') ||
    normText.includes('sem teto') ||
    normText.includes('sem limite')
  ) {
    return { maxPrice: null, clearPrice: true };
  }

  // Padrões como: até R$ 1.000, até 1000, no maximo 800, até r$800, menor que 900
  const priceMatch = normText.match(
    /(?:ate|no maximo|abaixo de|menos de|custando ate|por ate|orcamento de ate|valor ate|faixa de ate|maximo)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+)/
  );
  if (priceMatch) {
    const cleanNum = priceMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanNum);
    if (parsed > 50 && parsed < 20000) return { maxPrice: parsed, clearPrice: false };
  }

  // Padrões como: "R$ 800", "800 reais", "R$1000"
  const explicitCurrencyMatch = normText.match(/(?:r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+)|\b(\d{3,4})\s*reais\b)/);
  if (explicitCurrencyMatch) {
    const val = explicitCurrencyMatch[1] || explicitCurrencyMatch[2];
    const cleanNum = val.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanNum);
    if (parsed > 50 && parsed < 20000) return { maxPrice: parsed, clearPrice: false };
  }

  return { maxPrice: null, clearPrice: false };
}

// Extrair marca
function extractBrand(normText: string): { brand: string | null; clearBrand: boolean } {
  if (
    normText.includes('qualquer marca') ||
    normText.includes('todas as marcas') ||
    normText.includes('sem marca') ||
    normText.includes('sem preferencia de marca') ||
    normText.includes('independente da marca')
  ) {
    return { brand: null, clearBrand: true };
  }

  if (normText.includes('nike')) return { brand: 'Nike', clearBrand: false };
  if (normText.includes('adidas')) return { brand: 'Adidas', clearBrand: false };
  if (normText.includes('asics')) return { brand: 'Asics', clearBrand: false };
  if (normText.includes('olympikus')) return { brand: 'Olympikus', clearBrand: false };
  if (normText.includes('saucony')) return { brand: 'Saucony', clearBrand: false };
  if (normText.includes('salomon')) return { brand: 'Salomon', clearBrand: false };
  if (normText.includes('new balance') || normText.includes('nb')) return { brand: 'New Balance', clearBrand: false };

  return { brand: null, clearBrand: false };
}

// Extrair objetivo / categoria
function extractGoal(normText: string): 'TREINO DIÁRIO' | 'LONGA DISTÂNCIA' | 'VELOCIDADE' | 'COMPETIÇÃO' | 'TRAIL' | null {
  if (
    normText.includes('trilha') ||
    normText.includes('trail') ||
    normText.includes('terra') ||
    normText.includes('lama') ||
    normText.includes('montanha') ||
    normText.includes('irregular') ||
    normText.includes('off-road') ||
    normText.includes('off road')
  ) {
    return 'TRAIL';
  }

  if (
    normText.includes('competicao') ||
    normText.includes('competir') ||
    normText.includes('prova oficial') ||
    normText.includes('dia da prova') ||
    normText.includes('elite') ||
    normText.includes('supertenis') ||
    normText.includes('super tenis')
  ) {
    return 'COMPETIÇÃO';
  }

  if (
    normText.includes('velocidade') ||
    normText.includes('tiro') ||
    normText.includes('tiros') ||
    normText.includes('ritmo') ||
    normText.includes('tempo run') ||
    normText.includes('sprint') ||
    normText.includes('bater recorde')
  ) {
    return 'VELOCIDADE';
  }

  if (
    normText.includes('longa distancia') ||
    normText.includes('longas distancias') ||
    normText.includes('longao') ||
    normText.includes('rodagem longa') ||
    normText.includes('volume')
  ) {
    return 'LONGA DISTÂNCIA';
  }

  if (
    normText.includes('treino diario') ||
    normText.includes('treinos diarios') ||
    normText.includes('dia a dia') ||
    normText.includes('cotidiano') ||
    normText.includes('rodagem') ||
    normText.includes('iniciante') ||
    normText.includes('comecar a correr') ||
    normText.includes('academia') ||
    normText.includes('caminhada')
  ) {
    return 'TREINO DIÁRIO';
  }

  return null;
}

// Extrair distância específica informada pelo usuário (mantida separada de categoria)
function extractDistance(normText: string): '5km' | '10km' | '21km' | '42km' | null {
  if (normText.includes('42km') || normText.includes('42 km') || normText.includes('42k') || (normText.includes('maratona') && !normText.includes('meia maratona'))) {
    return '42km';
  }
  if (normText.includes('21km') || normText.includes('21 km') || normText.includes('21k') || normText.includes('meia maratona') || normText.includes('meia')) {
    return '21km';
  }
  if (normText.includes('10km') || normText.includes('10 km') || normText.includes('10k')) {
    return '10km';
  }
  if (normText.includes('5km') || normText.includes('5 km') || normText.includes('5k')) {
    return '5km';
  }
  return null;
}

// Extrair terreno / superfície
function extractSurface(normText: string): 'TRAIL' | 'ASFALTO' | null {
  if (
    normText.includes('trilha') ||
    normText.includes('trail') ||
    normText.includes('terra') ||
    normText.includes('lama') ||
    normText.includes('montanha') ||
    normText.includes('off-road') ||
    normText.includes('off road')
  ) {
    return 'TRAIL';
  }

  if (normText.includes('asfalto') || normText.includes('rua') || normText.includes('pista') || normText.includes('estrada')) {
    return 'ASFALTO';
  }

  return null;
}

// Extrair características técnicas e preferências
function extractTechnicalFeatures(normText: string): {
  hasPlate?: boolean;
  lightweight?: boolean;
  cushioning?: boolean;
  specificTech: string[];
} {
  const specificTech: string[] = [];

  const hasPlate = (
    normText.includes('placa') ||
    normText.includes('carbono') ||
    normText.includes('nylon') ||
    normText.includes('flyplate') ||
    normText.includes('energy rods')
  );

  const lightweight = (
    normText.includes('leve') ||
    normText.includes('leveza') ||
    normText.includes('baixo peso') ||
    normText.includes('superleve') ||
    normText.includes('peso baixo')
  );

  const cushioning = (
    normText.includes('amortecimento') ||
    normText.includes('macio') ||
    normText.includes('maciez') ||
    normText.includes('confortavel') ||
    normText.includes('conforto') ||
    normText.includes('acolchoado') ||
    normText.includes('absorcao de impacto')
  );

  const knownTechs = [
    'reactx', 'zoomx', 'boost', 'puregel', 'ff blast', 'pwrrun', 'lightstrike',
    'continental', 'vibram', 'contagrip', 'eleva pro', 'infinion', 'oxitec', 'air zoom'
  ];

  for (const tech of knownTechs) {
    if (normText.includes(tech)) {
      specificTech.push(tech);
    }
  }

  return {
    hasPlate: hasPlate ? true : undefined,
    lightweight: lightweight ? true : undefined,
    cushioning: cushioning ? true : undefined,
    specificTech
  };
}

// Extrair intenção especial de ordenação
function extractSpecialIntent(normText: string): 'cheapest' | 'mostExpensive' | 'none' {
  if (
    normText.includes('mais barato') ||
    normText.includes('menor preco') ||
    normText.includes('mais em conta') ||
    normText.includes('mais acessivel') ||
    normText.includes('menor valor') ||
    normText.includes('baratinho')
  ) {
    return 'cheapest';
  }

  if (
    normText.includes('mais caro') ||
    normText.includes('maior preco') ||
    normText.includes('topo de linha') ||
    normText.includes('mais premium') ||
    normText.includes('mais avancado')
  ) {
    return 'mostExpensive';
  }

  return 'none';
}

// Extrair modelo específico mencionado no texto
function extractProductModel(normText: string): Product | null {
  return (
    products.find(p => {
      const nameNorm = normalizeText(p.name);
      return normText.includes(nameNorm) || (nameNorm.includes(' ') && normText.includes(nameNorm.split(' ')[0]) && normText.length > 5);
    }) || null
  );
}

// Validação estrita de critérios objetivos para correspondência exata
function isExactMatch(p: Product, ctx: ChatContext): boolean {
  // 1. Tamanho
  if (ctx.shoeSize !== undefined && !p.sizes.includes(ctx.shoeSize)) {
    return false;
  }

  // 2. Orçamento Máximo
  if (ctx.maxPrice !== undefined && p.price > ctx.maxPrice) {
    return false;
  }

  // 3. Marca
  if (ctx.brand !== undefined && p.brand.toLowerCase() !== ctx.brand.toLowerCase()) {
    return false;
  }

  // 4. Terreno
  if (ctx.surface === 'TRAIL') {
    const isTrail = p.categories.includes('TRAIL') || p.category === 'TRAIL';
    if (!isTrail) return false;
  } else if (ctx.surface === 'ASFALTO') {
    const isOnlyTrail = p.categories.length === 1 && p.categories[0] === 'TRAIL';
    if (isOnlyTrail) return false;
  }

  // 5. Categoria / Finalidade
  if (ctx.runningGoal !== undefined) {
    const hasCat = p.categories.includes(ctx.runningGoal) || p.category === ctx.runningGoal;
    if (!hasCat) return false;
  }

  // 6. Placa de propulsão (se exigida explicitamente)
  if (ctx.hasPlate === true && !productHasPlate(p)) {
    return false;
  }

  return true;
}

// Cálculo de pontuação interna para ordenação de compatibilidade
function calculateProductScore(p: Product, ctx: ChatContext): number {
  let score = 50;

  // Distância informada
  if (ctx.distance === '42km') {
    if (p.categories.includes('LONGA DISTÂNCIA')) score += 25;
    if (p.categories.includes('COMPETIÇÃO')) score += 20;
    if (p.categories.includes('TREINO DIÁRIO')) score += 8;
  } else if (ctx.distance === '21km') {
    if (p.categories.includes('LONGA DISTÂNCIA')) score += 20;
    if (p.categories.includes('COMPETIÇÃO')) score += 15;
    if (p.categories.includes('TREINO DIÁRIO')) score += 10;
  } else if (ctx.distance === '5km' || ctx.distance === '10km') {
    if (p.categories.includes('TREINO DIÁRIO')) score += 20;
    if (p.categories.includes('VELOCIDADE')) score += 15;
  }

  // Leveza solicitada
  if (ctx.lightweight) {
    const numWeight = parseInt(p.weight.replace(/\D/g, ''), 10) || 300;
    if (numWeight <= 210) score += 30;
    else if (numWeight <= 245) score += 20;
    else if (numWeight <= 270) score += 10;
    else score -= 10;
  }

  // Amortecimento solicitado
  if (ctx.cushioning) {
    if (p.categories.includes('LONGA DISTÂNCIA') || p.categories.includes('TREINO DIÁRIO')) score += 15;
    const desc = p.description.toLowerCase();
    if (desc.includes('amortecimento') || desc.includes('conforto') || desc.includes('macia')) score += 10;
  }

  // Tecnologias específicas
  if (ctx.specificTech && ctx.specificTech.length > 0) {
    const techStr = p.technologies.join(' ').toLowerCase();
    for (const st of ctx.specificTech) {
      if (techStr.includes(st)) score += 20;
    }
  }

  // Custo-benefício dentro do orçamento
  if (ctx.maxPrice !== undefined && p.price <= ctx.maxPrice) {
    const diffRatio = (ctx.maxPrice - p.price) / ctx.maxPrice;
    score += Math.round(diffRatio * 15);
  }

  return score;
}

// Cálculo de score para fallback quando não há match perfeito
function calculateFallbackScore(p: Product, ctx: ChatContext): { score: number; brokenReasons: string[] } {
  let score = 100;
  const brokenReasons: string[] = [];

  // Violação de Marca
  if (ctx.brand !== undefined && p.brand.toLowerCase() !== ctx.brand.toLowerCase()) {
    score -= 40;
    brokenReasons.push(`marca (${ctx.brand})`);
  }

  // Violação de Preço
  if (ctx.maxPrice !== undefined && p.price > ctx.maxPrice) {
    const diff = p.price - ctx.maxPrice;
    score -= Math.min(45, 20 + Math.round(diff / 40));
    brokenReasons.push(`orçamento (até R$ ${ctx.maxPrice.toFixed(2).replace('.', ',')})`);
  }

  // Violação de Tamanho
  if (ctx.shoeSize !== undefined && !p.sizes.includes(ctx.shoeSize)) {
    score -= 55;
    brokenReasons.push(`tamanho ${ctx.shoeSize}`);
  }

  // Violação de Terreno
  if (ctx.surface === 'TRAIL' && !p.categories.includes('TRAIL') && p.category !== 'TRAIL') {
    score -= 50;
    brokenReasons.push('terreno trail');
  } else if (ctx.surface === 'ASFALTO' && p.categories.length === 1 && p.categories[0] === 'TRAIL') {
    score -= 40;
    brokenReasons.push('terreno de asfalto');
  }

  // Violação de Categoria
  if (ctx.runningGoal !== undefined && !p.categories.includes(ctx.runningGoal) && p.category !== ctx.runningGoal) {
    score -= 30;
    brokenReasons.push(`categoria ${ctx.runningGoal.toLowerCase()}`);
  }

  // Violação de Placa
  if (ctx.hasPlate === true && !productHasPlate(p)) {
    score -= 35;
    brokenReasons.push('placa de propulsão');
  }

  // Adicionar afinidade geral
  score += calculateProductScore(p, ctx) * 0.2;

  return { score, brokenReasons };
}

// Gerar justificativa dinâmica e contextualizada estritamente com os dados do objeto Product
function buildRecommendationDescription(product: Product, ctx: ChatContext, isFallback: boolean = false): string {
  const priceFormatted = product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const catText = product.categories.join(' e ');

  let sizeInfo = `tamanhos do ${Math.min(...product.sizes)} ao ${Math.max(...product.sizes)}`;
  if (ctx.shoeSize) {
    if (product.sizes.includes(ctx.shoeSize)) {
      sizeInfo = `tamanho ${ctx.shoeSize} disponível`;
    } else {
      sizeInfo = `tamanho ${ctx.shoeSize} indisponível (grade do ${Math.min(...product.sizes)} ao ${Math.max(...product.sizes)})`;
    }
  }

  const techInfo = product.technologies.length > 0
    ? `Tecnologias: ${product.technologies.join(', ')}.`
    : '';

  const specsInfo = `Peso: ${product.weight} | Drop: ${product.drop}.`;

  const fallbackPrefix = isFallback ? '*(Sugestão alternativa)* ' : '';

  return `${fallbackPrefix}• **${product.brand} ${product.name}** (${priceFormatted}): Indicado para **${catText}**, com ${sizeInfo}. ${specsInfo} ${techInfo} ${product.description}`;
}

// Gerar chips de sugestão dinâmicos adaptados ao estado da conversa
function generateDynamicSuggestions(ctx: ChatContext, exactCount: number): string[] {
  const suggestions: string[] = [];

  if (!ctx.shoeSize) {
    suggestions.push('Tamanho 40', 'Tamanho 41');
  }

  if (!ctx.maxPrice) {
    suggestions.push('Até R$ 800', 'Até R$ 1.200');
  }

  if (!ctx.brand) {
    suggestions.push('Opções da Nike', 'Opções da Olympikus', 'Opções da Adidas');
  }

  if (!ctx.runningGoal && !ctx.surface) {
    suggestions.push('Treino diário', 'Longa distância', 'Velocidade', 'Trilha');
  }

  if (exactCount > 1) {
    suggestions.push('Qual o mais barato?');
  }

  suggestions.push('Tem outro modelo?', 'Limpar filtros');

  return Array.from(new Set(suggestions)).slice(0, 4);
}

// Função principal de processamento do Chatbot
export function generateBotResponse(userInput: string, currentContext: ChatContext): BotReply {
  const norm = normalizeText(userInput);
  const updatedContext: ChatContext = { ...currentContext };

  // 1. INTENÇÃO DE RESET / REINÍCIO
  if (
    norm.includes('limpar') ||
    norm.includes('recomecar') ||
    norm.includes('novo filtro') ||
    norm === 'inicio' ||
    norm === 'zerar'
  ) {
    return {
      text: 'Filtros limpos! Me conte: qual é o seu foco de corrida hoje? (Treino diário, longas distâncias, velocidade, competição ou trilha)',
      suggestions: ['Treino diário', 'Longas distâncias', 'Velocidade', 'Opções até R$ 800', 'Me ajude a escolher'],
      context: { ...initialChatContext }
    };
  }

  // 2. EXTRAÇÃO UNIFICADA DE PARÂMETROS
  const { size: detectedSize, clearSize } = extractShoeSize(norm, userInput);
  const { maxPrice: detectedPrice, clearPrice } = extractMaxPrice(norm);
  const { brand: detectedBrand, clearBrand } = extractBrand(norm);
  const detectedGoal = extractGoal(norm);
  const detectedDistance = extractDistance(norm);
  const detectedSurface = extractSurface(norm);
  const technicalPrefs = extractTechnicalFeatures(norm);
  const specialIntent = extractSpecialIntent(norm);
  const specificProduct = extractProductModel(norm);

  // Atualização ou remoção contextual
  if (clearSize) updatedContext.shoeSize = undefined;
  else if (detectedSize !== null) updatedContext.shoeSize = detectedSize;

  if (clearPrice) updatedContext.maxPrice = undefined;
  else if (detectedPrice !== null) updatedContext.maxPrice = detectedPrice;

  if (clearBrand) updatedContext.brand = undefined;
  else if (detectedBrand !== null) updatedContext.brand = detectedBrand;

  if (detectedGoal !== null) updatedContext.runningGoal = detectedGoal;
  if (detectedDistance !== null) updatedContext.distance = detectedDistance;
  if (detectedSurface !== null) updatedContext.surface = detectedSurface;

  if (technicalPrefs.hasPlate !== undefined) updatedContext.hasPlate = technicalPrefs.hasPlate;
  if (technicalPrefs.lightweight !== undefined) updatedContext.lightweight = technicalPrefs.lightweight;
  if (technicalPrefs.cushioning !== undefined) updatedContext.cushioning = technicalPrefs.cushioning;
  if (technicalPrefs.specificTech.length > 0) {
    updatedContext.specificTech = Array.from(new Set([...(updatedContext.specificTech || []), ...technicalPrefs.specificTech]));
  }

  // 3. CONSULTA ESPECÍFICA DE CATEGORIAS DA LOJA
  if (
    norm.includes('quais categorias') ||
    norm.includes('quais tipos') ||
    norm.includes('que categorias') ||
    norm.includes('categorias existem')
  ) {
    return {
      text:
        'No catálogo da RunWay trabalhamos com 5 categorias especializadas de tênis de corrida:\n\n' +
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

  // 4. CONSULTA ESPECÍFICA DE DETALHES DE UM MODELO (ex: "Quanto custa o Pegasus 41?")
  if (
    specificProduct &&
    (norm.includes('quanto custa') ||
      norm.includes('valor') ||
      norm.includes('preco') ||
      norm.includes('informacoes') ||
      norm.includes('detalhes') ||
      norm.includes('me fale do') ||
      norm.includes('conhece o'))
  ) {
    updatedContext.lastRecommendedProducts = [specificProduct];
    updatedContext.recommendedHistoryIds = Array.from(
      new Set([...updatedContext.recommendedHistoryIds, specificProduct.id])
    );

    const priceFormatted = specificProduct.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const techText = specificProduct.technologies.length > 0 ? specificProduct.technologies.join(', ') : 'Nenhuma indicada';

    return {
      text:
        `O **${specificProduct.brand} ${specificProduct.name}** custa **${priceFormatted}**.\n\n` +
        `• **Categorias**: ${specificProduct.categories.join(', ')}\n` +
        `• **Drop**: ${specificProduct.drop} | **Peso**: ${specificProduct.weight}\n` +
        `• **Numerações no catálogo**: ${Math.min(...specificProduct.sizes)} ao ${Math.max(...specificProduct.sizes)}\n` +
        `• **Tecnologias**: ${techText}\n\n` +
        `${specificProduct.description}`,
      recommendations: [specificProduct],
      suggestions: ['Tem no tamanho 40?', 'Tem outro modelo parecido?', 'Ver opções até R$ 800', 'Limpar filtros'],
      context: updatedContext
    };
  }

  // 5. CONSULTA ESPECÍFICA DE ESTOQUE DO ÚLTIMO PRODUTO (ex: "Tem no 39?", "Tem tamanho 40 dele?", "Esse tem no 42?")
  const isExplicitStockInquiry =
    detectedSize !== null &&
    updatedContext.lastRecommendedProducts.length > 0 &&
    (norm.includes('tem no') ||
      norm.includes('tem tamanho') ||
      norm.includes('tem o tamanho') ||
      norm.includes('tem dele') ||
      norm.includes('tem desse') ||
      norm.includes('dele tem') ||
      norm.includes('desse tem') ||
      norm.includes('tem no estoque') ||
      norm.startsWith('tem ') ||
      norm.startsWith('tem?'));

  if (isExplicitStockInquiry) {
    const lastProd = updatedContext.lastRecommendedProducts[0];
    const hasSize = lastProd.sizes.includes(detectedSize!);

    if (hasSize) {
      return {
        text: `Sim! O **${lastProd.brand} ${lastProd.name}** possui o tamanho **${detectedSize}** disponível no nosso estoque (numerações disponíveis: ${Math.min(...lastProd.sizes)} ao ${Math.max(...lastProd.sizes)}).`,
        recommendations: [lastProd],
        suggestions: ['Ver detalhes do produto', 'Tem outra opção nesse tamanho?', 'Ver opções para longão'],
        context: updatedContext
      };
    } else {
      // Encontrar alternativas exatas que possuam o tamanho
      const matchingAlternatives = products.filter(p => p.sizes.includes(detectedSize) && p.id !== lastProd.id).slice(0, 2);
      return {
        text: `O **${lastProd.brand} ${lastProd.name}** não possui o tamanho ${detectedSize} disponível no catálogo (tamanhos disponíveis: ${lastProd.sizes.join(', ')}).\n\nMas separei estes outros modelos que temos no tamanho **${detectedSize}**:`,
        recommendations: matchingAlternatives,
        suggestions: [`Outros modelos tamanho ${detectedSize}`, 'Treino diário', 'Longa distância', 'Limpar filtros'],
        context: updatedContext
      };
    }
  }

  // 6. FOLLOW-UP DE PAGINAÇÃO: "Tem outro?" / "Outra opção"
  if (
    norm.includes('tem outro') ||
    norm.includes('outra opcao') ||
    norm.includes('outras opcoes') ||
    norm.includes('outro modelo') ||
    norm.includes('mais algum') ||
    norm.includes('tem mais') ||
    norm.includes('mostre outro')
  ) {
    const unrecommended = products.filter(p => !updatedContext.recommendedHistoryIds.includes(p.id));
    const validMatches = unrecommended.filter(p => isExactMatch(p, updatedContext));

    if (validMatches.length > 0) {
      validMatches.sort((a, b) => calculateProductScore(b, updatedContext) - calculateProductScore(a, updatedContext));
      const nextBatch = validMatches.slice(0, 3);

      updatedContext.lastRecommendedProducts = nextBatch;
      updatedContext.recommendedHistoryIds = Array.from(
        new Set([...updatedContext.recommendedHistoryIds, ...nextBatch.map(p => p.id)])
      );

      const descriptions = nextBatch.map(p => buildRecommendationDescription(p, updatedContext)).join('\n\n');
      return {
        text: `Aqui estão outras opções do catálogo compatíveis com suas preferências:\n\n${descriptions}`,
        recommendations: nextBatch,
        suggestions: ['Tem mais algum?', 'Qual é o mais barato?', 'Limpar filtros'],
        context: updatedContext
      };
    } else {
      return {
        text: 'Você já visualizou todas as opções do catálogo que atendem exatamente a todos esses critérios. Se desejar, podemos flexibilizar a marca, a faixa de preço ou a categoria!',
        suggestions: ['Ver todas as categorias', 'Sem limite de preço', 'Qualquer marca', 'Limpar filtros'],
        context: updatedContext
      };
    }
  }

  // 7. SAUDAÇÃO PURA OU PERGUNTA GENÉRICA
  const isGenericGreeting = (
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

  if (
    isGenericGreeting &&
    !detectedGoal &&
    !detectedSize &&
    !detectedPrice &&
    !detectedBrand &&
    !detectedDistance &&
    !detectedSurface &&
    !technicalPrefs.hasPlate &&
    !technicalPrefs.lightweight &&
    !technicalPrefs.cushioning
  ) {
    return {
      text: 'Claro! Para te indicar as melhores opções do catálogo RunWay, me conta: você procura um tênis para **treino diário**, **longas distâncias**, **velocidade**, **competição** ou **trilha**?',
      suggestions: ['Treino diário', 'Longas distâncias', 'Velocidade', 'Competição', 'Trilha'],
      context: updatedContext
    };
  }

  // 8. FLUXO PROGRESSIVO INICIAL: Informou apenas objetivo geral em poucas palavras
  const hasOnlyGoal =
    detectedGoal &&
    !updatedContext.shoeSize &&
    !updatedContext.maxPrice &&
    !updatedContext.brand &&
    !updatedContext.distance &&
    norm.split(' ').length <= 4;

  if (hasOnlyGoal) {
    updatedContext.pendingQuestion = 'size';
    return {
      text: `Excelente escolha! Para corridas de **${detectedGoal.toLowerCase()}**, temos ótimos modelos no catálogo.\n\nQual é a sua numeração para que eu verifique a disponibilidade de estoque?`,
      suggestions: ['Tamanho 39', 'Tamanho 40', 'Tamanho 41', 'Tamanho 42', 'Qualquer tamanho'],
      context: updatedContext
    };
  }

  // 9. FILTRAGEM DE CORRESPONDÊNCIA EXATA (VALIDAÇÃO OBJETIVA OBRIGATÓRIA)
  const exactMatches = products.filter(p => isExactMatch(p, updatedContext));

  if (exactMatches.length > 0) {
    // Aplicar ordenação
    if (specialIntent === 'cheapest') {
      exactMatches.sort((a, b) => a.price - b.price);
    } else if (specialIntent === 'mostExpensive') {
      exactMatches.sort((a, b) => b.price - a.price);
    } else {
      exactMatches.sort((a, b) => calculateProductScore(b, updatedContext) - calculateProductScore(a, updatedContext));
    }

    const topPicks = exactMatches.slice(0, 3);
    updatedContext.lastRecommendedProducts = topPicks;
    updatedContext.recommendedHistoryIds = Array.from(
      new Set([...updatedContext.recommendedHistoryIds, ...topPicks.map(p => p.id)])
    );

    // Montar cabeçalho explicativo
    let intro = 'Encontrei excelentes opções no nosso catálogo';
    const criteriaParts: string[] = [];

    if (specialIntent === 'cheapest') criteriaParts.push('com **menor preço**');
    else if (specialIntent === 'mostExpensive') criteriaParts.push('com **maior performance/topo de linha**');

    if (updatedContext.brand) criteriaParts.push(`da marca **${updatedContext.brand}**`);
    if (updatedContext.runningGoal) criteriaParts.push(`para **${updatedContext.runningGoal.toLowerCase()}**`);
    if (updatedContext.distance) criteriaParts.push(`para **${updatedContext.distance}**`);
    if (updatedContext.surface && !updatedContext.runningGoal) criteriaParts.push(`para **${updatedContext.surface.toLowerCase()}**`);
    if (updatedContext.shoeSize) criteriaParts.push(`no **tamanho ${updatedContext.shoeSize}**`);
    if (updatedContext.maxPrice) criteriaParts.push(`com valor de até **${updatedContext.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`);
    if (updatedContext.hasPlate) criteriaParts.push('com **placa de propulsão**');
    if (updatedContext.lightweight) criteriaParts.push('com **baixo peso/leveza**');

    if (criteriaParts.length > 0) {
      intro += ` ${criteriaParts.join(', ')}:`;
    } else {
      intro += ':';
    }

    const descriptions = topPicks.map(p => buildRecommendationDescription(p, updatedContext, false)).join('\n\n');

    return {
      text: `${intro}\n\n${descriptions}`,
      recommendations: topPicks,
      suggestions: generateDynamicSuggestions(updatedContext, exactMatches.length),
      context: updatedContext
    };
  }

  // 10. MECANISMO DE FALLBACK (QUANDO NÃO HÁ CORRESPONDÊNCIA EXATA)
  // Ranqueia os produtos mais próximos calculando as restrições quebradas
  const scoredFallbacks = products.map(p => ({
    product: p,
    ...calculateFallbackScore(p, updatedContext)
  }));

  scoredFallbacks.sort((a, b) => b.score - a.score);
  const bestFallbacks = scoredFallbacks.slice(0, 2);

  // Identificar os critérios solicitados que não puderam ser atendidos
  const unmetDetails: string[] = [];
  if (updatedContext.brand) unmetDetails.push(`marca **${updatedContext.brand}**`);
  if (updatedContext.runningGoal) unmetDetails.push(`categoria **${updatedContext.runningGoal.toLowerCase()}**`);
  if (updatedContext.surface === 'TRAIL' && !updatedContext.runningGoal) unmetDetails.push('terreno de **trilha**');
  if (updatedContext.shoeSize) unmetDetails.push(`tamanho **${updatedContext.shoeSize}**`);
  if (updatedContext.maxPrice) unmetDetails.push(`valor de até **${updatedContext.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`);
  if (updatedContext.hasPlate) unmetDetails.push('com **placa de carbono/propulsão**');

  let fallbackMessage = `Não encontrei no catálogo atual um modelo que atenda a todos esses critérios juntos (${unmetDetails.join(', ')}).\n\n`;

  if (bestFallbacks.length > 0) {
    fallbackMessage += 'As alternativas mais próximas disponíveis no nosso catálogo são:\n\n';
    fallbackMessage += bestFallbacks
      .map(fb => {
        const desc = buildRecommendationDescription(fb.product, updatedContext, true);
        const reasonText = fb.brokenReasons.length > 0
          ? `\n   ↳ *Critério flexibilizado: ${fb.brokenReasons.join(' e ')}.*`
          : '';
        return `${desc}${reasonText}`;
      })
      .join('\n\n');

    updatedContext.lastRecommendedProducts = bestFallbacks.map(f => f.product);
    updatedContext.recommendedHistoryIds = Array.from(
      new Set([...updatedContext.recommendedHistoryIds, ...bestFallbacks.map(f => f.product.id)])
    );

    return {
      text: fallbackMessage,
      recommendations: bestFallbacks.map(f => f.product),
      suggestions: ['Ver todas as categorias', 'Sem limite de preço', 'Qualquer marca', 'Limpar filtros'],
      context: updatedContext
    };
  }

  return {
    text: 'Não encontrei opções disponíveis para essa combinação de filtros. Tente flexibilizar o orçamento, a numeração ou a categoria!',
    suggestions: ['Treino diário', 'Longa distância', 'Velocidade', 'Limpar filtros'],
    context: updatedContext
  };
}
