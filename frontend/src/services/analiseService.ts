/**
 * Serviço de comunicação HTTP com o endpoint de Análise Gerencial de Vendas (Cartão 03 / Cartão 04).
 * RF0055: Consulta gerencial de vendas por período e categoria consumida pelo painel administrativo demonstrativo.
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

export type TipoErroAnalise = 'TIMEOUT' | 'NETWORK' | 'HTTP';

export interface ConsultaAnaliseVendasResult {
  sucesso: boolean;
  statusCode: number;
  tipoErro?: TipoErroAnalise;
  mensagem?: string;
  dados?: AnaliseVendasResponseDto;
}

const ANALISE_REQUEST_TIMEOUT_MS = 10000;

export const analiseService = {
  /**
   * Consulta o histórico de vendas agrupado por período e categoria de produto (RF0055, RF0056, RF0057, RN0071, RN0072, RN0073).
   * No modelo demonstrativo do protótipo, a consulta é realizada diretamente pela camada de apresentação.
   * Possui timeout controlado de 10s para recuperação de falhas de comunicação (não substitui o limite RNF0011 <= 1s).
   */
  async consultarVendas(
    params: ConsultaAnaliseVendasParams,
    signal?: AbortSignal,
    timeoutMs: number = ANALISE_REQUEST_TIMEOUT_MS
  ): Promise<ConsultaAnaliseVendasResult> {
    if (signal?.aborted) {
      const abortErr = new Error('Consulta cancelada.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const internalController = new AbortController();
    let timedOut = false;

    const handleExternalAbort = () => {
      internalController.abort();
    };

    if (signal) {
      signal.addEventListener('abort', handleExternalAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      internalController.abort();
    }, timeoutMs);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('dataInicio', params.dataInicio);
      queryParams.append('dataFim', params.dataFim);
      params.categorias.forEach(cat => {
        queryParams.append('categorias', cat);
      });

      const response = await fetch(`${API_BASE_URL}/api/analise/vendas?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: internalController.signal
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
        tipoErro: 'HTTP',
        mensagem: erroJson.erro || `Erro HTTP ${response.status} ao consultar análise gerencial de vendas.`
      };
    } catch (err: any) {
      // Cancelamento intencional por nova consulta sobreposta ou desmontagem do componente
      if (!timedOut && (signal?.aborted || err?.name === 'AbortError')) {
        const abortErr = new Error('Consulta substituída por uma requisição mais recente.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      // Timeout explícito de comunicação
      if (timedOut) {
        return {
          sucesso: false,
          statusCode: 408,
          tipoErro: 'TIMEOUT',
          mensagem: `A consulta excedeu o tempo limite de ${Math.round(timeoutMs / 1000)} segundos. Verifique se o servidor está respondendo e tente novamente.`
        };
      }

      // Falha de rede / backend indisponível
      return {
        sucesso: false,
        statusCode: 0,
        tipoErro: 'NETWORK',
        mensagem: 'Não foi possível comunicar com o servidor para consultar a análise de vendas. Verifique se o backend está em execução e tente novamente.'
      };
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', handleExternalAbort);
      }
    }
  }
};
