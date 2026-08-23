import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import type { Customer } from '../../../types';

export default function AdminClients() {
  const { customers, orders, updateCustomerStatus } = useApp();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

  // Filtragem de clientes
  const filteredClients = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf.includes(search)
  );

  const getClientOrdersCount = (customerId: string) => {
    return orders.filter(o => o.customerId === customerId).length;
  };

  const clientOrders = selectedClient
    ? orders.filter(o => o.customerId === selectedClient.id)
    : [];

  // Se houver cliente selecionado, exibe a visão detalhada inline (conforme protótipo)
  if (selectedClient) {
    return (
      <div className="admin-tab-content">
        <div className="detail-navigation">
          <button 
            type="button" 
            onClick={() => setSelectedClient(null)} 
            className="btn-back-link"
          >
            &larr; Voltar a Clientes
          </button>
        </div>

        <div className="admin-client-detail-header">
          <div className="client-avatar">
            {selectedClient.name.charAt(0).toUpperCase()}
          </div>
          <div className="client-name-status-block">
            <h2 className="client-detail-name">{selectedClient.name}</h2>
            <span className={`status-badge-inline ${selectedClient.status.toLowerCase()}`}>
              {selectedClient.status}
            </span>
          </div>

          <div className="client-status-toggle-action">
            {selectedClient.status === 'ATIVO' ? (
              <button
                onClick={() => {
                  updateCustomerStatus(selectedClient.id, 'INATIVO');
                  setSelectedClient(prev => prev ? { ...prev, status: 'INATIVO' } : null);
                }}
                className="btn btn-secondary btn-small btn-danger-border"
                type="button"
              >
                Inativar Cadastro
              </button>
            ) : (
              <button
                onClick={() => {
                  updateCustomerStatus(selectedClient.id, 'ATIVO');
                  setSelectedClient(prev => prev ? { ...prev, status: 'ATIVO' } : null);
                }}
                className="btn btn-primary btn-small btn-success-bg"
                type="button"
              >
                Reativar Cadastro
              </button>
            )}
          </div>
        </div>

        <div className="admin-client-detail-grid">
          {/* Dados Pessoais */}
          <div className="detail-card-panel">
            <h4 className="panel-title">DADOS PESSOAIS</h4>
            <div className="panel-rows">
              <div className="panel-row">
                <span className="row-label">CPF</span>
                <span className="row-val">{selectedClient.cpf}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">E-mail</span>
                <span className="row-val">{selectedClient.email}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Telefone</span>
                <span className="row-val">{selectedClient.phone}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Gênero</span>
                <span className="row-val">{selectedClient.gender}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Nascimento</span>
                <span className="row-val">{selectedClient.birthDate}</span>
              </div>
            </div>
          </div>

          {/* Endereços */}
          <div className="detail-card-panel">
            <h4 className="panel-title">ENDEREÇOS ({selectedClient.addresses.length})</h4>
            <div className="addresses-list">
              {selectedClient.addresses.map(addr => (
                <div key={addr.id} className="addr-block">
                  <span className="addr-label">{addr.label}</span>
                  <span className="addr-text">
                    {addr.street}, {addr.number} {addr.complement && `— ${addr.complement}`} — {addr.city}/{addr.state}
                  </span>
                  <span className="addr-cep">CEP {addr.zipCode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pedidos do Cliente */}
        <div className="detail-card-panel orders-panel">
          <h4 className="panel-title">PEDIDOS DO CLIENTE</h4>
          <div className="client-orders-list">
            {clientOrders.length > 0 ? (
              clientOrders.map(order => (
                <div key={order.id} className="client-order-row">
                  <div className="order-row-left">
                    <span className="order-id">{order.id}</span>
                    <span className="order-date">{order.date}</span>
                  </div>
                  <div className="order-row-right">
                    <span className="order-total">
                      {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className={`order-status-tag ${order.status.replace(' ', '_').toLowerCase()}`}>
                      {order.status}
                    </span>
                    <span className="order-arrow">&rarr;</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-items-txt">Nenhum pedido realizado.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">Gestão de Clientes</h3>
        
        <div className="admin-search-box">
          <input
            type="text"
            placeholder="Buscar por nome, email ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="admin-search-input"
          />
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CPF</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Pedidos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.cpf}</td>
                <td>{c.email}</td>
                <td>
                  <span className={`status-badge ${c.status.toLowerCase()}`}>
                    {c.status}
                  </span>
                </td>
                <td>{getClientOrdersCount(c.id)}</td>
                <td>
                  <button 
                    onClick={() => setSelectedClient(c)}
                    className="btn btn-secondary btn-small"
                    type="button"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
