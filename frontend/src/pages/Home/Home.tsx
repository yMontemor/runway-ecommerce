import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { products } from '../../data/products';
import ProductCard from '../../components/ProductCard/ProductCard';
import Modal from '../../components/Modal/Modal';
import type { Product } from '../../types';
import './Home.css';

export default function Home() {
  const { addToCart, activeCustomer } = useApp();

  // Modal de adição rápida ao carrinho
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [inactiveWarning, setInactiveWarning] = useState(false);

  const handleAddToCartClick = (product: Product) => {
    if (activeCustomer.status === 'INATIVO') {
      setInactiveWarning(true);
      return;
    }
    setQuickAddProduct(product);
    setSelectedSize(null);
    setAddedFeedback(false);
  };

  const handleConfirmAdd = () => {
    if (!quickAddProduct || selectedSize === null) return;
    addToCart(quickAddProduct.id, selectedSize, 1);
    setAddedFeedback(true);
    setTimeout(() => {
      setQuickAddProduct(null);
      setAddedFeedback(false);
    }, 1200);
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
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCartClick={handleAddToCartClick}
              />
            ))}
          </div>

          <div className="home-catalog-footer">
            <Link to="/catalogo" className="btn btn-secondary home-catalog-btn">
              VER CATÁLOGO COMPLETO COM FILTROS →
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
              {quickAddProduct.sizes.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`size-select-btn ${selectedSize === size ? 'selected' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="modal-actions" style={{ border: 'none', padding: 0, marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setQuickAddProduct(null)}>CANCELAR</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedSize === null}
                onClick={handleConfirmAdd}
              >
                ADICIONAR AO CARRINHO
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
            Sua conta está inativa. Reative sua conta na área do cliente para adicionar produtos ao carrinho.
          </p>
          <div className="modal-actions" style={{ border: 'none', padding: 0 }}>
            <button type="button" className="btn btn-primary" onClick={() => setInactiveWarning(false)}>ENTENDI</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

