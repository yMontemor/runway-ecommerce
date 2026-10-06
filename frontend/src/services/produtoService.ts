import type { Product, ProdutoVariacaoDto, ValidacaoEstoqueResponse } from '../types';
import { products as mockProducts } from '../data/products';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface ProdutoBackendDto {
  id: number;
  codigo: string;
  nome: string;
  marca: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagemUrl: string;
  ativo: boolean;
  variacoes: ProdutoVariacaoDto[];
}

export function mapBackendToProduct(p: ProdutoBackendDto): Product {
  const mockMatch = mockProducts.find(
    m => m.id === p.codigo || m.name.toLowerCase() === p.nome.toLowerCase()
  );

  const activeVariacoes = p.variacoes ? p.variacoes.filter(v => v.ativo) : [];
  const sizes = activeVariacoes.map(v => v.tamanho).sort((a, b) => a - b);

  return {
    id: p.codigo,
    name: p.nome,
    brand: p.marca,
    category: p.categoria,
    categories: mockMatch?.categories || [p.categoria],
    price: Number(p.preco),
    description: p.descricao,
    image: p.imagemUrl || mockMatch?.image || '',
    sizes: sizes,
    variacoes: activeVariacoes,
    weight: mockMatch?.weight || '250g',
    drop: mockMatch?.drop || '8mm',
    color: mockMatch?.color || 'Padrão',
    technologies: mockMatch?.technologies || []
  };
}

export const produtoService = {
  async listar(): Promise<Product[]> {
    const response = await fetch(`${API_BASE_URL}/api/produtos`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar produtos da API: ${response.status}`);
    }

    const data: ProdutoBackendDto[] = await response.json();
    return data.map(mapBackendToProduct);
  },

  async obterPorIdOuCodigo(idOuCodigo: string): Promise<Product | null> {
    const response = await fetch(`${API_BASE_URL}/api/produtos/${idOuCodigo}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Erro ao buscar produto: ${response.status}`);
    }

    const data: ProdutoBackendDto = await response.json();
    return mapBackendToProduct(data);
  },

  async validarEstoque(
    itens: { produtoVariacaoId: number; quantidade: number }[]
  ): Promise<ValidacaoEstoqueResponse> {
    const response = await fetch(`${API_BASE_URL}/api/produtos/validar-estoque`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ itens })
    });

    if (!response.ok) {
      throw new Error(`Erro ao validar estoque: ${response.status}`);
    }

    return await response.json();
  }
};
