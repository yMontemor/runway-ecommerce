import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import './Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { activeCustomer, cartsByCustomer, updateCartQuantity, removeFromCart, validarEstoqueCarrinho } = useApp();
  
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [quantityError, setQuantityError] = useState<{ [key: string]: string }>({});
  const [updatingItemKeys, setUpdatingItemKeys] = useState<Record<string, boolean>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isValidatingCheckout, setIsValidatingCheckout] = useState(false);

  const cartItems = cartsByCustomer[activeCustomer.id] || [];
  
  // Totais
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal;

  const handleQuantityChange = async (productId: string, size: number, delta: number) => {
    const key = `${productId}-${size}`;
    if (updatingItemKeys[key]) return;

    setUpdatingItemKeys(prev => ({ ...prev, [key]: true }));
    setCheckoutError(null);
    setQuantityError(prev => ({ ...prev, [key]: '' }));

    try {
      const result = await updateCartQuantity(productId, size, delta);
      if (!result.success && result.message) {
        setQuantityError(prev => ({ ...prev, [key]: result.message || '' }));
        setTimeout(() => {
          setQuantityError(prev => ({ ...prev, [key]: '' }));
        }, 4000);
      }
    } finally {
      setUpdatingItemKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleCheckoutClick = async () => {
    if (activeCustomer.status === 'INATIVO') {
      setIsInactiveModalOpen(true);
      return;
    }
    if (cartItems.length === 0) return;

    setCheckoutError(null);
    setIsValidatingCheckout(true);

    try {
      const validacao = await validarEstoqueCarrinho();
      if (!validacao.valido) {
        setCheckoutError(validacao.mensagem || 'Há itens com estoque insuficiente no carrinho.');
        return;
      }
      navigate('/checkout');
    } finally {
      setIsValidatingCheckout(false);
    }
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
            <div className="cart-items-list" data-cy="cart-items-list">
              {cartItems.map((item) => {
                const itemKey = `${item.product.id}-${item.size}`;
                const isUpdating = !!updatingItemKeys[itemKey];

                return (
                  <div key={itemKey} className="cart-item-row" data-cy="cart-item-row">
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
                          disabled={isUpdating}
                          onClick={() => handleQuantityChange(item.product.id, item.size, -1)}
                          aria-label="Diminuir quantidade"
                          data-cy="btn-decrease-qty"
                        >
                          -
                        </button>
                        <span className="qty-value" data-cy="cart-item-qty">{item.quantity}</span>
                        <button 
                          type="button" 
                          disabled={isUpdating}
                          onClick={() => handleQuantityChange(item.product.id, item.size, 1)}
                          aria-label="Aumentar quantidade"
                          data-cy="btn-increase-qty"
                        >
                          +
                        </button>
                      </div>

                      {quantityError[itemKey] && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem', width: '100%', textAlign: 'center' }} data-cy="cart-quantity-error">
                          {quantityError[itemKey]}
                        </div>
                      )}

                    <div className="price-subtotal">
                      <span className="price-label">Subtotal</span>
                      <span className="price-val bold-price" data-cy="cart-item-subtotal">
                        {(item.product.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <button 
                      type="button" 
                      className="remove-item-btn" 
                      onClick={() => removeFromCart(item.product.id, item.size)}
                      title="Remover item"
                      aria-label="Remover item"
                      data-cy="btn-remove-item"
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
                );
              })}
            </div>

            {/* Resumo da Compra */}
            <div className="cart-summary-sidebar">
              <div className="summary-card">
                <h3 className="summary-title">Resumo da Compra</h3>
                
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span data-cy="cart-subtotal-value">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>

                <div className="summary-row">
                  <span>Frete</span>
                  <span data-cy="cart-shipping-value" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    Calculado no checkout
                  </span>
                </div>

                <div className="summary-divider"></div>

                <div className="summary-row total-row">
                  <span>Total</span>
                  <span className="total-value" data-cy="cart-total-value">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>

                {checkoutError && (
                  <div style={{ margin: '0.75rem 0', padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.85rem' }} data-cy="checkout-error-banner">
                    {checkoutError}
                  </div>
                )}

                <button 
                  type="button" 
                  className="btn btn-primary checkout-btn" 
                  disabled={isValidatingCheckout}
                  onClick={handleCheckoutClick}
                  data-cy="btn-cart-checkout"
                >
                  {isValidatingCheckout ? 'VERIFICANDO ESTOQUE...' : 'FINALIZAR COMPRA'}
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
