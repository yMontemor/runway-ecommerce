/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Customer, CartItem, Order, Coupon, Exchange, Address, CreditCard, NewCustomerInput, Product, ValidacaoEstoqueResponse, ItemCarrinhoDto, ItemExpiradoDto } from '../types';
import { produtoService } from '../services/produtoService';
import { carrinhoService } from '../services/carrinhoService';
import { pedidoService } from '../services/pedidoService';
import { trocaService } from '../services/trocaService';
import { cupomService } from '../services/cupomService';
import { mapPedidoDtoToOrder, mapTrocaDtoToExchange, mapCupomDtoToCoupon } from '../utils/orderMapper';
import {
  cadastrarCliente,
  cadastrarEnderecoCliente,
  alterarEnderecoCliente,
  removerEnderecoCliente,
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

export interface CartExpiracaoState {
  tempoRestanteSegundos: number;
  alertaExpirando: boolean;
  expirado: boolean;
  mensagemExpiracao: string | null;
  itensExpirados: ItemExpiradoDto[];
}

interface AppContextType {
  customers: Customer[];
  activeCustomer: Customer;
  isLoadingCustomers: boolean;
  customerLoadError: string | null;
  refreshCustomers: () => Promise<void>;
  cartsByCustomer: Record<string, CartItem[]>;
  cartExpiracao: CartExpiracaoState;
  limparAvisoExpiracao: () => void;
  refreshCart: (customerId?: string) => Promise<void>;
  orders: Order[];
  isLoadingOrders: boolean;
  ordersLoadError: string | null;
  refreshOrders: () => Promise<void>;
  products: Product[];
  isLoadingProducts: boolean;
  productsLoadError: string | null;
  refreshProducts: () => Promise<void>;
  coupons: Coupon[];
  isLoadingCoupons: boolean;
  refreshCoupons: (customerId?: string) => Promise<void>;
  exchanges: Exchange[];
  isLoadingExchanges: boolean;
  exchangesLoadError: string | null;
  refreshExchanges: () => Promise<void>;
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
  cancelOrder: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  confirmOrderReceipt: (orderId: string) => void;
  requestExchange: (
    orderId: string,
    itemsToExchange: { productId: string; size: number; quantity: number; itemPedidoId?: number }[],
    reason: string
  ) => Promise<{ success: boolean; error?: string; troca?: Exchange }>;
  updateExchangeStatus: (exchangeId: string, status: Exchange['status'], returnToStockSimulated?: boolean) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<{ success: boolean; error?: string }>;
  addCustomerAddress: (customerId: string, address: Omit<Address, 'id'>) => Promise<{ success: boolean; error?: string; address?: Address }>;
  updateCustomerAddress: (customerId: string, address: Address) => Promise<{ success: boolean; error?: string; address?: Address }>;
  refreshCustomerAddresses: (customerId: string) => Promise<void>;
  removeCustomerAddress: (customerId: string, addressId: string) => Promise<{ success: boolean; error?: string }>;
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

const ACTIVE_CUSTOMER_STORAGE_KEY = 'runway_active_customer_id';

function getSavedCustomerId(): string | null {
  try {
    const saved = localStorage.getItem(ACTIVE_CUSTOMER_STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
}

function saveCustomerIdToStorage(id: string): void {
  try {
    localStorage.setItem(ACTIVE_CUSTOMER_STORAGE_KEY, id);
  } catch (err) {
    console.error('Falha ao salvar identificador do cliente ativo no armazenamento local:', err);
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string>(() => {
    return getSavedCustomerId() || 'CLI-0001';
  });
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

  const [cartExpiracao, setCartExpiracao] = useState<CartExpiracaoState>({
    tempoRestanteSegundos: 0,
    alertaExpirando: false,
    expirado: false,
    mensagemExpiracao: null,
    itensExpirados: []
  });

  // Cupons reais carregados do PostgreSQL
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);

  // Pedidos reais carregados do PostgreSQL
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersLoadError, setOrdersLoadError] = useState<string | null>(null);

  // Trocas reais carregadas do PostgreSQL
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isLoadingExchanges, setIsLoadingExchanges] = useState(false);
  const [exchangesLoadError, setExchangesLoadError] = useState<string | null>(null);

  // Carregar pedidos reais da API REST
  const refreshOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const res = await pedidoService.listarTodos();
      if (res.success && res.dados) {
        const mapped = res.dados.map(dto => mapPedidoDtoToOrder(dto, productsList));
        setOrders(mapped);
        setOrdersLoadError(null);
      } else {
        setOrdersLoadError(res.error || 'Não foi possível carregar os pedidos.');
      }
    } catch {
      setOrdersLoadError('Falha ao conectar com o servidor para listar pedidos.');
    } finally {
      setIsLoadingOrders(false);
    }
  }, [productsList]);

  // Carregar trocas reais da API REST
  const refreshExchanges = useCallback(async () => {
    setIsLoadingExchanges(true);
    try {
      const res = await trocaService.listarAdmin();
      if (res.success && res.dados) {
        const mapped = res.dados.map(mapTrocaDtoToExchange);
        setExchanges(mapped);
        setExchangesLoadError(null);
      } else {
        setExchangesLoadError(res.error || 'Não foi possível carregar as trocas.');
      }
    } catch {
      setExchangesLoadError('Falha ao conectar com o servidor para listar trocas.');
    } finally {
      setIsLoadingExchanges(false);
    }
  }, []);

  // Carregar cupons reais da API REST
  const refreshCoupons = useCallback(async (customerId?: string) => {
    const targetId = customerId || activeCustomerId;
    if (!targetId) return;
    setIsLoadingCoupons(true);
    try {
      const res = await cupomService.listarCuponsCliente(targetId);
      if (res.success && res.cupons) {
        const mapped = res.cupons.map(c => mapCupomDtoToCoupon(c, targetId));
        setCoupons(mapped);
      }
    } catch (err) {
      console.error('Falha ao carregar cupons do cliente:', err);
    } finally {
      setIsLoadingCoupons(false);
    }
  }, [activeCustomerId]);

  // Sincronizar pedidos e trocas na inicialização e quando os produtos carregarem
  useEffect(() => {
    refreshOrders();
    refreshExchanges();
  }, [refreshOrders, refreshExchanges]);

  // Sincronizar cupons do cliente ativo
  useEffect(() => {
    if (activeCustomerId) {
      refreshCoupons(activeCustomerId);
    }
  }, [activeCustomerId, refreshCoupons]);

  // Determinar cliente ativo a partir da lista real persistida
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === activeCustomerId) || customers[0] || emptyCustomer;
  }, [customers, activeCustomerId]);

  const setActiveCustomer = (id: string) => {
    setActiveCustomerId(id);
    saveCustomerIdToStorage(id);
    refreshCustomerAddresses(id);
    refreshCustomerCards(id);
    refreshCart(id);
    refreshCoupons(id);
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
          const savedId = getSavedCustomerId() || activeCustomerId;
          const activeCustomers = mapped.filter(c => c.status === 'ATIVO');
          const validSaved = activeCustomers.find(c => c.id === savedId);

          // Se o cliente salvo existir e estiver ativo, preserva-o;
          // caso contrário, seleciona um cliente ativo válido retornado pela API.
          const targetId = validSaved
            ? validSaved.id
            : (activeCustomers[0]?.id || mapped[0].id);

          setActiveCustomerId(targetId);
          saveCustomerIdToStorage(targetId);

          await Promise.all([
            refreshCustomerAddresses(targetId),
            refreshCustomerCards(targetId),
            refreshCart(targetId),
            refreshCoupons(targetId)
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
  }, [activeCustomerId, refreshCustomerAddresses, refreshCustomerCards, refreshCoupons]);

  useEffect(() => {
    carregarClientesReais();
  }, []);

  function mapItemCarrinhoDtoToCartItem(itemDto: ItemCarrinhoDto, products: Product[]): CartItem {
    const existingProduct = products.find(
      p => p.id === itemDto.codigoProduto || p.name.toLowerCase() === itemDto.nomeProduto.toLowerCase() || p.id === String(itemDto.produtoId)
    );

    const product: Product = existingProduct ? {
      ...existingProduct,
      price: Number(itemDto.precoUnitario),
      image: itemDto.imagemUrl || existingProduct.image
    } : {
      id: itemDto.codigoProduto || String(itemDto.produtoId),
      name: itemDto.nomeProduto,
      price: Number(itemDto.precoUnitario),
      description: '',
      image: itemDto.imagemUrl || '',
      brand: itemDto.marca,
      category: itemDto.categoria,
      categories: [itemDto.categoria],
      weight: '250g',
      drop: '8mm',
      sizes: [itemDto.tamanho],
      color: 'Padrão',
      technologies: [],
      variacoes: [{
        id: itemDto.produtoVariacaoId,
        produtoId: itemDto.produtoId,
        tamanho: itemDto.tamanho,
        quantidadeEstoque: itemDto.quantidade,
        ativo: true
      }]
    };

    return {
      product,
      variacaoId: itemDto.produtoVariacaoId,
      size: itemDto.tamanho,
      quantity: itemDto.quantidade
    };
  }

  // Carregar carrinho persistido do backend para um cliente
  const refreshCart = useCallback(async (customerId?: string) => {
    const targetId = customerId || activeCustomer.id;
    if (!targetId) return;

    try {
      const res = await carrinhoService.obterCarrinho(targetId);
      if (res.success && res.carrinho) {
        const mapped = res.carrinho.itens.map(it => mapItemCarrinhoDtoToCartItem(it, productsList));
        setCartsByCustomer(prev => ({
          ...prev,
          [targetId]: mapped
        }));

        setCartExpiracao({
          tempoRestanteSegundos: res.carrinho.tempoRestanteSegundos,
          alertaExpirando: res.carrinho.alertaExpirando,
          expirado: res.carrinho.expirado,
          mensagemExpiracao: res.carrinho.mensagemExpiracao || null,
          itensExpirados: res.carrinho.itensExpirados || []
        });
      }
    } catch (err) {
      console.error('Falha ao carregar carrinho do servidor:', err);
    }
  }, [activeCustomer.id, productsList]);

  // Recarregar carrinho quando os produtos forem carregados
  useEffect(() => {
    if (productsList.length > 0 && activeCustomer.id) {
      refreshCart(activeCustomer.id);
    }
  }, [productsList, activeCustomer.id]);

  // Cronômetro local com alerta 5 minutos antes da expiração (RN0044)
  useEffect(() => {
    if (cartExpiracao.tempoRestanteSegundos <= 0 || cartExpiracao.expirado) {
      return;
    }

    const timer = setInterval(() => {
      setCartExpiracao(prev => {
        if (prev.tempoRestanteSegundos <= 1) {
          refreshCart(activeCustomer.id);
          return {
            ...prev,
            tempoRestanteSegundos: 0,
            alertaExpirando: false,
            expirado: true,
            mensagemExpiracao: 'Seu carrinho expirou por inatividade após 20 minutos e as reservas de estoque foram liberadas.'
          };
        }

        const novosSegundos = prev.tempoRestanteSegundos - 1;
        return {
          ...prev,
          tempoRestanteSegundos: novosSegundos,
          alertaExpirando: novosSegundos <= 300 // 5 minutos antes
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cartExpiracao.tempoRestanteSegundos, cartExpiracao.expirado, activeCustomer.id, refreshCart]);

  const limparAvisoExpiracao = () => {
    setCartExpiracao(prev => ({
      ...prev,
      itensExpirados: [],
      mensagemExpiracao: null
    }));
  };

  // Adicionar produto ao carrinho do cliente ativo com reserva persistida no backend
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
    const variacao = product?.variacoes?.find(v => v.tamanho === size)
      || (variacaoId ? product?.variacoes?.find(v => v.id === variacaoId) : undefined);

    const realVariacaoId = variacao?.id ?? variacaoId ?? 0;
    if (realVariacaoId <= 0) {
      return { success: false, message: 'Variação do produto não encontrada.' };
    }

    try {
      const res = await carrinhoService.adicionarItem(activeCustomer.id, realVariacaoId, quantity);
      if (res.success && res.carrinho) {
        const mapped = res.carrinho.itens.map(it => mapItemCarrinhoDtoToCartItem(it, productsList));
        setCartsByCustomer(prev => ({
          ...prev,
          [activeCustomer.id]: mapped
        }));

        setCartExpiracao({
          tempoRestanteSegundos: res.carrinho.tempoRestanteSegundos,
          alertaExpirando: res.carrinho.alertaExpirando,
          expirado: res.carrinho.expirado,
          mensagemExpiracao: res.carrinho.mensagemExpiracao || null,
          itensExpirados: res.carrinho.itensExpirados || []
        });

        carregarProdutos();
        return { success: true };
      }

      return { success: false, message: res.error || 'Erro ao adicionar item ao carrinho.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha de conexão com a API do carrinho.' };
    }
  };

  // Atualizar quantidade no carrinho persistido
  const updateCartQuantity = async (productId: string, size: number, delta: number): Promise<{ success: boolean; message?: string }> => {
    const itemKey = `${productId}-${size}`;
    if (pendingItemUpdatesRef.current.has(itemKey)) {
      return { success: false, message: 'Alteração já em andamento para este item.' };
    }

    pendingItemUpdatesRef.current.add(itemKey);
    try {
      const customerId = activeCustomer.id || activeCustomerId || getSavedCustomerId() || '';
      if (!customerId) return { success: false, message: 'Cliente não selecionado.' };

      const customerCart = cartsByCustomer[customerId] || [];
      const item = customerCart.find(i => i.product.id === productId && i.size === size);
      if (!item) return { success: false, message: 'Item não encontrado no carrinho.' };

      const newQty = item.quantity + delta;

      // Validação real de estoque no endpoint de catálogo ao incrementar (RF0032)
      if (delta > 0 && item.variacaoId > 0) {
        try {
          const validacao = await produtoService.validarEstoque([
            { produtoVariacaoId: item.variacaoId, quantidade: newQty }
          ], customerId);
          if (!validacao.valido) {
            const itemInvalido = validacao.itens?.find(i => !i.disponivel);
            const msg = itemInvalido?.mensagem || validacao.mensagem || 'Estoque insuficiente.';
            return { success: false, message: msg };
          }
        } catch (err) {
          console.error('Erro ao verificar estoque na alteração de quantidade:', err);
        }
      }

      let res;
      if (newQty <= 0) {
        res = await carrinhoService.removerItem(customerId, item.variacaoId);
      } else {
        res = await carrinhoService.atualizarQuantidade(customerId, item.variacaoId, newQty);
      }

      if (res.success && res.carrinho) {
        const mapped = res.carrinho.itens.map(it => mapItemCarrinhoDtoToCartItem(it, productsList));
        setCartsByCustomer(prev => ({
          ...prev,
          [customerId]: mapped
        }));

        setCartExpiracao({
          tempoRestanteSegundos: res.carrinho.tempoRestanteSegundos,
          alertaExpirando: res.carrinho.alertaExpirando,
          expirado: res.carrinho.expirado,
          mensagemExpiracao: res.carrinho.mensagemExpiracao || null,
          itensExpirados: res.carrinho.itensExpirados || []
        });

        carregarProdutos();
        return { success: true };
      }

      return { success: false, message: res.error || 'Erro ao alterar quantidade no carrinho.' };
    } finally {
      pendingItemUpdatesRef.current.delete(itemKey);
    }
  };

  // Validação de estoque de todos os itens do carrinho antes do checkout
  const validarEstoqueCarrinho = async (customerId?: string): Promise<ValidacaoEstoqueResponse> => {
    const targetId = customerId || activeCustomer.id || activeCustomerId || getSavedCustomerId() || '';
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
        itensComVariacao.map(i => ({ produtoVariacaoId: i.variacaoId, quantidade: i.quantity })),
        targetId
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

  // Remover do carrinho persistido
  const removeFromCart = async (productId: string, size: number) => {
    const customerId = activeCustomer.id;
    if (!customerId) return;

    const customerCart = cartsByCustomer[customerId] || [];
    const item = customerCart.find(i => i.product.id === productId && i.size === size);
    if (!item) return;

    try {
      const res = await carrinhoService.removerItem(customerId, item.variacaoId);
      if (res.success && res.carrinho) {
        const mapped = res.carrinho.itens.map(it => mapItemCarrinhoDtoToCartItem(it, productsList));
        setCartsByCustomer(prev => ({
          ...prev,
          [customerId]: mapped
        }));

        setCartExpiracao({
          tempoRestanteSegundos: res.carrinho.tempoRestanteSegundos,
          alertaExpirando: res.carrinho.alertaExpirando,
          expirado: res.carrinho.expirado,
          mensagemExpiracao: res.carrinho.mensagemExpiracao || null,
          itensExpirados: res.carrinho.itensExpirados || []
        });

        carregarProdutos();
      }
    } catch (err) {
      console.error('Erro ao remover item do carrinho:', err);
    }
  };

  const clearCart = async (customerId: string) => {
    const targetId = customerId || activeCustomer.id;
    if (!targetId) return;

    try {
      const res = await carrinhoService.limparCarrinho(targetId);
      if (res.success && res.carrinho) {
        setCartsByCustomer(prev => ({
          ...prev,
          [targetId]: []
        }));

        setCartExpiracao({
          tempoRestanteSegundos: 0,
          alertaExpirando: false,
          expirado: false,
          mensagemExpiracao: null,
          itensExpirados: []
        });

        carregarProdutos();
      }
    } catch (err) {
      console.error('Erro ao limpar carrinho:', err);
    }
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
    refreshOrders();
    refreshCoupons(customerId);

    return newOrder;
  };

  // Cancelar Pedido via REST
  const cancelOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await pedidoService.atualizarStatus(orderId, { novoStatus: 'REPROVADA', motivo: 'Cancelado pelo cliente' });
      if (res.success) {
        await Promise.all([
          refreshOrders(),
          refreshCoupons(activeCustomer.id)
        ]);
        return { success: true };
      }
      return { success: false, error: res.error || 'Erro ao cancelar pedido.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha de comunicação ao cancelar pedido.' };
    }
  };

  // Confirmar Recebimento pelo Cliente
  const confirmOrderReceipt = (orderId: string) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? { ...o, clientConfirmedReceipt: true }
          : o
      )
    );
  };

  // Solicitar Troca via REST
  const requestExchange = async (
    orderId: string,
    itemsToExchange: { productId: string; size: number; quantity: number; itemPedidoId?: number }[],
    reason: string
  ): Promise<{ success: boolean; error?: string; troca?: Exchange }> => {
    try {
      const eligRes = await trocaService.consultarElegibilidade(orderId);
      if (!eligRes.success || !eligRes.dados) {
        return { success: false, error: eligRes.error || 'Não foi possível verificar a elegibilidade deste pedido.' };
      }

      const itensRequest: { itemPedidoId: number; quantidade: number }[] = [];
      for (const reqItem of itemsToExchange) {
        const matchedItem = eligRes.dados.itens.find(
          it => (reqItem.itemPedidoId && it.itemPedidoId === reqItem.itemPedidoId) ||
            (it.nomeProduto.toLowerCase().includes(reqItem.productId.toLowerCase()) && it.tamanho === reqItem.size)
        );

        if (!matchedItem) {
          return { success: false, error: `Item ${reqItem.productId} (Tam: ${reqItem.size}) não é elegível para troca neste pedido.` };
        }

        itensRequest.push({
          itemPedidoId: matchedItem.itemPedidoId,
          quantidade: reqItem.quantity
        });
      }

      const res = await trocaService.solicitarTroca({
        codigoCliente: activeCustomerId,
        codigoPedido: orderId,
        itens: itensRequest,
        motivo: reason
      });

      if (res.success && res.dados) {
        await Promise.all([refreshOrders(), refreshExchanges()]);
        return { success: true, troca: mapTrocaDtoToExchange(res.dados) };
      }

      return { success: false, error: res.error || 'Erro ao registrar solicitação de troca.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha de comunicação ao solicitar troca.' };
    }
  };

  // Fluxo de Troca via REST (Administrador / Cliente)
  const updateExchangeStatus = async (
    exchangeId: string,
    status: Exchange['status'],
    returnToStockSimulated: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (status === 'TROCA ACEITA' || status === 'TROCA AUTORIZADA') {
        const res = await trocaService.autorizar(exchangeId, {
          autorizado: true,
          usuarioResponsavel: 'Administrador'
        });
        if (!res.success) return { success: false, error: res.error };
      } else if (status === 'TROCA NEGADA' || status === 'TROCA RECUSADA') {
        const res = await trocaService.autorizar(exchangeId, {
          autorizado: false,
          motivoRecusa: 'Solicitação de troca recusada pelo administrador.',
          usuarioResponsavel: 'Administrador'
        });
        if (!res.success) return { success: false, error: res.error };
      } else if (status === 'TROCA PROCESSADA' || status === 'TROCADO' || status === 'ITEM RECEBIDO') {
        const res = await trocaService.confirmarRecebimento(exchangeId, {
          retornarAoEstoque: returnToStockSimulated,
          usuarioResponsavel: 'Administrador'
        });
        if (!res.success) return { success: false, error: res.error };
      }

      await Promise.all([
        refreshOrders(),
        refreshExchanges(),
        refreshCoupons(activeCustomerId)
      ]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao processar status da troca.' };
    }
  };

  // Atualizar Status do Pedido via REST (Avanço no Painel Admin)
  const updateOrderStatus = async (
    orderId: string,
    status: Order['status']
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (status === 'APROVADA' || status === 'PAGAMENTO REALIZADO') {
        const res = await pedidoService.processarPagamento(orderId);
        if (!res.success) {
          return { success: false, error: res.error };
        }
      } else {
        let novoStatusOficial: string = status;
        if (status === 'EM TRÂNSITO') novoStatusOficial = 'EM TRANSPORTE';
        if (status === 'CANCELADO') novoStatusOficial = 'REPROVADA';

        const res = await pedidoService.atualizarStatus(orderId, { novoStatus: novoStatusOficial });
        if (!res.success) {
          return { success: false, error: res.error };
        }
      }
      await refreshOrders();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao atualizar status do pedido.' };
    }
  };

  // Cadastrar Novo Cliente (RF0021, RN0021, RN0022, RN0023, RN0026, RNF0031, RNF0032, RNF0033, RNF0035)
  const addCustomer = async (data: NewCustomerInput): Promise<{ success: boolean; error?: string; customer?: Customer }> => {
    // Comunicação real com a API POST /api/clientes via clienteService
    const result = await cadastrarCliente(data);

    if (result.success && result.customer) {
      // Atualiza o estado da lista de clientes com o registro persistido
      setCustomers(prev => [...prev, result.customer!]);
      setActiveCustomerId(result.customer.id);
      saveCustomerIdToStorage(result.customer.id);

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

  const removeCustomerAddress = async (
    customerId: string,
    addressId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await removerEnderecoCliente(customerId, addressId);
      if (result.success) {
        setCustomers(prev =>
          prev.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                addresses: c.addresses.filter(a => a.id !== addressId)
              };
            }
            return c;
          })
        );
        return { success: true };
      }
      return { success: false, error: result.error || 'Erro ao remover endereço.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha de comunicação ao remover endereço.' };
    }
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
        cartExpiracao,
        limparAvisoExpiracao,
        refreshCart,
        orders,
        isLoadingOrders,
        ordersLoadError,
        refreshOrders,
        coupons,
        isLoadingCoupons,
        refreshCoupons,
        exchanges,
        isLoadingExchanges,
        exchangesLoadError,
        refreshExchanges,
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
