import type {
  TrocaResponseDto,
  SolicitarTrocaRequestDto,
  AutorizarTrocaRequestDto,
  ConfirmarRecebimentoTrocaRequestDto,
  NotificacaoTrocaResponseDto,
  ElegibilidadeTrocaResponseDto
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';
const API_TROCAS = `${API_BASE_URL}/api/trocas`;

export interface TrocaApiResult {
  success: boolean;
  dados?: TrocaResponseDto;
  error?: string;
}

export interface ListaTrocasApiResult {
  success: boolean;
  dados?: TrocaResponseDto[];
  error?: string;
}

export interface ElegibilidadeTrocaApiResult {
  success: boolean;
  dados?: ElegibilidadeTrocaResponseDto;
  error?: string;
}

export interface NotificacaoTrocaApiResult {
  success: boolean;
  dados?: NotificacaoTrocaResponseDto;
  error?: string;
}

export const trocaService = {
  async solicitarTroca(request: SolicitarTrocaRequestDto): Promise<TrocaApiResult> {
    try {
      const response = await fetch(API_TROCAS, {
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
          error: data.erro || data.detalhe || 'Erro ao registrar solicitação de troca.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao solicitar troca.'
      };
    }
  },

  async listarPorCliente(codigoCliente: string): Promise<ListaTrocasApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/cliente/${encodeURIComponent(codigoCliente)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Erro ao consultar trocas do cliente.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto[]
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao listar trocas do cliente.'
      };
    }
  },

  async listarAdmin(status?: string): Promise<ListaTrocasApiResult> {
    try {
      const url = status && status !== 'TODOS'
        ? `${API_TROCAS}/admin?status=${encodeURIComponent(status)}`
        : `${API_TROCAS}/admin`;

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
          error: data.erro || 'Erro ao consultar trocas administrativas.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto[]
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao listar trocas no painel administrativo.'
      };
    }
  },

  async obterPorCodigo(codigoTroca: string): Promise<TrocaApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/${encodeURIComponent(codigoTroca)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Troca não encontrada.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao obter detalhes da troca.'
      };
    }
  },

  async autorizar(
    codigoTroca: string,
    request: AutorizarTrocaRequestDto
  ): Promise<TrocaApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/${encodeURIComponent(codigoTroca)}/autorizar`, {
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
          error: data.erro || data.detalhe || 'Erro ao processar autorização da troca.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao autorizar troca.'
      };
    }
  },

  async confirmarRecebimento(
    codigoTroca: string,
    request: ConfirmarRecebimentoTrocaRequestDto
  ): Promise<TrocaApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/${encodeURIComponent(codigoTroca)}/recebimento`, {
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
          error: data.erro || data.detalhe || 'Erro ao processar recebimento da troca.'
        };
      }

      return {
        success: true,
        dados: data as TrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao confirmar recebimento da troca.'
      };
    }
  },

  async obterNotificacao(codigoTroca: string): Promise<NotificacaoTrocaApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/${encodeURIComponent(codigoTroca)}/notificacao`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Notificação não encontrada.'
        };
      }

      return {
        success: true,
        dados: data as NotificacaoTrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao consultar notificação.'
      };
    }
  },

  async consultarElegibilidade(codigoPedido: string): Promise<ElegibilidadeTrocaApiResult> {
    try {
      const response = await fetch(`${API_TROCAS}/elegibilidade/${encodeURIComponent(codigoPedido)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Erro ao consultar elegibilidade de troca.'
        };
      }

      return {
        success: true,
        dados: data as ElegibilidadeTrocaResponseDto
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao consultar elegibilidade do pedido.'
      };
    }
  }
};
