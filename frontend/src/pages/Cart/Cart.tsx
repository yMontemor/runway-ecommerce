import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import './Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { 
    activeCustomer, 
    cartsByCustomer, 
    cartExpiracao, 
    limparAvisoExpiracao, 
    updateCartQuantity, 
    removeFromCart, 
    validarEstoqueCarrinho 
  } = useApp();
  
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [quantityError, setQuantityError] = useState<{ [key: string]: string }>({});
  const [updatingItemKeys, setUpdatingItemKeys] = useState<Record<string, boolean>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isValidatingCheckout, setIsValidatingCheckout] = useState(false);

  const cartItems = cartsByCustomer[activeCustomer.id] || [];
  
  // Formatar tempo MM:SS
  const formatarTempo = (segundos: number): string => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

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

        {/* Banner de itens expirados (RNF0042) */}
        {cartExpiracao.itensExpirados && cartExpiracao.itensExpirados.length > 0 && (
          <div 
            className="cart-expired-notice" 
            data-cy="cart-expired-notice"
            style={{
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: 0, color: '#ef4444', fontSize: '1rem', fontWeight: 700 }}>
                  ⏱️ Reserva Expirada por Inatividade
                </h4>
                <p style={{ margin: '0.35rem 0 0.75rem 0', fontSize: '0.88rem', color: '#e2e8f0' }}>
                  {cartExpiracao.mensagemExpiracao || 'Seu carrinho excedeu o prazo de 20 minutos e as unidades reservadas foram liberadas para outros compradores.'}
                </p>
              </div>
              <button
                type="button"
                onClick={limparAvisoExpiracao}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0 0.25rem'
                }}
                title="Fechar aviso"
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f87171', marginBottom: '0.35rem' }}>
              Itens removidos do carrinho:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
              {cartExpiracao.itensExpirados.map((it, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>
                  <strong>{it.quantidade}x {it.nomeProduto}</strong> (Tamanho {it.tamanho}) — {it.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alerta de expiração iminente 5 minutos antes (RN0044) */}
        {cartItems.length > 0 && cartExpiracao.alertaExpirando && (
          <div 
            className="cart-expiration-warning-banner" 
            data-cy="cart-expiration-warning-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.25rem',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid #eab308',
              borderRadius: '8px',
              color: '#facc15'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <strong>Atenção! Sua reserva de estoque está prestes a expirar.</strong>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: '#e2e8f0' }}>
                Restam apenas <strong style={{ color: '#facc15' }}>{formatarTempo(cartExpiracao.tempoRestanteSegundos)}</strong> para concluir seu pedido antes que os produtos voltem a ficar disponíveis para outros clientes.
              </p>
            </div>
          </div>
        )}

        {/* Cronômetro discreto quando não estiver em alerta */}
        {cartItems.length > 0 && cartExpiracao.tempoRestanteSegundos > 0 && !cartExpiracao.alertaExpirando && (
          <div 
            className="cart-timer-badge"
            data-cy="cart-timer-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              marginBottom: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #333',
              borderRadius: '20px',
              fontSize: '0.82rem',
              color: '#94a3b8'
            }}
          >
            <span>⏱️</span>
            <span>Reserva garantida por: <strong style={{ color: '#fff' }}>{formatarTempo(cartExpiracao.tempoRestanteSegundos)}</strong></span>
          </div>
        )}

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
