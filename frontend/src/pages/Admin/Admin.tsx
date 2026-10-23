import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import AdminClients from './components/AdminClients';
import AdminOrders from './components/AdminOrders';
import AdminExchanges from './components/AdminExchanges';
import AdminAnalytics from './components/AdminAnalytics';
import './Admin.css';

export default function Admin() {
  const navigate = useNavigate();
  const { activeProfile, enterAdminMode, exitAdminToStore } = useApp();
  const [activeTab, setActiveTab] = useState<'clientes' | 'pedidos' | 'trocas' | 'analise'>('clientes');

  // Proteção demonstrativa: se estiver em modo Cliente ao acessar /admin diretamente,
  // preserva o modo Cliente e exibe a barreira visual sem ativar o perfil automaticamente.
  if (activeProfile === 'CLIENTE') {
    return (
      <div className="admin-analytics-restricted" data-cy="admin-acesso-restrito-cliente">
        <div className="restricted-card">
          <div className="restricted-icon">🔒</div>
          <h2>Acesso Restrito — Painel Administrativo</h2>
          <p>
            O painel administrativo é destinado à demonstração das funcionalidades do perfil <strong>Administrador</strong>.
          </p>
          <div className="restricted-badge">
            Perfil Atual: <span className="tag-cliente">CLIENTE</span>
          </div>
          <p className="restricted-hint">
            Para acessar o painel de gestão, ative explicitamente o modo Administrador:
          </p>
          <div className="restricted-actions">
            <button
              type="button"
              onClick={() => {
                exitAdminToStore();
                navigate('/');
              }}
              className="btn-cancel-unlock"
              data-cy="btn-voltar-loja-bloqueio"
            >
              Voltar à Loja
            </button>
            <button
              type="button"
              onClick={() => enterAdminMode()}
              className="btn-unlock-profile"
              data-cy="btn-ativar-admin-explicitamente"
            >
              Ativar Modo Administrador
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout-page" data-cy="admin-layout">
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
            data-cy="admin-clientes"
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
            data-cy="admin-pedidos"
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
            data-cy="admin-trocas"
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
            data-cy="admin-analise"
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
            onClick={() => {
              exitAdminToStore();
              navigate('/');
            }}
            className="admin-nav-btn btn-exit-store"
            type="button"
            data-cy="btn-admin-voltar-loja"
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
