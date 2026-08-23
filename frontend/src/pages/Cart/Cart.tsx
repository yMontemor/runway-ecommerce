import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import './Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { activeCustomer, cartsByCustomer, updateCartQuantity, removeFromCart } = useApp();
  
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);

  const cartItems = cartsByCustomer[activeCustomer.id] || [];
  
  // Totais
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const isFreeShipping = subtotal >= 500;
  const shippingCost = cartItems.length > 0 && !isFreeShipping ? 30.00 : 0.00;
  const total = subtotal + shippingCost;

  const handleCheckoutClick = () => {
    if (activeCustomer.status === 'INATIVO') {
      setIsInactiveModalOpen(true);
      return;
    }
    if (cartItems.length === 0) return;
    navigate('/checkout');
  };

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h2 className="page-title">
          Seu Carrinho <span className="title-count">({cartItems.reduce((s, i) => s + i.quantity, 0)} itens)</span>
        </h2>

        {cartItems.length > 0 ? (
          <div className="cart-layout">
            
            {/* Lista de Itens do Carrinho */}
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="cart-item-row">
                  <div className="cart-item-img-wrapper">
                    <img src={item.product.image} alt={item.product.name} />
                  </div>
                  
                  <div className="cart-item-details">
                    <span className="cart-item-brand">{item.product.brand}</span>
                    <h4 className="cart-item-name">{item.product.name}</h4>
                    <div className="cart-item-meta">
                      <span className="cart-meta-tag">Tam: <strong>{item.size}</strong></span>
                      <span className="cart-meta-tag">Cat: <strong>{item.product.category}</strong></span>
                    </div>
                  </div>

                  <div className="cart-item-price-quantity">
                    <div className="price-unit">
                      <span className="price-label">Unitário</span>
                      <span className="price-val">
                        {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <div className="quantity-adjuster">
                      <button 
                        type="button" 
                        onClick={() => updateCartQuantity(item.product.id, item.size, -1)}
                      >
                        -
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button 
                        type="button" 
                        onClick={() => updateCartQuantity(item.product.id, item.size, 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="price-subtotal">
                      <span className="price-label">Subtotal</span>
                      <span className="price-val bold-price">
                        {(item.product.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <button 
                      type="button" 
                      className="remove-item-btn" 
                      onClick={() => removeFromCart(item.product.id, item.size)}
                      title="Remover item"
                      aria-label="Remover item"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo da Compra */}
            <div className="cart-summary-sidebar">
              <div className="summary-card">
                <h3 className="summary-title">Resumo da Compra</h3>
                
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>

                <div className="summary-row">
                  <span>Frete</span>
                  <span>
                    {shippingCost === 0 ? (
                      <span className="free-shipping-text">Grátis</span>
                    ) : (
                      shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    )}
                  </span>
                </div>

                {/* Dica de Frete Grátis */}
                {!isFreeShipping && (
                  <div className="shipping-tip">
                    Faltam <strong>{(500 - subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> para ganhar frete grátis!
                  </div>
                )}
                
                {isFreeShipping && (
                  <div className="shipping-tip-free">
                    Parabéns! Sua compra atingiu o frete grátis.
                  </div>
                )}

                <div className="summary-divider"></div>

                <div className="summary-row total-row">
                  <span>Total</span>
                  <span className="total-value">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary checkout-btn" 
                  onClick={handleCheckoutClick}
                >
                  FINALIZAR COMPRA
                </button>
                
                <Link to="/catalogo" className="continue-shopping">
                  Continuar comprando
                </Link>
              </div>
            </div>

          </div>
        ) : (
          <div className="empty-cart-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#444', marginBottom: '1rem' }}>
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <p>Seu carrinho está vazio.</p>
            <Link to="/catalogo" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              IR PARA O CATÁLOGO
            </Link>
          </div>
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
