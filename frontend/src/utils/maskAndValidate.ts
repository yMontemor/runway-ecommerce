/**
 * Utilitários de Máscara e Validação para Cliente (Data de Nascimento, Telefone e DDD)
 */

/**
 * Aplica máscara de Data de Nascimento automaticamente (DD/MM/AAAA)
 * Limita a 8 dígitos numéricos (10 caracteres com as barras).
 */
export function maskBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Aplica máscara ao número de telefone (sem DDD):
 * - 8 dígitos (fixo/comercial): 3456-7890
 * - 9 dígitos (celular): 98765-4321
 */
export function maskPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Aplica máscara de CEP brasileiro automaticamente (00000-000)
 * Limita a 8 dígitos numéricos (9 caracteres com o hífen).
 */
export function maskZipCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Validação de CEP brasileiro (exige exatamente 8 dígitos numéricos)
 */
export function validateZipCode(value: string): { isValid: boolean; error?: string } {
  const cleanDigits = (value || '').replace(/\D/g, '');
  if (cleanDigits.length !== 8) {
    return { isValid: false, error: 'Informe um CEP válido com 8 dígitos.' };
  }
  return { isValid: true };
}

/**
 * Verifica se um ano é bissexto
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Validação rigorosa de Data de Nascimento:
 * - Valida formato DD/MM/AAAA
 * - Valida existência do mês (1-12)
 * - Valida existência do dia conforme o mês e anos bissextos
 * - Rejeita datas futuras
 */
export function validateBirthDate(dateStr: string): { isValid: boolean; error?: string } {
  if (!dateStr || dateStr.trim() === '') {
    return { isValid: false, error: 'A data de nascimento é obrigatória.' };
  }

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
    return { isValid: false, error: 'Informe uma data de nascimento válida (DD/MM/AAAA).' };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { isValid: false, error: 'Informe uma data de nascimento válida.' };
  }

  if (year < 1900) {
    return { isValid: false, error: 'Informe um ano de nascimento válido.' };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Informe uma data de nascimento válida.' };
  }

  // Dias por mês
  let maxDays = 31;
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    maxDays = 30;
  } else if (month === 2) {
    maxDays = isLeapYear(year) ? 29 : 28;
  }

  if (day < 1 || day > maxDays) {
    return { isValid: false, error: 'Informe uma data de nascimento válida.' };
  }

  // Validar data futura
  const inputDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (inputDate > today) {
    return { isValid: false, error: 'A data de nascimento não pode ser futura.' };
  }

  return { isValid: true };
}

/**
 * Validação de Telefone (DDD + Número)
 */
export function validatePhoneFields(ddd: string, number: string): { isValid: boolean; error?: string } {
  const cleanDdd = ddd.replace(/\D/g, '');
  const cleanNumber = number.replace(/\D/g, '');

  if (cleanDdd.length !== 2) {
    return { isValid: false, error: 'O DDD do telefone deve conter 2 dígitos.' };
  }

  if (cleanNumber.length !== 8 && cleanNumber.length !== 9) {
    return { isValid: false, error: 'O número de telefone deve conter 8 ou 9 dígitos.' };
  }

  return { isValid: true };
}

/**
 * ============================================================
 * UTILITÁRIOS DE CARTÃO DE CRÉDITO
 * ============================================================
 */

/**
 * Aplica máscara ao número do cartão em blocos de 4 dígitos (Ex: 1234 5678 1234 5678)
 * Limita a 16 dígitos numéricos.
 */
export function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const parts = digits.match(/.{1,4}/g);
  return parts ? parts.join(' ') : digits;
}

/**
 * Aplica máscara de validade do cartão (MM/AA)
 * Limita a 4 dígitos numéricos (5 caracteres formatados).
 */
export function maskCardExpiration(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Aplica máscara de CVV (3 ou 4 dígitos numéricos)
 */
export function maskCardCvv(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

/**
 * Validação do número do cartão de crédito
 */
export function validateCardNumber(value: string): { isValid: boolean; error?: string } {
  const cleanDigits = value.replace(/\D/g, '');
  if (cleanDigits.length < 13 || cleanDigits.length > 19) {
    return { isValid: false, error: 'Informe um número de cartão válido (16 dígitos).' };
  }
  return { isValid: true };
}

/**
 * Validação da validade do cartão de crédito (MM/AA ou MM/AAAA):
 * - Mês entre 01 e 12
 * - Cartão não pode estar vencido em relação ao mês e ano correntes
 */
export function validateCardExpiration(value: string): { isValid: boolean; error?: string } {
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'A validade do cartão é obrigatória.' };
  }

  const parts = value.trim().split('/');
  if (parts.length !== 2 || parts[0].length !== 2 || (parts[1].length !== 2 && parts[1].length !== 4)) {
    return { isValid: false, error: 'Informe a validade no formato MM/AA.' };
  }

  const month = parseInt(parts[0], 10);
  let year = parseInt(parts[1], 10);

  if (isNaN(month) || isNaN(year)) {
    return { isValid: false, error: 'Informe uma validade válida.' };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Mês de validade inválido (deve ser entre 01 e 12).' };
  }

  // Converter ano de 2 dígitos para 4 dígitos (Ex: 28 -> 2028)
  if (parts[1].length === 2) {
    year += 2000;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Um cartão MM/YYYY é válido até o fim do mês MM do ano YYYY
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { isValid: false, error: 'O cartão está com a validade vencida.' };
  }

  if (year > currentYear + 25) {
    return { isValid: false, error: 'Ano de validade inválido.' };
  }

  return { isValid: true };
}

/**
 * Validação de CVV
 */
export function validateCardCvv(value: string): { isValid: boolean; error?: string } {
  const cleanDigits = (value || '').replace(/\D/g, '');
  if (cleanDigits.length < 3 || cleanDigits.length > 4 || cleanDigits !== (value || '').trim()) {
    return { isValid: false, error: 'O código CVV deve conter 3 ou 4 dígitos numéricos.' };
  }
  return { isValid: true };
}

