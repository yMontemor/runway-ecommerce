import { useState } from 'react';
import { useApp } from '../../../store/AppContext';

export default function AdminOrders() {
  const { orders, customers, updateOrderStatus } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const getCustomerName = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    return cust ? cust.name : 'Cliente desconhecido';
  };

  // Filtragem
  const filteredOrders = orders.filter(o => {
    const custName = getCustomerName(o.customerId).toLowerCase();
    const searchMatch = o.id.toLowerCase().includes(search.toLowerCase()) || custName.includes(search.toLowerCase());
    const statusMatch = statusFilter === 'TODOS' || o.status === statusFilter;
    return searchMatch && statusMatch;
  });

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">Gestão de Pedidos</h3>

        <div className="admin-filters-row">
          <input
            type="text"
            placeholder="Buscar por nº pedido ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="admin-search-input"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="admin-filter-select"
          >
            <option value="TODOS">Todos os status</option>
            <option value="EM ABERTO">EM ABERTO</option>
            <option value="EM PROCESSAMENTO">EM PROCESSAMENTO</option>
            <option value="PAGAMENTO REALIZADO">PAGAMENTO REALIZADO</option>
            <option value="EM TRÂNSITO">EM TRÂNSITO</option>
            <option value="ENTREGUE">ENTREGUE</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Itens</th>
              <th>Valor Total</th>
              <th>Status</th>
              <th>Ações de Avanço</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
              const itemsCount = o.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <tr key={o.id}>
                  <td><strong>{o.id}</strong></td>
                  <td>{getCustomerName(o.customerId)}</td>
                  <td>{o.date}</td>
                  <td>{itemsCount === 1 ? '1 item' : `${itemsCount} itens`}</td>
                  <td>{o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <span className={`order-status-tag ${o.status.replace(/ /g, '_').toLowerCase()}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-order-adv-actions">
                      {o.status === 'EM ABERTO' && (
                        <button
                          onClick={() => updateOrderStatus(o.id, 'EM PROCESSAMENTO')}
                          className="btn btn-primary btn-small btn-status-processing"
                          type="button"
                        >
                          PROCESSAR
                        </button>
                      )}
                      {o.status === 'EM PROCESSAMENTO' && (
                        <button
                          onClick={() => updateOrderStatus(o.id, 'PAGAMENTO REALIZADO')}
                          className="btn btn-primary btn-small btn-status-processing"
                          type="button"
                        >
                          CONFIRMAR PAGAMENTO
                        </button>
                      )}
                      {o.status === 'PAGAMENTO REALIZADO' && (
                        <button
                          onClick={() => updateOrderStatus(o.id, 'EM TRÂNSITO')}
                          className="btn btn-primary btn-small btn-status-transit"
                          type="button"
                        >
                          DESPACHAR
                        </button>
                      )}
                      {o.status === 'EM TRÂNSITO' && (
                        <button
                          onClick={() => updateOrderStatus(o.id, 'ENTREGUE')}
                          className="btn btn-primary btn-small btn-status-delivered"
                          type="button"
                        >
                          CONFIRMAR ENTREGA
                        </button>
                      )}
                      {o.status === 'ENTREGUE' && (
                        <span className="action-completed-text">Entregue com sucesso</span>
                      )}
                      {o.status === 'CANCELADO' && (
                        <span className="action-cancelled-text">Cancelado</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
