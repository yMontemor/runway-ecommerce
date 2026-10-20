import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/Modal/Modal';
import type { Exchange } from '../../../types';

export default function AdminExchanges() {
  const { exchanges, updateExchangeStatus } = useApp();
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isModalProcessing, setIsModalProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAcceptExchange = async (id: string) => {
    setActionLoadingId(id);
    setErrorMessage(null);
    try {
      await updateExchangeStatus(id, 'TROCA AUTORIZADA');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao autorizar solicitação de troca');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReceiptClick = (exc: Exchange) => {
    setSelectedExchange(exc);
    setIsStockModalOpen(true);
  };

  const handleConfirmReceipt = async (returnToStock: boolean) => {
    if (!selectedExchange) return;
    setIsModalProcessing(true);
    setErrorMessage(null);
    try {
      await updateExchangeStatus(selectedExchange.id, 'TROCADO', returnToStock);
      setIsStockModalOpen(false);
      setSelectedExchange(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao confirmar recebimento e gerar cupom');
    } finally {
      setIsModalProcessing(false);
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row">
        <h3 className="admin-tab-title">Solicitações de Trocas</h3>
      </div>

      {errorMessage && (
        <div 
          className="admin-error-banner"
          style={{
            backgroundColor: 'rgba(255, 69, 69, 0.15)',
            border: '1px solid var(--color-danger)',
            color: '#ff6b6b',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{errorMessage}</span>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

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
                <td><strong data-cy={`exchange-code-${exc.id}`}>{exc.id}</strong></td>
                <td>{exc.orderId}</td>
                <td>{exc.customerName}</td>
                <td>
                  <div className="admin-exchange-items-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {exc.items && exc.items.length > 0 ? (
                      exc.items.map((it, idx) => (
                        <div key={idx} className="admin-exchange-item-row" style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#fff' }}>{it.productName}</strong> <span style={{ color: '#aaa' }}>(Tam {it.size})</span>
                          <span style={{ color: 'var(--color-primary)', marginLeft: '0.35rem', fontWeight: 600 }}>
                            • {it.quantity} un.
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
                  <span className={`order-status-tag ${exc.status.replace(/\s+/g, '_').toLowerCase()}`} data-cy={`exchange-status-${exc.id}`}>
                    {exc.status}
                  </span>
                </td>
                <td>
                  <div className="admin-exchange-actions">
                    {(exc.status === 'EM TROCA' || exc.status === 'TROCA SOLICITADA') && (
                      <button
                        onClick={() => handleAcceptExchange(exc.id)}
                        className="btn btn-primary btn-small btn-status-delivered"
                        type="button"
                        disabled={actionLoadingId === exc.id}
                        data-cy={`btn-aceitar-troca-${exc.id}`}
                      >
                        {actionLoadingId === exc.id ? 'PROCESSANDO...' : 'ACEITAR'}
                      </button>
                    )}
                    {(exc.status === 'TROCA AUTORIZADA' || exc.status === 'TROCA ACEITA' || exc.status === 'ITEM ENVIADO' || exc.status === 'ITEM RECEBIDO') && (
                      <button
                        onClick={() => handleConfirmReceiptClick(exc)}
                        className="btn btn-primary btn-small"
                        type="button"
                        style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                        disabled={actionLoadingId === exc.id}
                        data-cy={`btn-confirmar-recebimento-${exc.id}`}
                      >
                        CONFIRMAR RECEBIMENTO
                      </button>
                    )}
                    {(exc.status === 'TROCADO' || exc.status === 'TROCA PROCESSADA') && (
                      <div className="admin-coupon-code-hint" data-cy={`exchange-coupon-${exc.id}`}>
                        Cupom: <strong>{exc.refundCouponCode || exc.codigoCupom || 'Gerado'}</strong>
                      </div>
                    )}
                    {(exc.status === 'TROCA RECUSADA' || exc.status === 'TROCA NEGADA') && (
                      <span className="action-cancelled-text" data-cy={`exchange-recusada-${exc.id}`}>Troca recusada</span>
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
        onClose={() => !isModalProcessing && setIsStockModalOpen(false)}
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
              disabled={isModalProcessing}
              data-cy="btn-nao-retornar-estoque"
            >
              {isModalProcessing ? 'PROCESSANDO...' : 'NÃO RETORNAR AO ESTOQUE'}
            </button>
            <button 
              onClick={() => handleConfirmReceipt(true)} 
              className="btn btn-primary"
              type="button"
              disabled={isModalProcessing}
              data-cy="btn-sim-retornar-estoque"
            >
              {isModalProcessing ? 'PROCESSANDO...' : 'SIM, RETORNAR AO ESTOQUE'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

