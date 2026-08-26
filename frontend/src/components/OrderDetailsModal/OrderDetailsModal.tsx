import Modal from '../Modal/Modal';
import { useApp } from '../../store/AppContext';
import type { Order } from '../../types';
import './OrderDetailsModal.css';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export default function OrderDetailsModal({ isOpen, onClose, order }: OrderDetailsModalProps) {
  const { customers } = useApp();

  if (!order) return null;

  const customer = customers.find(c => c.id === order.customerId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalhes do Pedido - ${order.id}`}
    >
      <div className="order-details-modal-content">
        
        {/* Informações Gerais */}
        <div className="order-details-section">
          <h4 className="details-sec-title">Informações Gerais</h4>
          <div className="details-grid-2">
            <div className="details-info-item">
              <span className="info-label">Cliente</span>
              <span className="info-val">{customer ? `${customer.name} (${customer.cpf})` : 'Cliente'}</span>
            </div>
            <div className="details-info-item">
              <span className="info-label">Data do Pedido</span>
              <span className="info-val">{order.date}</span>
            </div>
            <div className="details-info-item">
              <span className="info-label">Status</span>
              <div>
                <span 
                  className={`order-status-tag ${order.status.replace(/ /g, '_').toLowerCase()}`} 
                  style={{ display: 'inline-block', marginTop: '0.2rem' }}
                >
                  {order.status}
                </span>
              </div>
            </div>
            {order.shippingCost !== undefined && (
              <div className="details-info-item">
                <span className="info-label">Frete</span>
                <span className="info-val">
                  {order.shippingCost === 0 ? 'Grátis' : order.shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Itens Comprados */}
        <div className="order-details-section">
          <h4 className="details-sec-title">Itens Comprados</h4>
          <div className="details-items-list">
            {order.items.map(item => {
              const exchangedItem = order.exchangeItems?.find(
                ex => ex.productId === item.product.id && ex.size === item.size
              );
              const exchangedQty = exchangedItem?.quantity || 0;
              const keptQty = item.quantity - exchangedQty;

              return (
                <div key={`${item.product.id}-${item.size}`} className="details-item-row">
                  <div className="details-item-img-wrapper">
                    <img src={item.product.image} alt={item.product.name} className="details-item-img" />
                  </div>
                  <div className="details-item-info">
                    <span className="details-item-name">{item.product.brand} - {item.product.name}</span>
                    <span className="details-item-meta">
                      Tamanho: {item.size} | Qtd: {item.quantity} un. (Preço un: {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </span>
                    {exchangedQty > 0 && (
                      <div className="details-item-exchange-breakdown" style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="item-badge-exchange" style={{ fontSize: '0.72rem', color: 'var(--color-primary)', backgroundColor: 'rgba(198, 255, 0, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(198, 255, 0, 0.25)' }}>
                          🔄 {exchangedQty} {exchangedQty === 1 ? 'unidade em troca' : 'unidades em troca'}
                        </span>
                        {keptQty > 0 && (
                          <span className="item-badge-kept" style={{ fontSize: '0.72rem', color: '#aaa', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            ✓ {keptQty} {keptQty === 1 ? 'unidade permanece com o cliente' : 'unidades permanecem com o cliente'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="details-item-price">
                    <span>{(item.product.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Endereço de Entrega */}
        <div className="order-details-section">
          <h4 className="details-sec-title">Endereço de Entrega</h4>
          <div className="details-address-box">
            <strong className="addr-label-tag">{order.shippingAddress.label}</strong>
            <p className="addr-text" style={{ marginTop: '0.25rem' }}>
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement && ` - ${order.shippingAddress.complement}`}
            </p>
            <p className="addr-text">
              {order.shippingAddress.neighborhood} - {order.shippingAddress.city} / {order.shippingAddress.state}
            </p>
            <p className="addr-text">CEP {order.shippingAddress.zipCode}</p>
          </div>
        </div>

        {/* Método de Pagamento */}
        <div className="order-details-section">
          <h4 className="details-sec-title">Método de Pagamento</h4>
          <div className="details-payment-list">
            {/* Cupons usados */}
            {order.couponsUsed.map(coupon => (
              <div key={coupon.id} className="payment-method-row coupon-row">
                <span>🎫 Cupom ({coupon.code})</span>
                <strong>- {coupon.type === 'promo' ? `${coupon.value}%` : coupon.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
            ))}
            
            {/* Cartões de crédito ou aviso de pagamento integral por cupom */}
            {order.paymentMethods.length === 0 && order.couponsUsed.length > 0 ? (
              <div className="payment-method-row">
                <span>💳 Cartão de Crédito</span>
                <strong style={{ color: 'var(--color-success)' }}>R$ 0,00 (Pago integralmente por cupom)</strong>
              </div>
            ) : (
              order.paymentMethods.map(pm => {
                const card = customer?.cards.find(c => c.id === pm.cardId);
                const inst = pm.installments ?? 1;
                const installmentText = inst === 1
                  ? '1x à vista'
                  : `${inst}x de ${(pm.amount / inst).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`;

                return (
                  <div key={pm.cardId} className="payment-method-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span>💳 Cartão {card ? `${card.brand} final ${card.lastFour}` : `final ${pm.cardId.slice(-4)}`}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>{installmentText}</span>
                    </div>
                    <strong>{pm.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resumo de Valores */}
        <div className="order-details-section" style={{ marginBottom: 0 }}>
          <h4 className="details-sec-title">Resumo de Valores</h4>
          <div className="details-totals-box">
            <div className="totals-row">
              <span>Subtotal dos Itens</span>
              <span>{order.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div className="totals-row">
              <span>Frete</span>
              <span>{(order.shippingCost && order.shippingCost > 0) ? order.shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis'}</span>
            </div>
            {order.discountPromo && order.discountPromo > 0 ? (
              <div className="totals-row discount-text">
                <span>Desconto Promocional</span>
                <span>- {order.discountPromo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            ) : null}
            {order.discountExchange && order.discountExchange > 0 ? (
              <div className="totals-row discount-text">
                <span>Cupom de Troca</span>
                <span>- {order.discountExchange.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            ) : null}
            {(!order.discountPromo && !order.discountExchange && order.discount > 0) ? (
              <div className="totals-row discount-text">
                <span>Descontos</span>
                <span>- {order.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            ) : null}
            <div className="totals-row total-highlight">
              <span>Valor Total</span>
              <span>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          </div>
        </div>

        {/* Informações de Cancelamento / Ressarcimento se cancelado */}
        {order.status === 'CANCELADO' && (
          <div className="order-details-section" style={{ marginTop: '1.25rem', borderColor: 'rgba(255, 69, 69, 0.3)' }}>
            <h4 className="details-sec-title" style={{ color: 'var(--color-danger)' }}>Informações de Cancelamento</h4>
            <div className="details-payment-list">
              {order.cancellationRefundCouponCode ? (
                <div className="payment-method-row coupon-row">
                  <span>🎫 Novo Cupom de Troca Gerado</span>
                  <strong>{order.cancellationRefundCouponCode}</strong>
                </div>
              ) : null}
              {order.cardRefundedAmount ? (
                <div className="payment-method-row">
                  <span>💳 Estorno no Cartão de Crédito</span>
                  <strong>{order.cardRefundedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
              ) : null}
              {!order.cancellationRefundCouponCode && !order.cardRefundedAmount && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Pedido cancelado.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Informações de Troca */}
        {order.exchangeStatus && (
          <div className="order-details-section exchange-details-box" style={{ marginTop: '1.25rem' }}>
            <h4 className="details-sec-title">Informações de Troca</h4>
            <div className="details-grid-2">
              <div className="details-info-item">
                <span className="info-label">Status da Troca</span>
                <span className="exc-tag-val">{order.exchangeStatus}</span>
              </div>
              {order.exchangeReason && (
                <div className="details-info-item">
                  <span className="info-label">Motivo</span>
                  <span className="info-val">{order.exchangeReason}</span>
                </div>
              )}
            </div>

            {order.exchangeItems && order.exchangeItems.length > 0 && (
              <div className="details-exchange-items-box" style={{ marginTop: '0.85rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.75rem' }}>
                <span className="info-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, color: '#e0e0e0' }}>
                  Itens em processo de troca:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {order.exchangeItems.map((exItem, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', paddingBottom: '0.35rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>{exItem.productName}</strong>
                        <span style={{ color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>
                          Tam {exItem.size} • <span style={{ color: 'var(--color-primary)' }}>{exItem.quantity} {exItem.quantity === 1 ? 'unidade' : 'unidades'}</span>
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#fff' }}>
                        {(exItem.price * exItem.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.5rem 0 0 0' }}>
                  ✓ Itens e unidades não listados continuam normalmente com o cliente.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1.5rem' }}>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onClose}
          >
            FECHAR
          </button>
        </div>
      </div>
    </Modal>
  );
}
