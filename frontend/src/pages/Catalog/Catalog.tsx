import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { products } from '../../data/products';
import ProductCard from '../../components/ProductCard/ProductCard';
import Modal from '../../components/Modal/Modal';
import type { Product } from '../../types';
import './Catalog.css';

const CATEGORIES = ['TODOS', 'TREINO DIÁRIO', 'LONGA DISTÂNCIA', 'VELOCIDADE', 'COMPETIÇÃO', 'TRAIL'];

const CATEGORY_EMOJIS: Record<string, string> = {
  'TODOS': '',
  'TREINO DIÁRIO': '🏃',
  'LONGA DISTÂNCIA': '🔵',
  'VELOCIDADE': '⚡',
  'COMPETIÇÃO': '🏆',
  'TRAIL': '🌲'
};

export default function Catalog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart, activeCustomer } = useApp();
  
  const searchParam = searchParams.get('busca') || '';
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [sortOption, setSortOption] = useState('relevancia');

  const handleCategoryToggle = (cat: string) => {
    if (cat === 'TODOS') {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  // Controle de Modais
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  
  // Feedback de adição
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Marcas únicas
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand)));

  // Filtragem e ordenação
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategories.length === 0 || 
      selectedCategories.some(cat => p.categories.includes(cat));
    const matchesBrand = !selectedBrand || p.brand === selectedBrand;
    const matchesSearch = !searchParam || 
      p.name.toLowerCase().includes(searchParam.toLowerCase()) || 
      p.brand.toLowerCase().includes(searchParam.toLowerCase());
    return matchesCategory && matchesBrand && matchesSearch;
  });

  if (sortOption === 'price-asc') {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (sortOption === 'price-desc') {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  const handleAddToCartClick = (product: Product) => {
    if (activeCustomer.status === 'INATIVO') {
      setIsInactiveModalOpen(true);
      return;
    }
    setSelectedProduct(product);
    setSelectedSize(null);
    setIsSizeModalOpen(true);
  };

  const handleConfirmAddToCart = () => {
    if (!selectedProduct || selectedSize === null) return;

    const result = addToCart(selectedProduct.id, selectedSize, 1);
    setIsSizeModalOpen(false);

    if (result.success) {
      setToastMessage(`ADICIONADO: ${selectedProduct.name} (Nº ${selectedSize})`);
      setTimeout(() => {
        setToastMessage(null);
      }, 2500);
    } else if (result.isInactive) {
      setIsInactiveModalOpen(true);
    }
  };

  return (
    <div className="catalog-page">
      <div className="catalog-container">
        
        {/* Abas de Categorias */}
        <div className="category-tabs-container">
          <div className="category-tabs">
            {CATEGORIES.map(cat => {
              const emoji = CATEGORY_EMOJIS[cat];
              const isActive = cat === 'TODOS' 
                ? selectedCategories.length === 0 
                : selectedCategories.includes(cat);

              return (
                <button
                  key={cat}
                  type="button"
                  className={`category-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleCategoryToggle(cat)}
                >
                  {emoji && <span className="tab-emoji">{emoji}</span>}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de Filtros Secundários */}
        <div className="catalog-filters-bar">
          <div className="filters-left">
            <span className="results-count">
              <strong>{filteredProducts.length}</strong> produtos encontrados
            </span>
          </div>

          <div className="filters-right">
            {/* Filtro de Marca */}
            <div className="filter-group">
              <label htmlFor="brand-filter">Marca:</label>
              <select 
                id="brand-filter" 
                value={selectedBrand} 
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="filter-select"
              >
                <option value="">Todas as marcas</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div className="filter-group">
              <label htmlFor="sort-filter">Ordenar por:</label>
              <select 
                id="sort-filter" 
                value={sortOption} 
                onChange={(e) => setSortOption(e.target.value)}
                className="filter-select"
              >
                <option value="relevancia">Relevância</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid de Produtos */}
        {filteredProducts.length > 0 ? (
          <div className="products-grid">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCartClick={handleAddToCartClick}
              />
            ))}
          </div>
        ) : (
          <div className="empty-catalog">
            <p>Nenhum produto encontrado para os filtros selecionados.</p>
          </div>
        )}
      </div>

      {/* Modal 1: Seleção de Numeração */}
      <Modal
        isOpen={isSizeModalOpen}
        onClose={() => setIsSizeModalOpen(false)}
        title="Selecione a Numeração"
      >
        {selectedProduct && (
          <div className="size-selection-modal">
            <div className="modal-product-summary">
              <img src={selectedProduct.image} alt={selectedProduct.name} className="modal-prod-img" />
              <div>
                <span className="modal-prod-brand">{selectedProduct.brand}</span>
                <h4 className="modal-prod-name">{selectedProduct.name}</h4>
                <p className="modal-prod-price">
                  {selectedProduct.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>

            <div className="sizes-grid-container">
              <span className="sizes-title">Tamanhos Disponíveis:</span>
              <div className="sizes-grid">
                {selectedProduct.sizes.map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`size-select-btn ${selectedSize === size ? 'selected' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary cancel-btn"
                onClick={() => setIsSizeModalOpen(false)}
              >
                CANCELAR
              </button>
              <button 
                type="button" 
                className="btn btn-primary confirm-btn"
                disabled={selectedSize === null}
                onClick={handleConfirmAddToCart}
              >
                ADICIONAR AO CARRINHO
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 2: Cliente Inativo */}
      <Modal
        isOpen={isInactiveModalOpen}
        onClose={() => setIsInactiveModalOpen(false)}
        title="Cliente Inativo"
      >
        <div className="inactive-client-modal">
          <p className="inactive-warning-text">
            Clientes inativos não podem realizar compras.
          </p>
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setIsInactiveModalOpen(false)}
            >
              FECHAR
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => {
                setIsInactiveModalOpen(false);
                navigate('/cliente');
              }}
            >
              ÁREA DO CLIENTE
            </button>
          </div>
        </div>
      </Modal>

      {/* Feedback Toast */}
      {toastMessage && (
        <div className="catalog-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}>
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
