import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminClients from './components/AdminClients';
import AdminOrders from './components/AdminOrders';
import AdminExchanges from './components/AdminExchanges';
import AdminAnalytics from './components/AdminAnalytics';
import './Admin.css';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'clientes' | 'pedidos' | 'trocas' | 'analise'>('clientes');

  return (
    <div className="admin-layout-page">
      {/* Sidebar Administrativa */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          RUN<span className="brand-highlight">WAY</span> <span className="brand-tag">Admin</span>
        </div>
        
        <nav className="admin-sidebar-nav">
          <button
            onClick={() => setActiveTab('clientes')}
            className={`admin-nav-btn ${activeTab === 'clientes' ? 'active' : ''}`}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Clientes
          </button>
          
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`admin-nav-btn ${activeTab === 'pedidos' ? 'active' : ''}`}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Pedidos
          </button>
          
          <button
            onClick={() => setActiveTab('trocas')}
            className={`admin-nav-btn ${activeTab === 'trocas' ? 'active' : ''}`}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Trocas
          </button>
          
          <button
            onClick={() => setActiveTab('analise')}
            className={`admin-nav-btn ${activeTab === 'analise' ? 'active' : ''}`}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Análise
          </button>
          
          <div className="sidebar-nav-divider"></div>
          
          <button
            onClick={() => navigate('/catalogo')}
            className="admin-nav-btn btn-exit-store"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Voltar à Loja
          </button>
        </nav>
      </aside>

      {/* Painel Principal */}
      <main className="admin-main-panel">
        {activeTab === 'clientes' && <AdminClients />}
        {activeTab === 'pedidos' && <AdminOrders />}
        {activeTab === 'trocas' && <AdminExchanges />}
        {activeTab === 'analise' && <AdminAnalytics />}
      </main>
    </div>
  );
}
