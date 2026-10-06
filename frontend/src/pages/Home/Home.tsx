import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import ProductCard from '../../components/ProductCard/ProductCard';
import Modal from '../../components/Modal/Modal';
import type { Product } from '../../types';
import './Home.css';

export default function Home() {
  const { addToCart, activeCustomer, products, isLoadingProducts, productsLoadError, refreshProducts } = useApp();

  // Modal de adição rápida ao carrinho
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [inactiveWarning, setInactiveWarning] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCartClick = (product: Product) => {
    if (activeCustomer.status === 'INATIVO') {
      setInactiveWarning(true);
      return;
    }
    setQuickAddProduct(product);
    setSelectedSize(null);
    setAddedFeedback(false);
    setStockError(null);
  };

  const handleConfirmAdd = async () => {
    if (!quickAddProduct || selectedSize === null) return;
    setStockError(null);
    setIsAdding(true);

    try {
      const variacao = quickAddProduct.variacoes?.find(v => v.tamanho === selectedSize);
      const result = await addToCart(quickAddProduct.id, selectedSize, 1, variacao?.id);
      
      if (result.success) {
        setAddedFeedback(true);
        setTimeout(() => {
          setQuickAddProduct(null);
          setAddedFeedback(false);
        }, 1200);
      } else if (result.isInactive) {
        setInactiveWarning(true);
      } else if (result.message) {
        setStockError(result.message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleScrollToCatalog = (e: React.MouseEvent) => {
    e.preventDefault();
    const section = document.getElementById('catalogo-home');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <span className="hero-tag">NOSSA COLEÇÃO 2026</span>
            <h1 className="hero-title">
              CORRA<br />
              <span className="neon-highlight">MAIS</span><br />
              RÁPIDO
            </h1>
            <p className="hero-subtitle">
              Encontre o tênis certo para cada corrida.
            </p>
            <a href="#catalogo-home" onClick={handleScrollToCatalog} className="btn btn-primary hero-btn">
              VER CATÁLOGO
            </a>
          </div>
        </div>
      </section>

      {/* Seção de Catálogo na Home */}
      <section id="catalogo-home" className="home-catalog-section">
        <div className="home-catalog-container">
          <div className="home-catalog-header">
            <h2 className="home-catalog-title">NOSSOS <span className="neon-highlight">DESTAQUES</span></h2>
            <p className="home-catalog-subtitle">Os melhores tênis de corrida para cada tipo de treino.</p>
          </div>

          <div className="home-catalog-grid">
            {isLoadingProducts ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
                <p>Carregando destaques do catálogo...</p>
              </div>
            ) : productsLoadError && products.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem' }}>
                <p style={{ color: '#f87171', fontWeight: 600, marginBottom: '1rem' }}>
                  {productsLoadError}
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => refreshProducts()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCartClick={handleAddToCartClick}
                />
              ))
            )}
          </div>

          <div className="home-catalog-footer">
            <Link to="/catalogo" className="btn btn-secondary home-catalog-btn">
              VER CATÁLOGO COMPLETO →
            </Link>
          </div>
        </div>
      </section>

      {/* Modal de seleção de tamanho (reutilizado do Catalog) */}
      <Modal
        isOpen={!!quickAddProduct}
        onClose={() => setQuickAddProduct(null)}
        title={quickAddProduct ? `${quickAddProduct.brand} - ${quickAddProduct.name}` : ''}
      >
        {quickAddProduct && !addedFeedback && (
          <div className="home-size-modal">
            <p className="home-size-label">Selecione o tamanho:</p>
            <div className="home-size-grid">
              {quickAddProduct.sizes.map(size => {
                const varInfo = quickAddProduct.variacoes?.find(v => v.tamanho === size);
                const isOutOfStock = varInfo ? varInfo.quantidadeEstoque <= 0 : false;
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={isOutOfStock}
                    title={isOutOfStock ? 'Esgotado' : `${varInfo?.quantidadeEstoque ?? ''} disponíveis`}
                    onClick={() => setSelectedSize(size)}
                    data-cy={`btn-tamanho-${size}`}
                    className={`size-select-btn ${selectedSize === size ? 'selected' : ''}`}
                    style={isOutOfStock ? { opacity: 0.45, cursor: 'not-allowed', textDecoration: 'line-through' } : undefined}
                  >
                    {size}
                  </button>
                );
              })}
            </div>

            {selectedSize !== null && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                {(() => {
                  const v = quickAddProduct.variacoes?.find(varItem => varItem.tamanho === selectedSize);
                  if (!v) return null;
                  return v.quantidadeEstoque > 0 ? (
                    <span style={{ color: '#4ade80' }}>Disponível em estoque: {v.quantidadeEstoque} unidades</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>Este tamanho está indisponível no momento.</span>
                  );
                })()}
              </div>
            )}

            {stockError && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.85rem' }}>
                {stockError}
              </div>
            )}

            <div className="modal-actions" style={{ border: 'none', padding: 0, marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setQuickAddProduct(null)}>CANCELAR</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedSize === null || isAdding}
                onClick={handleConfirmAdd}
                data-cy="btn-confirmar-adicionar-carrinho"
              >
                {isAdding ? 'VERIFICANDO...' : 'ADICIONAR AO CARRINHO'}
              </button>
            </div>
          </div>
        )}
        {addedFeedback && (
          <div className="home-added-feedback">
            <span className="feedback-icon">✓</span>
            <p>Produto adicionado ao carrinho!</p>
          </div>
        )}
      </Modal>

      {/* Modal de aviso para conta inativa */}
      <Modal
        isOpen={inactiveWarning}
        onClose={() => setInactiveWarning(false)}
        title="Conta Inativa"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            Sua conta está inativa. Clientes inativos não podem realizar compras.
          </p>
          <div className="modal-actions" style={{ border: 'none', padding: 0 }}>
            <button type="button" className="btn btn-primary" onClick={() => setInactiveWarning(false)}>ENTENDI</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

