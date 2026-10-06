import type { CalcularFreteRequestDto, CalcularFreteResponseDto } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface FreteResult {
  success: boolean;
  dados?: CalcularFreteResponseDto;
  error?: string;
}

export const freteService = {
  async calcularFrete(request: CalcularFreteRequestDto): Promise<FreteResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/frete/calcular`, {
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
          error: data.erro || 'Não foi possível calcular o frete para o endereço informado.'
        };
      }

      return {
        success: true,
        dados: data as CalcularFreteResponseDto
      };
    } catch (err) {
      console.error('Falha de conexão ao calcular frete:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao calcular o frete. Verifique sua conexão e tente novamente.'
      };
    }
  }
};
