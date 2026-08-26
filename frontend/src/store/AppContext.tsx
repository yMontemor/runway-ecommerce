/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Customer, CartItem, Order, Coupon, Exchange, ExchangeItem, Address, CreditCard } from '../types';
import { mockCustomers } from '../data/customers';
import { mockCoupons } from '../data/coupons';
import { products } from '../data/products';

interface AppContextType {
  customers: Customer[];
  activeCustomer: Customer;
  cartsByCustomer: Record<string, CartItem[]>;
  orders: Order[];
  coupons: Coupon[];
  exchanges: Exchange[];
  setActiveCustomer: (id: string) => void;
  updateCustomerStatus: (id: string, status: 'ATIVO' | 'INATIVO') => void;
  addToCart: (productId: string, size: number, quantity: number) => { success: boolean; isInactive?: boolean };
  updateCartQuantity: (productId: string, size: number, delta: number) => void;
  removeFromCart: (productId: string, size: number) => void;
  clearCart: (customerId: string) => void;
  checkoutCart: (
    shippingAddress: Address,
    paymentCards: { cardId: string; amount: number }[],
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
  updateCustomerProfile: (updatedCustomer: Customer) => void;
  addCustomerAddress: (customerId: string, address: Omit<Address, 'id'>) => void;
  updateCustomerAddress: (customerId: string, address: Address) => void;
  removeCustomerAddress: (customerId: string, addressId: string) => void;
  addCustomerCard: (customerId: string, card: Omit<CreditCard, 'id'>) => CreditCard;
  updateCustomerCard: (customerId: string, card: CreditCard) => void;
  removeCustomerCard: (customerId: string, cardId: string) => void;
  setCardAsPreferred: (customerId: string, cardId: string) => void;
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
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [activeCustomerId, setActiveCustomerId] = useState<string>('ana_carolina');
  
  // Carrinhos isolados por cliente
  const [cartsByCustomer, setCartsByCustomer] = useState<Record<string, CartItem[]>>({
    ana_carolina: [],
    carlos_roberto: [],
    maria_oliveira: [],
  });

  // Cupons iniciais
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);

  // Pedidos iniciais mockados (com datas coerentes e produtos existentes)
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'RW-2026-001',
      date: '10/05/2026',
      customerId: 'ana_carolina',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: products.find(p => p.id === 'nike_pegasus_41') || products[0],
          size: 39,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[0],
      paymentMethods: [{ cardId: 'ana_card_1', amount: 899.90 }],
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
      customerId: 'carlos_roberto',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: products.find(p => p.id === 'adidas_terrex_agravic') || products[2],
          size: 42,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[1].addresses[0],
      paymentMethods: [{ cardId: 'carlos_card_1', amount: 999.90 }],
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
      customerId: 'ana_carolina',
      status: 'EM ABERTO',
      items: [
        {
          product: products.find(p => p.id === 'saucony_triumph_23') || products[1],
          size: 39,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[1],
      paymentMethods: [{ cardId: 'ana_card_2', amount: 1049.90 }],
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
      customerId: 'ana_carolina',
      status: 'ENTREGUE',
      clientConfirmedReceipt: true,
      items: [
        {
          product: products.find(p => p.id === 'olympikus_corre_turbo') || products[0],
          size: 39,
          quantity: 2
        },
        {
          product: products.find(p => p.id === 'saucony_triumph_23') || products[1],
          size: 40,
          quantity: 1
        },
        {
          product: products.find(p => p.id === 'olympikus_corre_turbo') || products[0],
          size: 44,
          quantity: 1
        }
      ],
      shippingAddress: mockCustomers[0].addresses[0],
      paymentMethods: [{ cardId: 'ana_card_1', amount: 3949.87 }],
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

  // Determinar cliente ativo
  const activeCustomer = customers.find(c => c.id === activeCustomerId) || customers[0];

  const setActiveCustomer = (id: string) => {
    setActiveCustomerId(id);
  };

  // Alteração de status (ATIVO/INATIVO)
  const updateCustomerStatus = (id: string, status: 'ATIVO' | 'INATIVO') => {
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, status } : c))
    );
  };

  // Adicionar produto ao carrinho do cliente ativo
  const addToCart = (productId: string, size: number, quantity: number) => {
    if (activeCustomer.status === 'INATIVO') {
      return { success: false, isInactive: true };
    }

    const product = products.find(p => p.id === productId);
    if (!product) return { success: false };

    setCartsByCustomer(prev => {
      const customerCart = prev[activeCustomerId] || [];
      const existingItemIndex = customerCart.findIndex(
        item => item.product.id === productId && item.size === size
      );

      let updatedCart;
      if (existingItemIndex > -1) {
        updatedCart = [...customerCart];
        updatedCart[existingItemIndex].quantity += quantity;
      } else {
        updatedCart = [...customerCart, { product, size, quantity }];
      }

      return {
        ...prev,
        [activeCustomerId]: updatedCart
      };
    });

    return { success: true };
  };

  // Atualizar quantidade no carrinho
  const updateCartQuantity = (productId: string, size: number, delta: number) => {
    setCartsByCustomer(prev => {
      const customerCart = prev[activeCustomerId] || [];
      const updatedCart = customerCart
        .map(item => {
          if (item.product.id === productId && item.size === size) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(item => item.quantity > 0);

      return {
        ...prev,
        [activeCustomerId]: updatedCart
      };
    });
  };

  // Remover do carrinho
  const removeFromCart = (productId: string, size: number) => {
    setCartsByCustomer(prev => {
      const customerCart = prev[activeCustomerId] || [];
      const updatedCart = customerCart.filter(
        item => !(item.product.id === productId && item.size === size)
      );

      return {
        ...prev,
        [activeCustomerId]: updatedCart
      };
    });
  };

  const clearCart = (customerId: string) => {
    setCartsByCustomer(prev => ({
      ...prev,
      [customerId]: []
    }));
  };

  // Finalizar Compra
  const checkoutCart = (
    shippingAddress: Address,
    paymentCards: { cardId: string; amount: number }[],
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
    const customerCart = cartsByCustomer[activeCustomerId] || [];
    const newOrderId = `RW-2026-00${orders.length + 1}`;
    
    const newOrder: Order = {
      id: newOrderId,
      date: new Date().toLocaleDateString('pt-BR'),
      customerId: activeCustomerId,
      status: 'EM ABERTO',
      items: [...customerCart],
      shippingAddress: { ...shippingAddress },
      paymentMethods: paymentCards,
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
        customerId: activeCustomerId
      };
    }

    setCoupons(prev => {
      const filtered = prev.filter(c => !usedCouponCodes.includes(c.code));
      return newSurplusCoupon ? [...filtered, newSurplusCoupon] : filtered;
    });

    // Limpar o carrinho deste cliente
    clearCart(activeCustomerId);

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

  // Editar Perfil do Cliente
  const updateCustomerProfile = (updatedCustomer: Customer) => {
    setCustomers(prev =>
      prev.map(c => (c.id === updatedCustomer.id ? { ...updatedCustomer, cpf: c.cpf } : c))
    );
  };

  // Endereços
  const addCustomerAddress = (customerId: string, address: Omit<Address, 'id'>) => {
    const newAddress: Address = {
      ...address,
      id: `addr_${Math.random().toString(36).substr(2, 9)}`
    };

    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, addresses: [...c.addresses, newAddress] }
          : c
      )
    );
  };

  const updateCustomerAddress = (customerId: string, address: Address) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? {
              ...c,
              addresses: c.addresses.map(a => (a.id === address.id ? address : a))
            }
          : c
      )
    );
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

  // Cartões
  const addCustomerCard = (customerId: string, card: Omit<CreditCard, 'id'>): CreditCard => {
    const cleanNumber = card.cardNumber ? card.cardNumber.replace(/\D/g, '') : '';
    const derivedLastFour = cleanNumber.length >= 4 
      ? cleanNumber.slice(-4) 
      : (card.lastFour || '1234');

    const newCard: CreditCard = {
      ...card,
      cardNumber: card.cardNumber,
      lastFour: derivedLastFour,
      id: `card_${Math.random().toString(36).substr(2, 9)}`
    };

    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          const cards = [...c.cards];
          // Se for o primeiro ou estiver marcado como preferencial, remove preferência dos outros
          if (newCard.isPreferred || cards.length === 0) {
            newCard.isPreferred = true;
            cards.forEach(x => (x.isPreferred = false));
          }
          return { ...c, cards: [...cards, newCard] };
        }
        return c;
      })
    );

    return newCard;
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

  const setCardAsPreferred = (customerId: string, cardId: string) => {
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          return {
            ...c,
            cards: c.cards.map(card => ({
              ...card,
              isPreferred: card.id === cardId
            }))
          };
        }
        return c;
      })
    );
  };

  return (
    <AppContext.Provider
      value={{
        customers,
        activeCustomer,
        cartsByCustomer,
        orders,
        coupons,
        exchanges,
        setActiveCustomer,
        updateCustomerStatus,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        checkoutCart,
        cancelOrder,
        confirmOrderReceipt,
        requestExchange,
        updateExchangeStatus,
        updateOrderStatus,
        updateCustomerProfile,
        addCustomerAddress,
        updateCustomerAddress,
        removeCustomerAddress,
        addCustomerCard,
        updateCustomerCard,
        removeCustomerCard,
        setCardAsPreferred
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
