import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import OrderDetailsModal from '../../../components/OrderDetailsModal/OrderDetailsModal';
import type { Order } from '../../../types';

export default function AdminOrders() {
  const { orders, customers, updateOrderStatus } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const getCustomerName = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    return cust ? cust.name : 'Cliente';
  };

  // Filtragem
  const filteredOrders = orders.filter(o => {
    const custName = getCustomerName(o.customerId).toLowerCase();
    const searchMatch = o.id.toLowerCase().includes(search.toLowerCase()) || custName.includes(search.toLowerCase());
    const statusMatch = statusFilter === 'TODOS' 
      || o.status === statusFilter
      || (statusFilter === 'APROVADA' && o.status === 'PAGAMENTO REALIZADO')
      || (statusFilter === 'EM TRANSPORTE' && o.status === 'EM TRÂNSITO')
      || (statusFilter === 'REPROVADA' && o.status === 'CANCELADO');
    return searchMatch && statusMatch;
  });

  const handleAdvanceStatus = async (orderId: string, nextStatus: Order['status']) => {
    setActionError(null);
    setProcessingOrderId(orderId);
    try {
      const res = await updateOrderStatus(orderId, nextStatus);
      if (!res.success) {
        setActionError(res.error || `Não foi possível atualizar o status do pedido ${orderId}.`);
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro de conexão ao atualizar status.');
    } finally {
      setProcessingOrderId(null);
    }
  };

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
            data-cy="input-admin-search-order"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="admin-filter-select"
            data-cy="select-admin-order-status"
          >
            <option value="TODOS">Todos os status</option>
            <option value="EM PROCESSAMENTO">EM PROCESSAMENTO</option>
            <option value="APROVADA">APROVADA</option>
            <option value="EM TRANSPORTE">EM TRANSPORTE</option>
            <option value="ENTREGUE">ENTREGUE</option>
            <option value="REPROVADA">REPROVADA</option>
            <option value="EM TROCA">EM TROCA</option>
            <option value="TROCA AUTORIZADA">TROCA AUTORIZADA</option>
            <option value="TROCADO">TROCADO</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div style={{
          backgroundColor: 'rgba(255, 69, 69, 0.1)',
          border: '1px solid var(--color-danger)',
          color: 'var(--color-danger)',
          padding: '0.65rem 0.9rem',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1rem'
        }} data-cy="admin-order-error-banner">
          ⚠️ {actionError}
        </div>
      )}

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
              <th>Detalhes</th>
              <th>Ações de Avanço</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
              const itemsCount = o.items.reduce((s, i) => s + i.quantity, 0);
              const isProcessingThis = processingOrderId === o.id;

              return (
                <tr key={o.id}>
                  <td><strong data-cy={`order-code-${o.id}`}>{o.id}</strong></td>
                  <td>{getCustomerName(o.customerId)}</td>
                  <td>{o.date}</td>
                  <td>{itemsCount === 1 ? '1 item' : `${itemsCount} itens`}</td>
                  <td>{o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <span className={`order-status-tag ${o.status.replace(/ /g, '_').toLowerCase()}`} data-cy={`order-status-tag-${o.id}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedOrderForDetails(o)}
                      className="btn btn-secondary btn-small"
                      type="button"
                      data-cy={`btn-detalhes-${o.id}`}
                    >
                      VER DETALHES
                    </button>
                  </td>
                  <td>
                    <div className="admin-order-adv-actions">
                      {(o.status === 'EM PROCESSAMENTO' || o.status === 'EM ABERTO') && (
                        <button
                          onClick={() => handleAdvanceStatus(o.id, 'APROVADA')}
                          className="btn btn-primary btn-small btn-status-processing"
                          type="button"
                          disabled={isProcessingThis}
                          data-cy={`btn-processar-pagamento-${o.id}`}
                        >
                          {isProcessingThis ? 'PROCESSANDO...' : 'PROCESSAR PAGAMENTO'}
                        </button>
                      )}
                      {(o.status === 'APROVADA' || o.status === 'PAGAMENTO REALIZADO') && (
                        <button
                          onClick={() => handleAdvanceStatus(o.id, 'EM TRANSPORTE')}
                          className="btn btn-primary btn-small btn-status-transit"
                          type="button"
                          disabled={isProcessingThis}
                          data-cy={`btn-despachar-${o.id}`}
                        >
                          {isProcessingThis ? 'DESPACHANDO...' : 'DESPACHAR'}
                        </button>
                      )}
                      {(o.status === 'EM TRANSPORTE' || o.status === 'EM TRÂNSITO') && (
                        <button
                          onClick={() => handleAdvanceStatus(o.id, 'ENTREGUE')}
                          className="btn btn-primary btn-small btn-status-delivered"
                          type="button"
                          disabled={isProcessingThis}
                          data-cy={`btn-confirmar-entrega-${o.id}`}
                        >
                          {isProcessingThis ? 'CONFIRMANDO...' : 'CONFIRMAR ENTREGA'}
                        </button>
                      )}
                      {o.status === 'ENTREGUE' && (
                        <span className="action-completed-text">Entregue com sucesso</span>
                      )}
                      {(o.status === 'REPROVADA' || o.status === 'CANCELADO') && (
                        <span className="action-cancelled-text">Reprovado</span>
                      )}
                      {o.status === 'EM TROCA' && (
                        <span style={{ color: '#00bfff', fontWeight: 600, fontSize: '0.8rem' }}>Troca Solicitada</span>
                      )}
                      {o.status === 'TROCA AUTORIZADA' && (
                        <span style={{ color: '#9370db', fontWeight: 600, fontSize: '0.8rem' }}>Troca Autorizada</span>
                      )}
                      {o.status === 'TROCADO' && (
                        <span className="action-completed-text">Trocado</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes do Pedido para o Admin */}
      <OrderDetailsModal
        isOpen={!!selectedOrderForDetails}
        onClose={() => setSelectedOrderForDetails(null)}
        order={selectedOrderForDetails}
      />
    </div>
  );
}
