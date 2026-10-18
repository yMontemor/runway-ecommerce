import type {
  Order,
  CartItem,
  Address,
  Coupon,
  Exchange,
  ExchangeItem,
  Product,
  PedidoResponseDto,
  TrocaResponseDto,
  CupomResponseDto
} from '../types';

/**
 * Converte PedidoResponseDto retornado pela API REST no formato Order utilizado pelo frontend
 */
export function mapPedidoDtoToOrder(dto: PedidoResponseDto, products: Product[]): Order {
  const items: CartItem[] = (dto.itens || []).map(it => {
    const sizeNum = typeof it.tamanho === 'number' ? it.tamanho : parseInt(String(it.tamanho), 10) || 39;
    const existingProduct = products.find(
      p => p.id === it.produtoCodigo || p.name.toLowerCase() === it.produtoNome.toLowerCase()
    );

    const product: Product = existingProduct ? {
      ...existingProduct,
      price: it.precoUnitario,
      image: it.imagemUrl || existingProduct.image
    } : {
      id: it.produtoCodigo || `prod_${it.produtoVariacaoId}`,
      name: it.produtoNome,
      price: it.precoUnitario,
      description: '',
      image: it.imagemUrl || '',
      brand: it.marca || 'RunWay',
      category: 'Tênis',
      categories: ['Tênis'],
      weight: '250g',
      drop: '8mm',
      sizes: [sizeNum],
      color: 'Padrão',
      technologies: [],
      variacoes: [{
        id: it.produtoVariacaoId,
        produtoId: 0,
        tamanho: sizeNum,
        quantidadeEstoque: 10,
        ativo: true
      }]
    };

    return {
      product,
      variacaoId: it.produtoVariacaoId,
      size: sizeNum,
      quantity: it.quantidade,
      itemPedidoId: it.id
    };
  });

  const rawAddr = dto.enderecoEntrega;
  const address: Address = rawAddr ? {
    id: String(rawAddr.enderecoId || 'addr_checkout'),
    label: 'Endereço de Entrega',
    residenceType: rawAddr.tipoResidencia || 'Casa',
    streetType: rawAddr.tipoLogradouro || 'Rua',
    street: rawAddr.logradouro,
    number: rawAddr.numero,
    complement: rawAddr.complemento || '',
    neighborhood: rawAddr.bairro,
    zipCode: rawAddr.cep,
    city: rawAddr.cidade,
    state: rawAddr.estado,
    country: rawAddr.pais || 'Brasil',
    observations: rawAddr.observacoes || '',
    isDelivery: true,
    isBilling: false,
    isResidential: false
  } : {
    id: 'addr_default',
    label: 'Endereço de Entrega',
    street: 'Não informado',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Brasil'
  };

  const paymentMethods = (dto.pagamentos || [])
    .filter(p => p.formaPagamento === 'CARTAO_CREDITO')
    .map((p, idx) => ({
      cardId: p.cartaoId ? String(p.cartaoId) : `card_${p.cartaoUltimosDigitos || idx}`,
      amount: p.valor,
      installments: 1
    }));

  const couponsUsed: Coupon[] = (dto.pagamentos || [])
    .filter(p => p.formaPagamento === 'CUPOM_TROCA' || p.formaPagamento === 'CUPOM_PROMOCIONAL')
    .map(p => ({
      id: String(p.cupomId || `cupom_${p.cupomCodigo}`),
      code: p.cupomCodigo || 'CUPOM',
      type: p.formaPagamento === 'CUPOM_PROMOCIONAL' ? 'promo' : 'exchange',
      value: p.valor,
      description: `Cupom ${p.cupomCodigo}`,
      expirationDate: '',
      customerId: dto.codigoCliente || ''
    }));

  const discountPromo = (dto.pagamentos || [])
    .filter(p => p.formaPagamento === 'CUPOM_PROMOCIONAL')
    .reduce((sum, p) => sum + p.valor, 0);

  const discountExchange = (dto.pagamentos || [])
    .filter(p => p.formaPagamento === 'CUPOM_TROCA')
    .reduce((sum, p) => sum + p.valor, 0);

  const totalDiscount = discountPromo + discountExchange;
  const dateFormatted = dto.dataPedido ? new Date(dto.dataPedido).toLocaleDateString('pt-BR') : '';

  return {
    id: dto.codigo,
    date: dateFormatted,
    customerId: dto.codigoCliente || '',
    status: dto.status as any,
    clientConfirmedReceipt: dto.status === 'ENTREGUE' || dto.status === 'EM TROCA' || dto.status === 'TROCA AUTORIZADA' || dto.status === 'TROCADO',
    items,
    shippingAddress: address,
    paymentMethods,
    couponsUsed,
    subtotal: dto.subtotal,
    shippingCost: dto.valorFrete,
    discountPromo,
    discountExchange,
    discount: totalDiscount,
    total: dto.valorTotal,
    cancellationRefundCouponCode: undefined,
    cardRefundedAmount: undefined
  };
}

/**
 * Converte TrocaResponseDto retornado pela API REST no formato Exchange do frontend
 */
export function mapTrocaDtoToExchange(dto: TrocaResponseDto): Exchange {
  const items: ExchangeItem[] = (dto.itens || []).map(it => ({
    productId: it.codigoProduto,
    productName: it.nomeProduto,
    size: it.tamanho,
    price: it.precoUnitario,
    quantity: it.quantidade
  }));

  const dateFormatted = dto.dataSolicitacao ? new Date(dto.dataSolicitacao).toLocaleDateString('pt-BR') : '';

  return {
    id: dto.codigo,
    orderId: dto.codigoPedido,
    customerId: dto.codigoCliente,
    customerName: dto.nomeCliente,
    items,
    item: items[0],
    totalValue: dto.valorTotal,
    reason: dto.motivo,
    date: dateFormatted,
    status: dto.status as any,
    refundCouponCode: dto.codigoCupom || undefined,
    codigoCupom: dto.codigoCupom || undefined,
    notificacaoCliente: dto.notificacaoCliente || undefined
  };
}

/**
 * Converte CupomResponseDto retornado pela API REST no formato Coupon do frontend
 */
export function mapCupomDtoToCoupon(dto: CupomResponseDto, customerId: string): Coupon {
  const isPromo = dto.tipo.toUpperCase() === 'PROMOCIONAL';
  return {
    id: String(dto.id),
    code: dto.codigo,
    type: isPromo ? 'promo' : 'exchange',
    value: dto.valor,
    description: isPromo ? `Desconto de ${dto.valor}% OFF` : `Crédito de troca no valor de R$ ${dto.valor.toFixed(2)}`,
    expirationDate: 'Indeterminada',
    customerId: customerId
  };
}
