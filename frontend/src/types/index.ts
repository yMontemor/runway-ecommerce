export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  brand: string;
  category: string; // primary category for compatibility
  categories: string[]; // multiple categories
  weight: string; // e.g. "250g"
  drop: string;   // e.g. "8mm"
  sizes: number[]; // e.g. [38, 39, 40, 41, 42, 43, 44]
  color: string;
  technologies: string[];
}

export interface Address {
  id: string;
  label: string; // e.g. "Casa", "Trabalho", "Cobrança Principal"
  residenceType?: 'Casa' | 'Apartamento' | 'Sobrado' | 'Comercial' | 'Outro' | string; // RN0023
  streetType?: 'Rua' | 'Avenida' | 'Alameda' | 'Praça' | 'Travessa' | 'Rodovia' | 'Outro' | string; // RN0023
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  observations?: string;
  isDelivery?: boolean; // RN0022 - Endereço de entrega
  isBilling?: boolean;  // RN0021 - Endereço de cobrança
}

export interface CreditCard {
  id: string;
  brand: 'Visa' | 'Mastercard' | 'Elo';
  cardNumber?: string; // Número completo cadastrado
  lastFour: string;
  holderName: string;
  expirationDate: string;
  cvv?: string;
  isPreferred: boolean;
}

export interface CartItem {
  product: Product;
  size: number;
  quantity: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'promo' | 'exchange';
  value: number; // promo: discount percentage (e.g. 20 for 20%), exchange: fixed credit amount (e.g. 849.90)
  description: string;
  expirationDate: string;
  customerId: string; // bound to a specific customer
}

export interface Order {
  id: string; // e.g. "RW-2026-007"
  date: string;
  customerId: string; // bound to a specific customer
  status: 'EM ABERTO' | 'EM PROCESSAMENTO' | 'PAGAMENTO REALIZADO' | 'EM TRÂNSITO' | 'ENTREGUE' | 'CANCELADO';
  items: CartItem[];
  shippingAddress: Address;
  paymentMethods: {
    cardId: string;
    amount: number;
    installments?: number;
  }[];
  couponsUsed: Coupon[];
  subtotal: number;
  shippingCost?: number;
  discountPromo?: number;
  discountExchange?: number;
  discount: number;
  total: number;
  clientConfirmedReceipt?: boolean;
  cancellationRefundCouponCode?: string;
  cardRefundedAmount?: number;
  exchangeStatus?: 'TROCA SOLICITADA' | 'TROCA ACEITA' | 'ITEM ENVIADO' | 'ITEM RECEBIDO' | 'TROCA PROCESSADA' | 'TROCA NEGADA';
  exchangeReason?: string;
  exchangeItemId?: string; // product id being returned (retrocompatibilidade)
  exchangeItemSize?: number; // size of product being returned (retrocompatibilidade)
  exchangeItems?: ExchangeItem[];
}

export interface Customer {
  id: string; // RNF0035 - Código único do cliente
  name: string;
  email: string;
  cpf: string;
  phone: string; // Mantido para retrocompatibilidade (derivado de phoneDdd + phoneNumber)
  phoneType?: 'Celular' | 'Fixo' | 'Comercial' | string; // RN0026
  phoneDdd?: string; // RN0026
  phoneNumber?: string; // RN0026
  gender: string;
  birthDate: string;
  status: 'ATIVO' | 'INATIVO';
  /**
   * RN0027: Ranking numérico do cliente.
   * NOTA: O valor 1 é apenas a pontuação inicial/base do protótipo e não constitui
   * atendimento integral da RN0027. O cálculo dinâmico baseado no perfil de compras
   * será implementado em etapas futuras.
   */
  ranking: number;
  addresses: Address[];
  cards: CreditCard[];
}

export interface NewCustomerInput {
  name: string;
  email: string;
  cpf: string;
  phoneType: 'Celular' | 'Fixo' | 'Comercial' | string;
  phoneDdd: string;
  phoneNumber: string;
  gender: string;
  birthDate: string;
  initialAddress: Omit<Address, 'id'>;
}

export interface ExchangeItem {
  productId: string;
  productName: string;
  size: number;
  price: number;
  quantity: number;
}

export interface Exchange {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  items: ExchangeItem[];
  item?: ExchangeItem; // retrocompatibilidade
  totalValue: number;
  reason: string;
  date: string;
  status: 'TROCA SOLICITADA' | 'TROCA ACEITA' | 'ITEM ENVIADO' | 'ITEM RECEBIDO' | 'TROCA PROCESSADA' | 'TROCA NEGADA';
  refundCouponCode?: string;
}

export interface AnalyticsEntry {
  date: string; // e.g. "2026-01", "2026-02"
  category: string;
  salesVolume: number;
}
