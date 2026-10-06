import type { CriarPedidoRequestDto, PedidoResponseDto } from '../types';

const API_BASE = 'http://localhost:5035/api/pedidos';

export interface PedidoApiResult {
  success: boolean;
  dados?: PedidoResponseDto;
  error?: string;
}

export const pedidoService = {
  async criarPedido(request: CriarPedidoRequestDto): Promise<PedidoApiResult> {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao processar e persistir o pedido.'
        };
      }

      return {
        success: true,
        dados: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao criar o pedido.'
      };
    }
  }
};
