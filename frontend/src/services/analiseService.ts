/**
 * Serviço de comunicação HTTP com o endpoint protegido de Análise Gerencial de Vendas (Cartão 03 / Cartão 04).
 * RF0055: Acesso restrito ao perfil Administrador mediante credencial administrativa informada sob demanda.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface PontoAnaliseDto {
  periodo: string; // Formato YYYY-MM
  valor: number;
}

export interface SerieCategoriaDto {
  categoria: string;
  total: number;
  dados: PontoAnaliseDto[];
}

export interface AnaliseVendasResponseDto {
  periodoInicial: string; // Formato YYYY-MM
  periodoFinal: string;   // Formato YYYY-MM
  totalGeral: number;
  periodos: string[];     // Linha do tempo contínua de competências mensais
  series: SerieCategoriaDto[];
}

export interface ConsultaAnaliseVendasParams {
  dataInicio: string; // YYYY-MM-DD ou YYYY-MM
  dataFim: string;   // YYYY-MM-DD ou YYYY-MM
  categorias: string[];
}

export interface ConsultaAnaliseVendasResult {
  sucesso: boolean;
  statusCode: number;
  mensagem?: string;
  dados?: AnaliseVendasResponseDto;
}

export interface ValidacaoAcessoAdminResult {
  sucesso: boolean;
  statusCode: number;
  mensagem?: string;
  dados?: any;
}

export const analiseService = {
  /**
   * Valida a credencial administrativa informada contra o endpoint protegido GET /api/analise/vendas.
   * Não embute credenciais no código do frontend: a chave é recebida dinamicamente da memória.
   */
  async validarAcesso(chaveAdmin?: string | null): Promise<ValidacaoAcessoAdminResult> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      if (chaveAdmin && chaveAdmin.trim().length > 0) {
        headers['Authorization'] = `Bearer ${chaveAdmin.trim()}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/analise/vendas?dataInicio=2026-01&dataFim=2026-01&categorias=TREINO%20DI%C3%81RIO`,
        {
          method: 'GET',
          headers
        }
      );

      if (response.status === 200) {
        const dados = await response.json();
        return {
          sucesso: true,
          statusCode: 200,
          dados
        };
      }

      const erroJson = await response.json().catch(() => ({}));
      return {
        sucesso: false,
        statusCode: response.status,
        mensagem: erroJson.erro || (response.status === 401
          ? 'Credencial administrativa ausente ou inválida (HTTP 401).'
          : 'Acesso negado à análise gerencial.')
      };
    } catch (err: any) {
      return {
        sucesso: false,
        statusCode: 0,
        mensagem: err.message || 'Falha de comunicação com o servidor ao validar credencial.'
      };
    }
  },

  /**
   * Consulta o histórico de vendas agrupado por período e categoria de produto (RF0055, RF0056, RF0057, RN0071, RN0072, RN0073).
   * Consome o endpoint protegido GET /api/analise/vendas com a credencial administrativa volátil.
   */
  async consultarVendas(
    params: ConsultaAnaliseVendasParams,
    chaveAdmin?: string | null,
    signal?: AbortSignal
  ): Promise<ConsultaAnaliseVendasResult> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      if (chaveAdmin && chaveAdmin.trim().length > 0) {
        headers['Authorization'] = `Bearer ${chaveAdmin.trim()}`;
      }

      const queryParams = new URLSearchParams();
      queryParams.append('dataInicio', params.dataInicio);
      queryParams.append('dataFim', params.dataFim);
      params.categorias.forEach(cat => {
        queryParams.append('categorias', cat);
      });

      const response = await fetch(`${API_BASE_URL}/api/analise/vendas?${queryParams.toString()}`, {
        method: 'GET',
        headers,
        signal
      });

      if (response.status === 200) {
        const dados: AnaliseVendasResponseDto = await response.json();
        return {
          sucesso: true,
          statusCode: 200,
          dados
        };
      }

      const erroJson = await response.json().catch(() => ({}));
      return {
        sucesso: false,
        statusCode: response.status,
        mensagem: erroJson.erro || (response.status === 401
          ? 'Credencial administrativa ausente ou inválida (HTTP 401).'
          : 'Erro ao consultar análise gerencial de vendas.')
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      return {
        sucesso: false,
        statusCode: 0,
        mensagem: err.message || 'Falha de comunicação com o servidor ao consultar análise de vendas.'
      };
    }
  }
};
