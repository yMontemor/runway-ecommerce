import type {
  CriarPedidoRequestDto,
  PedidoResponseDto,
  ProcessarPagamentoPedidoRequestDto,
  AtualizarStatusPedidoRequestDto
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';
const API_PEDIDOS = `${API_BASE_URL}/api/pedidos`;

export interface PedidoApiResult {
  success: boolean;
  dados?: PedidoResponseDto;
  error?: string;
}

export interface ListaPedidosApiResult {
  success: boolean;
  dados?: PedidoResponseDto[];
  error?: string;
}

export const pedidoService = {
  async criarPedido(request: CriarPedidoRequestDto): Promise<PedidoApiResult> {
    try {
      const response = await fetch(API_PEDIDOS, {
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
  },

  async listarPorCliente(codigoCliente: string): Promise<ListaPedidosApiResult> {
    try {
      const response = await fetch(`${API_PEDIDOS}/cliente/${encodeURIComponent(codigoCliente)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Erro ao consultar pedidos do cliente.'
        };
      }

      return {
        success: true,
        dados: data as PedidoResponseDto[]
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao listar pedidos do cliente.'
      };
    }
  },

  async listarTodos(status?: string): Promise<ListaPedidosApiResult> {
    try {
      const url = status && status !== 'TODOS'
        ? `${API_PEDIDOS}?status=${encodeURIComponent(status)}`
        : API_PEDIDOS;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Erro ao consultar pedidos.'
        };
      }

      return {
        success: true,
        dados: data as PedidoResponseDto[]
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao listar pedidos.'
      };
    }
  },

  async obterPorCodigo(codigo: string): Promise<PedidoApiResult> {
    try {
      const response = await fetch(`${API_PEDIDOS}/${encodeURIComponent(codigo)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Pedido não encontrado.'
        };
      }

      return {
        success: true,
        dados: data as PedidoResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao obter pedido.'
      };
    }
  },

  async processarPagamento(
    codigo: string,
    request?: ProcessarPagamentoPedidoRequestDto
  ): Promise<PedidoApiResult> {
    try {
      const response = await fetch(`${API_PEDIDOS}/${encodeURIComponent(codigo)}/processar-pagamento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request || {})
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao processar pagamento do pedido.'
        };
      }

      return {
        success: true,
        dados: data as PedidoResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao processar pagamento.'
      };
    }
  },

  async atualizarStatus(
    codigo: string,
    request: AtualizarStatusPedidoRequestDto
  ): Promise<PedidoApiResult> {
    try {
      const response = await fetch(`${API_PEDIDOS}/${encodeURIComponent(codigo)}/status`, {
        method: 'PATCH',
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
          error: data.erro || data.detalhe || 'Erro ao atualizar status do pedido.'
        };
      }

      return {
        success: true,
        dados: data as PedidoResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao atualizar status do pedido.'
      };
    }
  }
};
