/**
 * Utilitários para cálculo e exibição de parcelamento de cartão de crédito.
 * 
 * NOTA: O parcelamento em até 6x sem juros com parcela mínima de R$ 10,00
 * é uma melhoria própria implementada no protótipo RunWay (não é regra do DRS).
 * Regras do DRS relacionadas (RN0034 / RN0035) dizem respeito ao valor mínimo por cartão.
 */

export const MAX_INSTALLMENTS = 6;
export const MIN_INSTALLMENT_AMOUNT = 10.0;

export interface InstallmentOption {
  count: number;
  installmentValue: number;
  label: string;
}

/**
 * Determina a quantidade máxima de parcelas permitidas para um determinado valor.
 * - Limite de até 6 parcelas.
 * - Cada parcela deve ser de no mínimo R$ 10,00.
 * - Caso especial (RN0035): quando o saldo total residual no cartão for inferior a R$ 10,00,
 *   é permitido pagar apenas em 1x (à vista), sem opções de múltiplas parcelas.
 */
export function getMaxInstallments(amount: number): number {
  if (amount <= 0) return 1;
  
  // Se o total for menor que R$ 10,00 (exceção RN0035 com cupom), permite somente 1x
  if (amount < MIN_INSTALLMENT_AMOUNT) {
    return 1;
  }

  const maxPossible = Math.floor(amount / MIN_INSTALLMENT_AMOUNT);
  return Math.min(MAX_INSTALLMENTS, Math.max(1, maxPossible));
}

/**
 * Retorna as opções de parcelamento formatadas para preencher o <select>.
 * O valor financeiro oficial do pedido continua sendo o montante total atribuído ao cartão.
 */
export function getInstallmentOptions(amount: number): InstallmentOption[] {
  const max = getMaxInstallments(amount);
  const options: InstallmentOption[] = [];

  for (let i = 1; i <= max; i++) {
    const val = amount / i;
    options.push({
      count: i,
      installmentValue: val,
      label: i === 1
        ? `1x de ${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (à vista)`
        : `${i}x de ${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`
    });
  }

  return options;
}

/**
 * Formata um texto descritivo amigável para exibição do parcelamento.
 */
export function formatInstallmentsLabel(amount: number, installments: number = 1): string {
  const safeInstallments = Math.max(1, installments);
  if (safeInstallments === 1) {
    return `${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (à vista)`;
  }
  const installmentVal = amount / safeInstallments;
  return `${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${safeInstallments}x de ${installmentVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`;
}
