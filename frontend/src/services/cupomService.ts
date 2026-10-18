import type { CupomResponseDto, ConsultarCupomRequestDto } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface ListarCuponsResult {
  success: boolean;
  cupons?: CupomResponseDto[];
  error?: string;
}

export interface ConsultarCupomResult {
  success: boolean;
  cupom?: CupomResponseDto;
  error?: string;
}

export const cupomService = {
  async listarCuponsTrocaCliente(codigoCliente: string): Promise<ListarCuponsResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cupons/troca/${encodeURIComponent(codigoCliente)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Não foi possível carregar os cupons de troca.'
        };
      }

      return {
        success: true,
        cupons: data as CupomResponseDto[]
      };
    } catch (err) {
      console.error('Falha ao listar cupons de troca:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao consultar cupons de troca.'
      };
    }
  },

  async listarCuponsCliente(codigoCliente: string): Promise<ListarCuponsResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cupons/cliente/${encodeURIComponent(codigoCliente)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Não foi possível carregar os cupons do cliente.'
        };
      }

      return {
        success: true,
        cupons: data as CupomResponseDto[]
      };
    } catch (err) {
      console.error('Falha ao listar cupons do cliente:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao consultar cupons do cliente.'
      };
    }
  },

  async listarCuponsPromocionais(): Promise<ListarCuponsResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cupons/promocionais`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Não foi possível carregar os cupons promocionais.'
        };
      }

      return {
        success: true,
        cupons: data as CupomResponseDto[]
      };
    } catch (err) {
      console.error('Falha ao listar cupons promocionais:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao consultar cupons promocionais.'
      };
    }
  },

  async consultarCupom(codigoCupom: string, codigoCliente?: string): Promise<ConsultarCupomResult> {
    try {
      const request: ConsultarCupomRequestDto = {
        codigoCupom,
        codigoCliente
      };

      const response = await fetch(`${API_BASE_URL}/api/cupons/consultar`, {
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
          error: data.erro || 'Cupom inválido ou não encontrado.'
        };
      }

      return {
        success: true,
        cupom: data as CupomResponseDto
      };
    } catch (err) {
      console.error('Falha ao consultar cupom:', err);
      return {
        success: false,
        error: 'Falha de comunicação com o servidor ao consultar o cupom.'
      };
    }
  }
};
