import type { Coupon } from '../types';

export const mockCoupons: Coupon[] = [
  {
    id: 'coupon_ana_1',
    code: 'RUNWAY20',
    type: 'promo',
    value: 20, // 20% de desconto
    description: 'Cupom promocional de 20% de desconto',
    expirationDate: '30/12/2026',
    customerId: 'ana_carolina'
  },
  {
    id: 'coupon_ana_2',
    code: 'TROCA-RW-001',
    type: 'exchange',
    value: 849.90, // R$ 849,90 de saldo
    description: 'Cupom de troca de R$ 849,90',
    expirationDate: '29/09/2026',
    customerId: 'ana_carolina'
  }
];
