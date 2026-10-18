import type { CarrinhoResponseDto, ExpiracaoCarrinhoResponseDto } from '../types';

const API_BASE = 'http://localhost:5035/api/carrinho';

export interface CarrinhoApiResult {
  success: boolean;
  carrinho?: CarrinhoResponseDto;
  error?: string;
}

export interface ExpiracaoApiResult {
  success: boolean;
  expiracao?: ExpiracaoCarrinhoResponseDto;
  error?: string;
}

export const carrinhoService = {
  async obterCarrinho(codigoCliente: string): Promise<CarrinhoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}`);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao carregar o carrinho do servidor.'
        };
      }

      return {
        success: true,
        carrinho: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao consultar o carrinho.'
      };
    }
  },

  async adicionarItem(
    codigoCliente: string,
    produtoVariacaoId: number,
    quantidade: number
  ): Promise<CarrinhoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}/itens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ produtoVariacaoId, quantidade })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao adicionar item ao carrinho.'
        };
      }

      return {
        success: true,
        carrinho: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao adicionar item ao carrinho.'
      };
    }
  },

  async atualizarQuantidade(
    codigoCliente: string,
    produtoVariacaoId: number,
    quantidade: number
  ): Promise<CarrinhoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}/itens/${produtoVariacaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantidade })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao atualizar quantidade no carrinho.'
        };
      }

      return {
        success: true,
        carrinho: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao alterar quantidade no carrinho.'
      };
    }
  },

  async removerItem(
    codigoCliente: string,
    produtoVariacaoId: number
  ): Promise<CarrinhoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}/itens/${produtoVariacaoId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao remover item do carrinho.'
        };
      }

      return {
        success: true,
        carrinho: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao remover item do carrinho.'
      };
    }
  },

  async limparCarrinho(codigoCliente: string): Promise<CarrinhoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || data.detalhe || 'Erro ao limpar o carrinho.'
        };
      }

      return {
        success: true,
        carrinho: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha de comunicação com o servidor ao limpar o carrinho.'
      };
    }
  },

  async consultarExpiracao(codigoCliente: string): Promise<ExpiracaoApiResult> {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(codigoCliente)}/expiracao`);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.erro || 'Erro ao consultar expiração do carrinho.'
        };
      }

      return {
        success: true,
        expiracao: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha ao consultar expiração do carrinho.'
      };
    }
  }
};
