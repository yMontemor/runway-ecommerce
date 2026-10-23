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

export const analiseService = {
  /**
   * Consulta o histórico de vendas agrupado por período e categoria de produto (RF0055, RF0056, RF0057, RN0071, RN0072, RN0073).
   * No modelo demonstrativo do protótipo, a consulta é realizada diretamente pela camada de apresentação.
   */
  async consultarVendas(
    params: ConsultaAnaliseVendasParams,
    signal?: AbortSignal
  ): Promise<ConsultaAnaliseVendasResult> {
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
        mensagem: erroJson.erro || 'Erro ao consultar análise gerencial de vendas.'
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
