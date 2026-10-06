import type { ValidarPagamentoRequestDto, ValidarPagamentoResponseDto } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface ValidarPagamentoResult {
  success: boolean;
  dados?: ValidarPagamentoResponseDto;
  error?: string;
}

export const pagamentoService = {
  async validarPagamento(request: ValidarPagamentoRequestDto): Promise<ValidarPagamentoResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pagamento/validar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Falha ao validar os meios de pagamento.'
        };
      }

      return {
        success: true,
        dados: data as ValidarPagamentoResponseDto
      };
    } catch (err) {
      console.error('Falha ao validar pagamento:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao validar o pagamento. Verifique sua conexão e tente novamente.'
      };
    }
  }
};
