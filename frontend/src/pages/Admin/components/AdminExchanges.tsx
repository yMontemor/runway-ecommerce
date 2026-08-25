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

  const handleConfirmReceiptClick = (exc: Exchange) => {
    // Transição explícita para ITEM RECEBIDO e abertura da decisão de retorno ao estoque
    updateExchangeStatus(exc.id, 'ITEM RECEBIDO');
    setSelectedExchange(exc);
    setIsStockModalOpen(true);
  };

  const handleOpenStockModalOnly = (exc: Exchange) => {
    setSelectedExchange(exc);
    setIsStockModalOpen(true);
  };

  const handleConfirmReceipt = (returnToStock: boolean) => {
    if (!selectedExchange) return;
    
    // Simular decisão de retorno ao estoque no console/histórico
    console.log(`[Troca ${selectedExchange.id}] Item retornado ao estoque: ${returnToStock ? 'SIM' : 'NÃO'}`);
    
    // Transição explícita para TROCA PROCESSADA e geração do cupom de troca
    updateExchangeStatus(selectedExchange.id, 'TROCA PROCESSADA', returnToStock);

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
              <th>Itens Devolvidos</th>
              <th>Valor da Troca</th>
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
                <td>
                  <div className="admin-exchange-items-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {exc.items && exc.items.length > 0 ? (
                      exc.items.map((it, idx) => (
                        <div key={idx} className="admin-exchange-item-row" style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#fff' }}>{it.productName}</strong> <span style={{ color: '#aaa' }}>(Tam {it.size})</span>
                          <span style={{ color: 'var(--color-primary)', marginLeft: '0.35rem', fontWeight: 600 }}>
                            • {it.quantity} {it.quantity === 1 ? 'un.' : 'un.'}
                          </span>
                        </div>
                      ))
                    ) : exc.item ? (
                      <div style={{ fontSize: '0.82rem' }}>
                        <strong style={{ color: '#fff' }}>{exc.item.productName}</strong> (Tam {exc.item.size}) • 1 un.
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  <strong style={{ color: '#fff' }}>
                    {(exc.totalValue ?? (exc.items ? exc.items.reduce((s, it) => s + it.price * it.quantity, 0) : exc.item?.price || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </td>
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
                        onClick={() => handleConfirmReceiptClick(exc)}
                        className="btn btn-primary btn-small"
                        type="button"
                        style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                      >
                        CONFIRMAR RECEBIMENTO
                      </button>
                    )}
                    {exc.status === 'ITEM RECEBIDO' && (
                      <button
                        onClick={() => handleOpenStockModalOnly(exc)}
                        className="btn btn-primary btn-small"
                        type="button"
                        style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                      >
                        DECIDIR RETORNO AO ESTOQUE
                      </button>
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
            Os itens e quantidades devolvidos estão em perfeitas condições? Deseja retornar os produtos ao estoque disponível para venda?
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
