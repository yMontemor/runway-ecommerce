/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Customer, CartItem, Order, Coupon, Exchange, Address, CreditCard } from '../types';
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
    total: number
  ) => Order;
  cancelOrder: (orderId: string) => void;
  requestExchange: (orderId: string, productId: string, size: number, reason: string) => void;
  updateExchangeStatus: (exchangeId: string, status: Exchange['status'], returnToStockSimulated?: boolean) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateCustomerProfile: (updatedCustomer: Customer) => void;
  addCustomerAddress: (customerId: string, address: Omit<Address, 'id'>) => void;
  updateCustomerAddress: (customerId: string, address: Address) => void;
  addCustomerCard: (customerId: string, card: Omit<CreditCard, 'id'>) => void;
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
      discount: 0,
      total: 899.90
    },
    {
      id: 'RW-2026-002',
      date: '15/06/2026',
      customerId: 'carlos_roberto',
      status: 'ENTREGUE',
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
      discount: 0,
      total: 1049.90
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
    total: number
  ) => {
    const customerCart = cartsByCustomer[activeCustomerId] || [];
    const newOrderId = `RW-2026-00${orders.length + 1}`;
    
    const newOrder: Order = {
      id: newOrderId,
      date: new Date().toLocaleDateString('pt-BR'),
      customerId: activeCustomerId,
      status: 'EM ABERTO',
      items: [...customerCart],
      shippingAddress,
      paymentMethods: paymentCards,
      couponsUsed: usedCoupons,
      subtotal,
      discount,
      total
    };

    // Registrar Pedido
    setOrders(prev => [newOrder, ...prev]);

    // Invalidadar cupons de uso único utilizados
    const usedCouponCodes = usedCoupons.map(c => c.code);
    setCoupons(prev => prev.filter(c => !usedCouponCodes.includes(c.code)));

    // Limpar o carrinho deste cliente
    clearCart(activeCustomerId);

    return newOrder;
  };

  // Cancelar Pedido
  const cancelOrder = (orderId: string) => {
    setOrders(prev =>
      prev.map(o => (o.id === orderId && o.status === 'EM ABERTO' ? { ...o, status: 'CANCELADO' } : o))
    );
  };

  // Solicitar Troca
  const requestExchange = (orderId: string, productId: string, size: number, reason: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const item = order.items.find(i => i.product.id === productId && i.size === size);
    if (!item) return;

    const newExchangeId = `EXC-${Math.floor(100000 + Math.random() * 900000)}`;
    const newExchange: Exchange = {
      id: newExchangeId,
      orderId,
      customerId: order.customerId,
      customerName: activeCustomer.name,
      item: {
        productId,
        productName: item.product.name,
        size,
        price: item.product.price
      },
      reason,
      date: new Date().toLocaleDateString('pt-BR'),
      status: 'TROCA SOLICITADA'
    };

    setExchanges(prev => [newExchange, ...prev]);
    
    // Atualizar o status de troca do item no próprio pedido
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              exchangeStatus: 'TROCA SOLICITADA',
              exchangeItemId: productId,
              exchangeItemSize: size,
              exchangeReason: reason
            }
          : o
      )
    );
  };

  // Fluxo de Troca (Administrador / Cliente)
  const updateExchangeStatus = (exchangeId: string, status: Exchange['status'], returnToStockSimulated: boolean = false) => {
    if (returnToStockSimulated) {
      console.log(`[Reativo Simulação] Item da troca ${exchangeId} retornado ao estoque.`);
    }
    setExchanges(prev =>
      prev.map(exc => (exc.id === exchangeId ? { ...exc, status } : exc))
    );

    // Sincronizar com o pedido
    const exchange = exchanges.find(exc => exc.id === exchangeId);
    if (exchange) {
      setOrders(prev =>
        prev.map(o =>
          o.id === exchange.orderId
            ? { ...o, exchangeStatus: status }
            : o
        )
      );

      // Se for finalizado como PROCESSADA, gera cupom automaticamente
      if (status === 'TROCA PROCESSADA') {
        const couponCode = `TROCA-RW-${Math.floor(1000 + Math.random() * 9000)}`;
        const newCoupon: Coupon = {
          id: `coupon_${Math.random().toString(36).substr(2, 9)}`,
          code: couponCode,
          type: 'exchange',
          value: exchange.item.price, // Valor do item devolvido
          description: `Crédito de troca do pedido ${exchange.orderId}`,
          expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'), // 3 meses
          customerId: exchange.customerId
        };

        setCoupons(prev => [...prev, newCoupon]);

        // Guardar o código gerado no registro de troca para exibição
        setExchanges(prev =>
          prev.map(exc => (exc.id === exchangeId ? { ...exc, refundCouponCode: couponCode } : exc))
        );
      }
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

  // Cartões
  const addCustomerCard = (customerId: string, card: Omit<CreditCard, 'id'>) => {
    const newCard: CreditCard = {
      ...card,
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
        requestExchange,
        updateExchangeStatus,
        updateOrderStatus,
        updateCustomerProfile,
        addCustomerAddress,
        updateCustomerAddress,
        addCustomerCard,
        removeCustomerCard,
        setCardAsPreferred
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
