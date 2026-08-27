import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import './Header.css';

export default function Header() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { customers, activeCustomer, setActiveCustomer, cartsByCustomer, toggleChatbot } = useApp();
  const navigate = useNavigate();

  const currentCart = cartsByCustomer[activeCustomer.id] || [];
  const cartCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCustomerSelect = (id: string) => {
    setActiveCustomer(id);
    setShowDropdown(false);
  };

  const handleAdminSelect = () => {
    navigate('/admin');
    setShowDropdown(false);
  };

  const triggerChatbot = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleChatbot();
  };

  return (
    <header className="main-header">
      <div className="header-container">
        {/* LOGO: RUN em verde neon, WAY em branco */}
        <Link to="/" className="logo">
          <span className="highlight">RUN</span>WAY
        </Link>

        {/* CAMPO DE BUSCA (sem botão/lupa interno) */}
        <form onSubmit={(e) => {
          e.preventDefault();
          const query = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value;
          if (query.trim()) {
            navigate(`/catalogo?busca=${encodeURIComponent(query.trim())}`);
          } else {
            navigate('/catalogo');
          }
        }} className="search-container">
          <input 
            name="search"
            type="text" 
            placeholder="Buscar tênis, marcas..." 
            className="search-input"
          />
        </form>

        {/* NAVEGAÇÃO E AÇÕES (Ordem: Chatbot -> Catálogo -> Cupons -> Pedidos -> Carrinho -> Cliente) */}
        <nav className="header-nav">
          {/* Chatbot (apenas ícone de conversa) */}
          <button 
            type="button" 
            onClick={triggerChatbot} 
            className="nav-item chatbot-icon-only" 
            title="Chatbot"
            aria-label="Abrir ou fechar assistente virtual"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          {/* Catálogo com ícone de grid/módulos */}
          <Link to="/catalogo" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Catálogo</span>
          </Link>

          {/* Cupons (direciona para Área do Cliente aba Cupons) */}
          <Link to="/cliente?tab=cupons" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            <span>Cupons</span>
          </Link>

          {/* Pedidos (direciona para Área do Cliente aba Pedidos) */}
          <Link to="/cliente?tab=pedidos" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span>Pedidos</span>
          </Link>

          {/* Carrinho com badge */}
          <Link to="/carrinho" className="nav-item cart-btn" title="Carrinho">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          {/* Perfil do Usuário (Apenas ícone de silhueta de busto) */}
          <Link to="/cliente?tab=perfil" className="nav-item profile-icon-only" title="Meu Perfil">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </Link>

          {/* Cliente: Menu Dropdown de Demonstração */}
          <div className="user-dropdown-container">
            <button 
              onClick={() => setShowDropdown(!showDropdown)} 
              className="nav-item user-btn"
              type="button"
              aria-expanded={showDropdown}
              title="Alternar Cliente / Admin"
            >
              <span className="user-name">{activeCustomer.name.split(' ')[0]}</span>
              <span className="dropdown-arrow" style={{ fontSize: '0.6rem', marginLeft: '0.15rem' }}>▼</span>
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-section-title">Alternar Cliente</div>
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleCustomerSelect(c.id)}
                    className={`dropdown-item ${c.id === activeCustomer.id ? 'active' : ''}`}
                    type="button"
                  >
                    <span className="cust-name-text">{c.name.split(' ')[0]}</span>
                    <span className={`status-tag ${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </button>
                ))}
                <div className="dropdown-divider"></div>
                <div className="dropdown-section-title">Demonstração</div>
                <button onClick={handleAdminSelect} className="dropdown-item admin-item" type="button">
                  Painel Administrativo
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
