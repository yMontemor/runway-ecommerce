import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { products } from '../../data/products';
import Modal from '../../components/Modal/Modal';
import './ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, activeCustomer } = useApp();

  const product = products.find(p => p.id === id) || null;

  const [prevId, setPrevId] = useState(id);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(product?.image || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (id !== prevId) {
    setPrevId(id);
    setSelectedSize(null);
    setQuantity(1);
    setSelectedImage(product?.image || '');
    setSuccessMessage(null);
  }

  // Modais e feedbacks
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!product) {
    return (
      <div className="product-detail-error">
        <p>Produto não encontrado.</p>
        <Link to="/catalogo" className="btn btn-primary">Voltar ao Catálogo</Link>
      </div>
    );
  }

  // Produtos relacionados (mesma categoria, excluindo o atual)
  const relatedProducts = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const handleAddToCart = () => {
    if (activeCustomer.status === 'INATIVO') {
      setIsInactiveModalOpen(true);
      return;
    }

    if (selectedSize === null) return;

    const result = addToCart(product.id, selectedSize, quantity);
    
    if (result.success) {
      setSuccessMessage(`Adicionado: ${quantity}x ${product.name} (Nº ${selectedSize}) no seu carrinho.`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } else if (result.isInactive) {
      setIsInactiveModalOpen(true);
    }
  };

  return (
    <div className="product-detail-page">
      <div className="detail-container">
        
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link> &gt; <Link to="/catalogo">Catálogo</Link> &gt; <span>{product.name}</span>
        </div>

        {/* Informações Principais do Produto */}
        <div className="product-main-view">
          
          {/* Galeria de Imagens */}
          <div className="product-gallery">
            <div className="main-image-container">
              <img src={selectedImage} alt={product.name} className="main-image" />
            </div>
            
            {/* Miniaturas mockadas para simulação de galeria */}
            <div className="thumbnails-list">
              <button 
                type="button"
                className={`thumb-btn ${selectedImage === product.image ? 'active' : ''}`}
                onClick={() => setSelectedImage(product.image)}
              >
                <img src={product.image} alt="Vista Lateral" />
              </button>
              {/* Variações de cor ou filtros para simular mais fotos */}
              <button 
                type="button"
                className={`thumb-btn secondary-thumb ${selectedImage === 'alt1' ? 'active' : ''}`}
                onClick={() => setSelectedImage(product.image)} // Mesma foto para simplificar
              >
                <img src={product.image} alt="Vista Superior" style={{ filter: 'hue-rotate(45deg)' }} />
              </button>
              <button 
                type="button"
                className={`thumb-btn secondary-thumb ${selectedImage === 'alt2' ? 'active' : ''}`}
                onClick={() => setSelectedImage(product.image)} // Mesma foto para simplificar
              >
                <img src={product.image} alt="Vista Traseira" style={{ filter: 'brightness(0.7) contrast(1.2)' }} />
              </button>
            </div>
          </div>

          {/* Ficha Técnica e Compra */}
          <div className="product-buy-card">
            <span className="product-brand">{product.brand}</span>
            <h2 className="product-name">{product.name}</h2>
            <div className="product-categories-tags-row" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {product.categories.map(cat => (
                <span key={cat} className="product-category-tag">{cat}</span>
              ))}
            </div>
            
            <div className="product-price">
              {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>

            <p className="product-description">{product.description}</p>

            {/* Especificações Técnicas */}
            <div className="product-specifications">
              <div className="spec-item">
                <span className="spec-label">Cor</span>
                <span className="spec-value">{product.color}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Peso</span>
                <span className="spec-value">{product.weight}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Tecnologias</span>
                <span className="spec-value">{product.technologies.join(', ')}</span>
              </div>
            </div>

            {/* Seleção de Tamanho */}
            <div className="size-selector-section">
              <span className="selector-title">
                Selecione o tamanho: {selectedSize ? <strong>Nº {selectedSize}</strong> : <span className="warning-select">Selecione um tamanho</span>}
              </span>
              <div className="detail-sizes-grid">
                {product.sizes.map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`detail-size-btn ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantidade e Ações */}
            <div className="quantity-and-buy">
              <div className="quantity-selector">
                <button 
                  type="button" 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="quantity-value">{quantity}</span>
                <button 
                  type="button" 
                  onClick={() => setQuantity(q => q + 1)}
                >
                  +
                </button>
              </div>

              <div className="buy-actions-wrapper">
                <button
                  type="button"
                  className="btn btn-primary buy-add-btn"
                  disabled={selectedSize === null}
                  onClick={handleAddToCart}
                >
                  ADICIONAR AO CARRINHO
                </button>
                
                <Link to="/carrinho" className="btn btn-secondary buy-cart-btn">
                  VER CARRINHO
                </Link>
              </div>
            </div>

            {/* Feedback Mensagem */}
            {successMessage && (
              <div className="add-success-feedback">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {successMessage}
              </div>
            )}
          </div>
        </div>

        {/* Produtos Relacionados */}
        {relatedProducts.length > 0 && (
          <section className="related-products-section">
            <h3 className="section-title">Mais em {product.category}</h3>
            
            <div className="related-grid">
              {relatedProducts.map(related => (
                <div key={related.id} className="related-item-card">
                  <Link to={`/produto/${related.id}`} className="related-link">
                    <div className="related-img-wrapper">
                      <img src={related.image} alt={related.name} />
                    </div>
                    <span className="related-brand">{related.brand}</span>
                    <h5 className="related-name">{related.name}</h5>
                    <span className="related-price">
                      {related.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal Cliente Inativo */}
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
    </div>
  );
}
