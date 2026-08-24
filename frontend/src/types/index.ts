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
  label: string; // e.g. "Casa", "Trabalho"
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  observations?: string;
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
  exchangeItemId?: string; // product id being returned
  exchangeItemSize?: number; // size of product being returned
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  gender: string;
  birthDate: string;
  status: 'ATIVO' | 'INATIVO';
  addresses: Address[];
  cards: CreditCard[];
}

export interface Exchange {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  item: {
    productId: string;
    productName: string;
    size: number;
    price: number;
  };
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
