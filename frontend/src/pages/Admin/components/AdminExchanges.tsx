import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/Modal/Modal';
import type { Exchange } from '../../../types';

export default function AdminExchanges() {
  const { exchanges, updateExchangeStatus } = useApp();
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  const handleAcceptExchange = (id: string) => {
    updateExchangeStatus(id, 'TROCA ACEITA');
  };

  const handleRejectExchange = (id: string) => {
    updateExchangeStatus(id, 'TROCA NEGADA');
  };

  const handleOpenReceiptModal = (exc: Exchange) => {
    setSelectedExchange(exc);
    setIsStockModalOpen(true);
  };

  const handleConfirmReceipt = (returnToStock: boolean) => {
    if (!selectedExchange) return;
    
    // Simular decisão de retorno ao estoque no console/histórico
    console.log(`[Troca ${selectedExchange.id}] Item retornado ao estoque: ${returnToStock ? 'SIM' : 'NÃO'}`);
    
    // Atualizar status para ITEM RECEBIDO e depois TROCA PROCESSADA para gerar o cupom
    updateExchangeStatus(selectedExchange.id, 'ITEM RECEBIDO');
    
    setTimeout(() => {
      updateExchangeStatus(selectedExchange.id, 'TROCA PROCESSADA');
    }, 500);

    setIsStockModalOpen(false);
    setSelectedExchange(null);
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">Solicitações de Trocas</h3>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Código Troca</th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Item Devolvido</th>
              <th>Valor do Item</th>
              <th>Motivo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.map(exc => (
              <tr key={exc.id}>
                <td><strong>{exc.id}</strong></td>
                <td>{exc.orderId}</td>
                <td>{exc.customerName}</td>
                <td>{exc.item.productName} (Tam {exc.item.size})</td>
                <td>{exc.item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td><span className="exc-reason-text">{exc.reason}</span></td>
                <td>
                  <span className={`status-badge ${exc.status.replace(' ', '_').toLowerCase()}`}>
                    {exc.status}
                  </span>
                </td>
                <td>
                  <div className="admin-exchange-actions">
                    {exc.status === 'TROCA SOLICITADA' && (
                      <>
                        <button
                          onClick={() => handleAcceptExchange(exc.id)}
                          className="btn btn-primary btn-small btn-status-delivered"
                          type="button"
                        >
                          ACEITAR
                        </button>
                        <button
                          onClick={() => handleRejectExchange(exc.id)}
                          className="btn btn-secondary btn-small btn-danger-border"
                          type="button"
                        >
                          NEGAR
                        </button>
                      </>
                    )}
                    {exc.status === 'TROCA ACEITA' && (
                      <span className="admin-action-wait-text">Aguardando despacho do cliente</span>
                    )}
                    {exc.status === 'ITEM ENVIADO' && (
                      <button
                        onClick={() => handleOpenReceiptModal(exc)}
                        className="btn btn-primary btn-small"
                        type="button"
                        style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                      >
                        CONFIRMAR RECEBIMENTO
                      </button>
                    )}
                    {exc.status === 'ITEM RECEBIDO' && (
                      <span className="admin-action-wait-text">Processando reembolso...</span>
                    )}
                    {exc.status === 'TROCA PROCESSADA' && (
                      <div className="admin-coupon-code-hint">
                        Cupom: <strong>{exc.refundCouponCode || 'Gerando...'}</strong>
                      </div>
                    )}
                    {exc.status === 'TROCA NEGADA' && (
                      <span className="action-cancelled-text">Troca recusada</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {exchanges.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Nenhuma solicitação de troca encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Confirmar Recebimento / Retorno ao Estoque */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title="Retornar ao Estoque?"
      >
        <div className="inactive-confirm-modal">
          <p className="modal-description-txt">
            O item devolvido está em perfeitas condições? Deseja retornar o produto ao estoque disponível para venda?
          </p>
          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1.25rem' }}>
            <button 
              onClick={() => handleConfirmReceipt(false)} 
              className="btn btn-secondary"
              type="button"
            >
              NÃO RETORNAR AO ESTOQUE
            </button>
            <button 
              onClick={() => handleConfirmReceipt(true)} 
              className="btn btn-primary"
              type="button"
            >
              SIM, RETORNAR AO ESTOQUE
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
