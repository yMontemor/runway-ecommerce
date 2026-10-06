/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Customer, CartItem, Order, Coupon, Exchange, ExchangeItem, Address, CreditCard, NewCustomerInput, Product, ValidacaoEstoqueResponse } from '../types';
import { mockCustomers } from '../data/customers';
import { mockCoupons } from '../data/coupons';
import { products as mockProducts } from '../data/products';
import { produtoService } from '../services/produtoService';
import {
  cadastrarCliente,
  cadastrarEnderecoCliente,
  alterarEnderecoCliente,
  listarEnderecosCliente,
  listarCartoesCliente,
  cadastrarCartaoCliente,
  definirCartaoPreferencial,
  consultarClientes,
  alterarCliente,
  inativarCliente,
  mapListItemDtoToCustomer,
  convertDateIsoToBr,
  type CartaoCreateRequestDto,
  type ClienteUpdateRequestDto
} from '../services/clienteService';

const emptyCustomer: Customer = {
  id: '',
  name: '',
  email: '',
  cpf: '',
  phone: '',
  phoneType: 'Celular',
  phoneDdd: '',
  phoneNumber: '',
  gender: '',
  birthDate: '',
  status: 'ATIVO',
  ranking: 1,
  addresses: [],
  cards: []
};

interface AppContextType {
  customers: Customer[];
  activeCustomer: Customer;
  isLoadingCustomers: boolean;
  customerLoadError: string | null;
  refreshCustomers: () => Promise<void>;
  cartsByCustomer: Record<string, CartItem[]>;
  orders: Order[];
  products: Product[];
  isLoadingProducts: boolean;
  productsLoadError: string | null;
  refreshProducts: () => Promise<void>;
  coupons: Coupon[];
  exchanges: Exchange[];
  setActiveCustomer: (id: string) => void;
  addCustomer: (data: NewCustomerInput) => Promise<{ success: boolean; error?: string; customer?: Customer }>;
  updateCustomerProfile: (codigo: string, payload: ClienteUpdateRequestDto) => Promise<{ success: boolean; error?: string }>;
  inativarCustomer: (codigo: string) => Promise<{ success: boolean; error?: string; mensagem?: string }>;
  addToCart: (productId: string, size: number, quantity: number, variacaoId?: number) => Promise<{ success: boolean; isInactive?: boolean; notReady?: boolean; message?: string }>;
  updateCartQuantity: (productId: string, size: number, delta: number) => Promise<{ success: boolean; message?: string }>;
  validarEstoqueCarrinho: (customerId?: string) => Promise<ValidacaoEstoqueResponse>;
  removeFromCart: (productId: string, size: number) => void;
  clearCart: (customerId: string) => void;
  checkoutCart: (
    shippingAddress: Address,
    paymentCards: { cardId: string; amount: number; installments?: number }[],
    usedCoupons: Coupon[],
    subtotal: number,
    discount: number,
    total: number,
    surplusAmount?: number,
    extraDetails?: {
      shippingCost?: number;
      discountPromo?: number;
      discountExchange?: number;
    }
  ) => Order;
  cancelOrder: (orderId: string) => void;
  confirmOrderReceipt: (orderId: string) => void;
  requestExchange: (
    orderId: string,
    itemsToExchange: { productId: string; size: number; quantity: number }[],
    reason: string
  ) => void;
  updateExchangeStatus: (exchangeId: string, status: Exchange['status'], returnToStockSimulated?: boolean) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  addCustomerAddress: (customerId: string, address: Omit<Address, 'id'>) => Promise<{ success: boolean; error?: string; address?: Address }>;
  updateCustomerAddress: (customerId: string, address: Address) => Promise<{ success: boolean; error?: string; address?: Address }>;
  refreshCustomerAddresses: (customerId: string) => Promise<void>;
  removeCustomerAddress: (customerId: string, addressId: string) => void;
  refreshCustomerCards: (customerId: string) => Promise<void>;
  addCustomerCard: (customerId: string, card: CartaoCreateRequestDto) => Promise<{ success: boolean; error?: string; card?: CreditCard }>;
  updateCustomerCard: (customerId: string, card: CreditCard) => void;
  removeCustomerCard: (customerId: string, cardId: string) => void;
  setCardAsPreferred: (customerId: string, cardId: string) => Promise<{ success: boolean; error?: string; card?: CreditCard }>;
  isChatbotOpen: boolean;
  setIsChatbotOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleChatbot: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser usado dentro de um AppProvider');
  }
  return context;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string>('CLI-0001');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Produtos reais da API
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);

  const carregarProdutos = async () => {
    try {
      setIsLoadingProducts(true);
      setProductsLoadError(null);
      const apiProducts = await produtoService.listar();
      if (apiProducts && apiProducts.length > 0) {
        setProductsList(apiProducts);
      } else {
        setProductsList([]);
        setProductsLoadError('Nenhum produto disponível no catálogo no momento.');
      }
    } catch (err) {
      console.error('Falha ao carregar produtos do backend:', err);
      setProductsList([]);
      setProductsLoadError('Não foi possível carregar os produtos do catálogo. Verifique sua conexão e tente novamente.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  const pendingItemUpdatesRef = useRef<Set<string>>(new Set());

  const toggleChatbot = () => setIsChatbotOpen(prev => !prev);
  
  // Carrinhos isolados por cliente
  const [cartsByCustomer, setCartsByCustomer] = useState<Record<string, CartItem[]>>({
    'CLI-0001': [],
    'CLI-0002': [],
    'CLI-0003': [],
  });

  // Cupons iniciais
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);

  // Pedidos iniciais mockados (com datas coerentes e produtos existentes)
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'RW-2026-001',
      date: '10/05/2026',
      customerId: 'CLI-0001',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: mockProducts.find(p => p.id === 'nike_pegasus_41') || mockProducts[0],
          variacaoId: 8,
          size: 39,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[0],
      paymentMethods: [{ cardId: 'ana_card_1', amount: 899.90, installments: 1 }],
      couponsUsed: [],
      subtotal: 899.90,
      shippingCost: 0,
      discountPromo: 0,
      discountExchange: 0,
      discount: 0,
      total: 899.90
    },
    {
      id: 'RW-2026-002',
      date: '15/06/2026',
      customerId: 'CLI-0002',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: mockProducts.find(p => p.id === 'adidas_terrex_agravic') || mockProducts[2],
          variacaoId: 0,
          size: 42,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[1].addresses[0],
      paymentMethods: [{ cardId: 'carlos_card_1', amount: 999.90, installments: 1 }],
      couponsUsed: [],
      subtotal: 999.90,
      shippingCost: 0,
      discountPromo: 0,
      discountExchange: 0,
      discount: 0,
      total: 999.90
    },
    {
      id: 'RW-2026-003',
      date: '20/08/2026',
      customerId: 'CLI-0001',
      status: 'EM ABERTO',
      items: [
        {
          product: mockProducts.find(p => p.id === 'saucony_triumph_23') || mockProducts[1],
          variacaoId: 0,
          size: 39,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[1],
      paymentMethods: [{ cardId: 'ana_card_2', amount: 1049.90, installments: 1 }],
      couponsUsed: [],
      subtotal: 1049.90,
      shippingCost: 0,
      discountPromo: 0,
      discountExchange: 0,
      discount: 0,
      total: 1049.90
    },
    {
      id: 'RW-2026-004',
      date: '22/08/2026',
      customerId: 'CLI-0001',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: mockProducts.find(p => p.id === 'olympikus_corre_turbo') || mockProducts[0],
          variacaoId: 0,
          size: 39,
          quantity: 2
        },
        {
          product: mockProducts.find(p => p.id === 'saucony_triumph_23') || mockProducts[1],
          variacaoId: 0,
          size: 40,
          quantity: 1
        },
        {
          product: mockProducts.find(p => p.id === 'fila_float_maxxi_2') || mockProducts[0],
          variacaoId: 0,
          size: 39,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[0],
      paymentMethods: [{ cardId: 'ana_card_1', amount: 3949.87, installments: 1 }],
      couponsUsed: [],
      subtotal: 3949.87,
      shippingCost: 0,
      discountPromo: 0,
      discountExchange: 0,
      discount: 0,
      total: 3949.87
    }
  ]);

  // Lista de trocas
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  // Determinar cliente ativo a partir da lista real persistida
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === activeCustomerId) || customers[0] || emptyCustomer;
  }, [customers, activeCustomerId]);

  const setActiveCustomer = (id: string) => {
    setActiveCustomerId(id);
    refreshCustomerAddresses(id);
    refreshCustomerCards(id);
  };

  // Inativação lógica real no PostgreSQL via PATCH /api/clientes/{codigo}/inativar
  const inativarCustomer = async (
    codigo: string
  ): Promise<{ success: boolean; error?: string; mensagem?: string }> => {
    const res = await inativarCliente(codigo);
    if (res.success) {
      setCustomers(prev =>
        prev.map(c =>
          c.id === codigo
            ? { ...c, status: 'INATIVO' }
            : c
        )
      );
      return { success: true, mensagem: res.mensagem };
    }
    return { success: false, error: res.error };
  };

  // Carrega endereços persistidos do PostgreSQL para um cliente
  const refreshCustomerAddresses = useCallback(async (customerId: string) => {
    if (!customerId) return;
    const result = await listarEnderecosCliente(customerId);
    if (result.success && result.addresses) {
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? { ...c, addresses: result.addresses! }
            : c
        )
      );
    }
  }, []);

  // Carrega cartões persistidos do PostgreSQL para um cliente
  const refreshCustomerCards = useCallback(async (customerId: string) => {
    if (!customerId) return;
    const result = await listarCartoesCliente(customerId);
    if (result.success && result.cards) {
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? { ...c, cards: result.cards! }
            : c
        )
      );
    }
  }, []);

  // Carga inicial dos clientes reais persistidos no PostgreSQL
  const carregarClientesReais = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const res = await consultarClientes();
      if (res.success) {
        const mapped = res.clientes.map(mapListItemDtoToCustomer);
        setCustomers(mapped);
        setCustomerLoadError(null);
        if (mapped.length > 0) {
          const exists = mapped.some(c => c.id === activeCustomerId);
          const targetId = exists ? activeCustomerId : mapped[0].id;
          if (!exists) {
            setActiveCustomerId(targetId);
          }
          await Promise.all([
            refreshCustomerAddresses(targetId),
            refreshCustomerCards(targetId)
          ]);
        }
      } else {
        setCustomerLoadError(res.error || 'Não foi possível carregar os clientes do servidor.');
      }
    } catch {
      setCustomerLoadError('Falha de conexão com a API do RunWay.');
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [activeCustomerId, refreshCustomerAddresses, refreshCustomerCards]);

  useEffect(() => {
    carregarClientesReais();
  }, []);

  // Adicionar produto ao carrinho do cliente ativo com validação real de estoque
  const addToCart = async (productId: string, size: number, quantity: number, variacaoId?: number) => {
    if (!activeCustomer.id || isLoadingCustomers) {
      return {
        success: false,
        notReady: true
      };
    }

    if (activeCustomer.status === 'INATIVO') {
      return { success: false, isInactive: true };
    }

    const product = productsList.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Produto não encontrado no catálogo.' };

    // Identificar a variação selecionada (por tamanho ou ID)
    const variacao = product.variacoes?.find(v => v.tamanho === size)
      || (variacaoId ? product.variacoes?.find(v => v.id === variacaoId) : undefined);

    const realVariacaoId = variacao?.id ?? 0;
    const customerId = activeCustomer.id;
    const customerCart = cartsByCustomer[customerId] || [];
    const existingItemIndex = customerCart.findIndex(
      item => item.product.id === productId && item.size === size
    );

    const currentQty = existingItemIndex > -1 ? customerCart[existingItemIndex].quantity : 0;
    const proposedQty = currentQty + quantity;

    // Validação real de estoque no backend se a variação for conhecida
    if (realVariacaoId > 0) {
      try {
        const validacao = await produtoService.validarEstoque([
          { produtoVariacaoId: realVariacaoId, quantidade: proposedQty }
        ]);

        if (!validacao.valido) {
          const itemInvalido = validacao.itens.find(i => !i.disponivel);
          const msg = itemInvalido?.mensagem || validacao.mensagem;
          return { success: false, message: msg };
        }
      } catch (err) {
        console.error('Erro ao validar estoque no backend ao adicionar:', err);
        return { success: false, message: 'Não foi possível validar o estoque. Tente novamente.' };
      }
    } else if (variacao && proposedQty > variacao.quantidadeEstoque) {
      const msg = variacao.quantidadeEstoque <= 0
        ? 'Este tamanho está esgotado no momento.'
        : `Há apenas ${variacao.quantidadeEstoque} unidades disponíveis deste produto.`;
      return { success: false, message: msg };
    }

    setCartsByCustomer(prev => {
      const cart = prev[customerId] || [];
      let updatedCart: CartItem[];
      if (existingItemIndex > -1) {
        updatedCart = [...cart];
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          variacaoId: realVariacaoId,
          quantity: proposedQty
        };
      } else {
        updatedCart = [...cart, { product, variacaoId: realVariacaoId, size, quantity }];
      }

      return {
        ...prev,
        [customerId]: updatedCart
      };
    });

    return { success: true };
  };

  // Atualizar quantidade no carrinho com validação real de estoque ao incrementar
  const updateCartQuantity = async (productId: string, size: number, delta: number): Promise<{ success: boolean; message?: string }> => {
    const itemKey = `${productId}-${size}`;
    if (pendingItemUpdatesRef.current.has(itemKey)) {
      return { success: false, message: 'Alteração já em andamento para este item.' };
    }

    pendingItemUpdatesRef.current.add(itemKey);
    try {
      const customerId = activeCustomer.id;
      if (!customerId) return { success: false, message: 'Cliente não selecionado.' };

      const customerCart = cartsByCustomer[customerId] || [];
      const item = customerCart.find(i => i.product.id === productId && i.size === size);
      if (!item) return { success: false, message: 'Item não encontrado no carrinho.' };

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        removeFromCart(productId, size);
        return { success: true };
      }

      // Se está aumentando a quantidade, validar estoque real no backend
      if (delta > 0 && item.variacaoId > 0) {
        try {
          const validacao = await produtoService.validarEstoque([
            { produtoVariacaoId: item.variacaoId, quantidade: newQty }
          ]);

          if (!validacao.valido) {
            const itemInvalido = validacao.itens.find(i => !i.disponivel);
            const msg = itemInvalido?.mensagem || validacao.mensagem;
            return { success: false, message: msg };
          }
        } catch (err) {
          console.error('Erro ao verificar estoque na alteração de quantidade:', err);
          return { success: false, message: 'Não foi possível verificar o estoque no momento.' };
        }
      }

      setCartsByCustomer(prev => {
        const cart = prev[customerId] || [];
        const updatedCart = cart
          .map(i => {
            if (i.product.id === productId && i.size === size) {
              return { ...i, quantity: newQty };
            }
            return i;
          })
          .filter(i => i.quantity > 0);

        return {
          ...prev,
          [customerId]: updatedCart
        };
      });

      return { success: true };
    } finally {
      pendingItemUpdatesRef.current.delete(itemKey);
    }
  };

  // Validação de estoque de todos os itens do carrinho antes do checkout
  const validarEstoqueCarrinho = async (customerId?: string): Promise<ValidacaoEstoqueResponse> => {
    const targetId = customerId || activeCustomer.id;
    const cart = cartsByCustomer[targetId] || [];
    if (cart.length === 0) {
      return { valido: true, mensagem: 'Carrinho vazio.', itens: [] };
    }

    const itensComVariacao = cart.filter(i => i.variacaoId > 0);
    if (itensComVariacao.length === 0) {
      return { valido: true, mensagem: 'Todos os itens estão disponíveis.', itens: [] };
    }

    try {
      return await produtoService.validarEstoque(
        itensComVariacao.map(i => ({ produtoVariacaoId: i.variacaoId, quantidade: i.quantity }))
      );
    } catch (err) {
      console.error('Erro na validação pré-checkout de estoque:', err);
      return {
        valido: false,
        mensagem: 'Não foi possível validar o estoque antes do checkout. Tente novamente.',
        itens: []
      };
    }
  };

  // Remover do carrinho
  const removeFromCart = (productId: string, size: number) => {
    const customerId = activeCustomer.id;
    if (!customerId) return;

    setCartsByCustomer(prev => {
      const customerCart = prev[customerId] || [];
      const updatedCart = customerCart.filter(
        item => !(item.product.id === productId && item.size === size)
      );

      return {
        ...prev,
        [customerId]: updatedCart
      };
    });
  };

  const clearCart = (customerId: string) => {
    if (!customerId) return;
    setCartsByCustomer(prev => ({
      ...prev,
      [customerId]: []
    }));
  };

  // Finalizar Compra
  const checkoutCart = (
    shippingAddress: Address,
    paymentCards: { cardId: string; amount: number; installments?: number }[],
    usedCoupons: Coupon[],
    subtotal: number,
    discount: number,
    total: number,
    surplusAmount?: number,
    extraDetails?: {
      shippingCost?: number;
      discountPromo?: number;
      discountExchange?: number;
    }
  ) => {
    const customerId = activeCustomer.id;
    if (!customerId) {
      throw new Error('Não é possível realizar checkout sem um cliente válido.');
    }
    const customerCart = cartsByCustomer[customerId] || [];
    const newOrderId = `RW-2026-00${orders.length + 1}`;
    
    const newOrder: Order = {
      id: newOrderId,
      date: new Date().toLocaleDateString('pt-BR'),
      customerId: customerId,
      status: 'EM ABERTO',
      items: [...customerCart],
      shippingAddress: { ...shippingAddress },
      paymentMethods: paymentCards.map(c => ({
        cardId: c.cardId,
        amount: c.amount,
        installments: c.installments ?? 1
      })),
      couponsUsed: usedCoupons,
      subtotal,
      shippingCost: extraDetails?.shippingCost ?? 0,
      discountPromo: extraDetails?.discountPromo ?? 0,
      discountExchange: extraDetails?.discountExchange ?? 0,
      discount,
      total
    };

    // Registrar Pedido
    setOrders(prev => [newOrder, ...prev]);

    // Invalidadar cupons de uso único utilizados
    const usedCouponCodes = usedCoupons.map(c => c.code);

    // Gerar novo cupom com o saldo excedente se houver
    const exchangeCoupon = usedCoupons.find(c => c.type === 'exchange');
    let newSurplusCoupon: Coupon | null = null;
    if (exchangeCoupon && surplusAmount && surplusAmount > 0.005) {
      const surplusCode = `TROCA-RW-${Math.floor(1000 + Math.random() * 9000)}`;
      newSurplusCoupon = {
        id: `coupon_${Math.random().toString(36).substr(2, 9)}`,
        code: surplusCode,
        type: 'exchange',
        value: parseFloat(surplusAmount.toFixed(2)),
        description: `Saldo restante de troca (${exchangeCoupon.code})`,
        expirationDate: exchangeCoupon.expirationDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        customerId: customerId
      };
    }

    setCoupons(prev => {
      const filtered = prev.filter(c => !usedCouponCodes.includes(c.code));
      return newSurplusCoupon ? [...filtered, newSurplusCoupon] : filtered;
    });

    // Limpar o carrinho deste cliente
    clearCart(customerId);

    return newOrder;
  };

  // Cancelar Pedido
  const cancelOrder = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || targetOrder.status !== 'EM ABERTO') return;

    // 1. Calcular o valor efetivamente consumido do cupom de troca
    const exchangeAmountUsed = targetOrder.discountExchange ?? 
      (targetOrder.couponsUsed.find(c => c.type === 'exchange')?.value ?? 0);

    let newRefundCouponCode: string | undefined;

    // Se houve uso de cupom de troca, gerar um NOVO cupom de ressarcimento
    if (exchangeAmountUsed > 0.005) {
      newRefundCouponCode = `TROCA-REFUND-${Math.floor(1000 + Math.random() * 9000)}`;
      const newRefundCoupon: Coupon = {
        id: `coupon_${Math.random().toString(36).substr(2, 9)}`,
        code: newRefundCouponCode,
        type: 'exchange',
        value: parseFloat(exchangeAmountUsed.toFixed(2)),
        description: `Ressarcimento de cupom de troca do pedido cancelado ${targetOrder.id}`,
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        customerId: targetOrder.customerId
      };
      setCoupons(prev => [...prev, newRefundCoupon]);
    }

    // 2. Total pago em cartão para registrar estorno
    const cardTotalPaid = targetOrder.paymentMethods.reduce((sum, p) => sum + p.amount, 0);

    // 3. Atualizar status para CANCELADO
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              status: 'CANCELADO',
              cancellationRefundCouponCode: newRefundCouponCode,
              cardRefundedAmount: cardTotalPaid > 0 ? cardTotalPaid : undefined
            }
          : o
      )
    );
  };

  // Confirmar Recebimento pelo Cliente
  const confirmOrderReceipt = (orderId: string) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId && o.status === 'ENTREGUE'
          ? { ...o, clientConfirmedReceipt: true }
          : o
      )
    );
  };

  // Solicitar Troca
  const requestExchange = (
    orderId: string,
    itemsToExchange: { productId: string; size: number; quantity: number }[],
    reason: string
  ) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || itemsToExchange.length === 0) return;

    const matchedItems: ExchangeItem[] = [];
    let totalExchangeValue = 0;

    for (const req of itemsToExchange) {
      const orderItem = order.items.find(i => i.product.id === req.productId && i.size === req.size);
      if (orderItem) {
        const validQty = Math.max(1, Math.min(req.quantity, orderItem.quantity));
        matchedItems.push({
          productId: orderItem.product.id,
          productName: orderItem.product.name,
          size: orderItem.size,
          price: orderItem.product.price,
          quantity: validQty
        });
        totalExchangeValue += orderItem.product.price * validQty;
      }
    }

    if (matchedItems.length === 0) return;

    const customerObj = customers.find(c => c.id === order.customerId);

    const newExchangeId = `EXC-${Math.floor(100000 + Math.random() * 900000)}`;
    const newExchange: Exchange = {
      id: newExchangeId,
      orderId,
      customerId: order.customerId,
      customerName: customerObj ? customerObj.name : activeCustomer.name,
      items: matchedItems,
      item: matchedItems[0], // retrocompatibilidade
      totalValue: parseFloat(totalExchangeValue.toFixed(2)),
      reason,
      date: new Date().toLocaleDateString('pt-BR'),
      status: 'TROCA SOLICITADA'
    };

    setExchanges(prev => [newExchange, ...prev]);
    
    // Atualizar o status e itens de troca no próprio pedido
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              exchangeStatus: 'TROCA SOLICITADA',
              exchangeItems: matchedItems,
              exchangeItemId: matchedItems[0]?.productId,
              exchangeItemSize: matchedItems[0]?.size,
              exchangeReason: reason
            }
          : o
      )
    );
  };

  // Fluxo de Troca (Administrador / Cliente)
  const updateExchangeStatus = (exchangeId: string, status: Exchange['status'], returnToStockSimulated: boolean = false) => {
    if (returnToStockSimulated) {
      console.log(`[Reativo Simulação] Itens da troca ${exchangeId} retornados ao estoque.`);
    }

    const exchange = exchanges.find(exc => exc.id === exchangeId);

    // Se for finalizado como TROCA PROCESSADA, gera cupom automaticamente correspondente ao valor total dos itens devolvidos
    let couponCode: string | undefined;
    if (exchange && status === 'TROCA PROCESSADA') {
      couponCode = `TROCA-RW-${Math.floor(1000 + Math.random() * 9000)}`;

      const totalAmount = exchange.totalValue ?? (
        exchange.items && exchange.items.length > 0
          ? exchange.items.reduce((sum, it) => sum + it.price * it.quantity, 0)
          : (exchange.item ? exchange.item.price : 0)
      );

      const newCoupon: Coupon = {
        id: `coupon_${Math.random().toString(36).substr(2, 9)}`,
        code: couponCode,
        type: 'exchange',
        value: parseFloat(totalAmount.toFixed(2)),
        description: `Crédito de troca do pedido ${exchange.orderId}`,
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'), // 3 meses
        customerId: exchange.customerId
      };

      setCoupons(prev => [...prev, newCoupon]);
    }

    setExchanges(prev =>
      prev.map(exc => {
        if (exc.id === exchangeId) {
          return {
            ...exc,
            status,
            ...(couponCode ? { refundCouponCode: couponCode } : {})
          };
        }
        return exc;
      })
    );

    // Sincronizar com o pedido
    if (exchange) {
      setOrders(prev =>
        prev.map(o =>
          o.id === exchange.orderId
            ? { ...o, exchangeStatus: status }
            : o
        )
      );
    }
  };

  // Atualizar Status do Pedido (Avanço no Painel Admin)
  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status } : o))
    );
  };

  // Cadastrar Novo Cliente (RF0021, RN0021, RN0022, RN0023, RN0026, RNF0031, RNF0032, RNF0033, RNF0035)
  const addCustomer = async (data: NewCustomerInput): Promise<{ success: boolean; error?: string; customer?: Customer }> => {
    // Comunicação real com a API POST /api/clientes via clienteService
    const result = await cadastrarCliente(data);

    if (result.success && result.customer) {
      // Atualiza o estado da lista de clientes com o registro persistido
      setCustomers(prev => [...prev, result.customer!]);
      setActiveCustomerId(result.customer.id);

      // Inicializa carrinho em memória para o novo código de cliente
      setCartsByCustomer(prev => ({
        ...prev,
        [result.customer!.id]: []
      }));

      // Carrega endereços e cartões do novo cliente persistido
      await Promise.all([
        refreshCustomerAddresses(result.customer.id),
        refreshCustomerCards(result.customer.id)
      ]);
    }

    return result;
  };

  // Editar Perfil do Cliente (RF0022 - Comunicação real via PUT /api/clientes/{codigo})
  const updateCustomerProfile = async (
    codigo: string,
    payload: ClienteUpdateRequestDto
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await alterarCliente(codigo, payload);
    if (res.success && res.cliente) {
      const updatedDto = res.cliente;
      const phoneDdd = updatedDto.telefone.ddd;
      const phoneNum = updatedDto.telefone.numero;
      const formattedPhoneNum =
        phoneNum.length === 9
          ? `${phoneNum.slice(0, 5)}-${phoneNum.slice(5)}`
          : phoneNum.length === 8
            ? `${phoneNum.slice(0, 4)}-${phoneNum.slice(4)}`
            : phoneNum;
      const derivedPhone = `(${phoneDdd}) ${formattedPhoneNum}`;

      setCustomers(prev =>
        prev.map(c => {
          if (c.id === codigo) {
            return {
              ...c,
              name: updatedDto.nome,
              email: updatedDto.email,
              gender: updatedDto.genero,
              birthDate: convertDateIsoToBr(updatedDto.dataNascimento),
              phone: derivedPhone,
              phoneType: updatedDto.telefone.tipo,
              phoneDdd,
              phoneNumber: formattedPhoneNum
            };
          }
          return c;
        })
      );
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Endereços (Card #51 - Gestão de Endereços)
  const addCustomerAddress = async (
    customerId: string,
    address: Omit<Address, 'id'>
  ): Promise<{ success: boolean; error?: string; address?: Address }> => {
    const result = await cadastrarEnderecoCliente(customerId, address);
    if (result.success && result.address) {
      const savedAddress = result.address;
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? { ...c, addresses: [...c.addresses, savedAddress] }
            : c
        )
      );
      return { success: true, address: savedAddress };
    }
    return { success: false, error: result.error };
  };

  const updateCustomerAddress = async (
    customerId: string,
    address: Address
  ): Promise<{ success: boolean; error?: string; address?: Address }> => {
    const result = await alterarEnderecoCliente(customerId, address.id, address);
    if (result.success && result.address) {
      const savedAddress = result.address;
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? {
                ...c,
                addresses: c.addresses.map(a => (a.id === address.id ? savedAddress : a))
              }
            : c
        )
      );
      return { success: true, address: savedAddress };
    }
    return { success: false, error: result.error };
  };

  const removeCustomerAddress = (customerId: string, addressId: string) => {
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          // Proteção do protótipo: impede remoção se restar apenas 1 endereço
          if (c.addresses.length <= 1) return c;
          return {
            ...c,
            addresses: c.addresses.filter(a => a.id !== addressId)
          };
        }
        return c;
      })
    );
  };

  const addCustomerCard = async (
    customerId: string,
    card: CartaoCreateRequestDto
  ): Promise<{ success: boolean; error?: string; card?: CreditCard }> => {
    const result = await cadastrarCartaoCliente(customerId, card);
    if (result.success && result.card) {
      const savedCard = result.card;
      setCustomers(prev =>
        prev.map(c => {
          if (c.id === customerId) {
            let updatedCards = [...c.cards];
            if (savedCard.isPreferred) {
              updatedCards = updatedCards.map(x => ({ ...x, isPreferred: false }));
            }
            return { ...c, cards: [...updatedCards, savedCard] };
          }
          return c;
        })
      );
      return { success: true, card: savedCard };
    }

    return { success: false, error: result.error };
  };

  const updateCustomerCard = (customerId: string, updatedCard: CreditCard) => {
    const cleanNumber = updatedCard.cardNumber ? updatedCard.cardNumber.replace(/\D/g, '') : '';
    const derivedLastFour = cleanNumber.length >= 4 
      ? cleanNumber.slice(-4) 
      : (updatedCard.lastFour || '1234');

    const cardToSave: CreditCard = {
      ...updatedCard,
      lastFour: derivedLastFour,
      holderName: updatedCard.holderName.toUpperCase()
    };

    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          let cards = c.cards.map(card => (card.id === cardToSave.id ? cardToSave : card));
          if (cardToSave.isPreferred) {
            cards = cards.map(x => ({
              ...x,
              isPreferred: x.id === cardToSave.id
            }));
          }
          return { ...c, cards };
        }
        return c;
      })
    );
  };

  const removeCustomerCard = (customerId: string, cardId: string) => {
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          const removedCard = c.cards.find(x => x.id === cardId);
          const remainingCards = c.cards.filter(x => x.id !== cardId);
          
          // Se o preferencial foi removido e sobrou algum cartão, torna o primeiro como preferencial
          if (removedCard?.isPreferred && remainingCards.length > 0) {
            remainingCards[0].isPreferred = true;
          }
          return { ...c, cards: remainingCards };
        }
        return c;
      })
    );
  };

  const setCardAsPreferred = async (
    customerId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; card?: CreditCard }> => {
    const result = await definirCartaoPreferencial(customerId, cardId);
    if (result.success && result.card) {
      const preferredCard = result.card;
      setCustomers(prev =>
        prev.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              cards: c.cards.map(card => ({
                ...card,
                isPreferred: card.id === preferredCard.id
              }))
            };
          }
          return c;
        })
      );
      return { success: true, card: preferredCard };
    }

    return { success: false, error: result.error };
  };

  return (
    <AppContext.Provider
      value={{
        products: productsList,
        isLoadingProducts,
        productsLoadError,
        refreshProducts: carregarProdutos,
        customers,
        activeCustomer,
        isLoadingCustomers,
        customerLoadError,
        refreshCustomers: carregarClientesReais,
        cartsByCustomer,
        orders,
        coupons,
        exchanges,
        setActiveCustomer,
        addCustomer,
        updateCustomerProfile,
        inativarCustomer,
        addToCart,
        updateCartQuantity,
        validarEstoqueCarrinho,
        removeFromCart,
        clearCart,
        checkoutCart,
        cancelOrder,
        confirmOrderReceipt,
        requestExchange,
        updateExchangeStatus,
        updateOrderStatus,
        addCustomerAddress,
        updateCustomerAddress,
        refreshCustomerAddresses,
        removeCustomerAddress,
        refreshCustomerCards,
        addCustomerCard,
        updateCustomerCard,
        removeCustomerCard,
        setCardAsPreferred,
        isChatbotOpen,
        setIsChatbotOpen,
        toggleChatbot
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
