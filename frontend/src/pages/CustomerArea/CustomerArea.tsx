import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import type { Address, CreditCard, Order } from '../../types';
import './CustomerArea.css';

export default function CustomerArea() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const { 
    activeCustomer, 
    orders, 
    coupons, 
    exchanges,
    updateCustomerStatus,
    cancelOrder,
    confirmOrderReceipt,
    requestExchange,
    updateExchangeStatus,
    updateCustomerProfile,
    addCustomerAddress,
    updateCustomerAddress,
    addCustomerCard,
    updateCustomerCard,
    removeCustomerCard,
    setCardAsPreferred
  } = useApp();

  const tabParamVal = tabParam === 'pedidos' ? 'pedidos' : tabParam === 'cupons' ? 'cupons' : 'perfil';
  const [prevTabParam, setPrevTabParam] = useState(tabParamVal);
  const [activeTab, setActiveTab] = useState(tabParamVal);

  if (tabParamVal !== prevTabParam) {
    setPrevTabParam(tabParamVal);
    setActiveTab(tabParamVal);
  }

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  // Módulos de Edição de Perfil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: activeCustomer.name,
    email: activeCustomer.email,
    phone: activeCustomer.phone,
    gender: activeCustomer.gender,
    birthDate: activeCustomer.birthDate
  });

  const [prevCustomerForProfile, setPrevCustomerForProfile] = useState(activeCustomer.id);
  if (activeCustomer.id !== prevCustomerForProfile) {
    setPrevCustomerForProfile(activeCustomer.id);
    setProfileForm({
      name: activeCustomer.name,
      email: activeCustomer.email,
      phone: activeCustomer.phone,
      gender: activeCustomer.gender,
      birthDate: activeCustomer.birthDate
    });
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerProfile({
      ...activeCustomer,
      ...profileForm
    });
    setIsEditingProfile(false);
  };

  // Módulos de Inativação/Reativação
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);

  // Módulos de Cartões
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardForm, setCardForm] = useState({
    brand: 'Visa' as CreditCard['brand'],
    lastFour: '',
    holderName: '',
    expirationDate: '',
    isPreferred: false
  });
  const [cardToRemoveId, setCardToRemoveId] = useState<string | null>(null);

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardForm({
      brand: 'Visa',
      lastFour: '',
      holderName: '',
      expirationDate: '',
      isPreferred: false
    });
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setCardForm({
      brand: card.brand,
      lastFour: card.lastFour,
      holderName: card.holderName,
      expirationDate: card.expirationDate,
      isPreferred: card.isPreferred
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.lastFour || !cardForm.holderName || !cardForm.expirationDate) return;

    if (editingCard) {
      updateCustomerCard(activeCustomer.id, {
        ...editingCard,
        ...cardForm,
        lastFour: cardForm.lastFour.replace(/\D/g, '').slice(-4),
        holderName: cardForm.holderName.toUpperCase()
      });
    } else {
      addCustomerCard(activeCustomer.id, {
        brand: cardForm.brand,
        lastFour: cardForm.lastFour.replace(/\D/g, '').slice(-4),
        holderName: cardForm.holderName.toUpperCase(),
        expirationDate: cardForm.expirationDate,
        isPreferred: cardForm.isPreferred
      });
    }
    setIsCardModalOpen(false);
    setEditingCard(null);
    setCardForm({ brand: 'Visa', lastFour: '', holderName: '', expirationDate: '', isPreferred: false });
  };

  // Módulos de Endereços
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addrForm, setAddrForm] = useState({
    label: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    zipCode: '',
    city: '',
    state: '',
    country: 'Brasil',
    observations: ''
  });

  const handleOpenAddAddr = () => {
    setEditingAddress(null);
    setAddrForm({
      label: '', street: '', number: '', complement: '', neighborhood: '',
      zipCode: '', city: '', state: '', country: 'Brasil', observations: ''
    });
    setIsAddrModalOpen(true);
  };

  const handleOpenEditAddr = (addr: Address) => {
    setEditingAddress(addr);
    setAddrForm({
      label: addr.label, street: addr.street, number: addr.number, complement: addr.complement || '',
      neighborhood: addr.neighborhood, zipCode: addr.zipCode, city: addr.city, state: addr.state,
      country: addr.country, observations: addr.observations || ''
    });
    setIsAddrModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAddress) {
      updateCustomerAddress(activeCustomer.id, {
        ...editingAddress,
        ...addrForm
      });
    } else {
      addCustomerAddress(activeCustomer.id, addrForm);
    }
    setIsAddrModalOpen(false);
  };

  // --- CONTROLE DE TROCA ---
  interface SelectedExchangeItemState {
    productId: string;
    size: number;
    quantity: number;
  }

  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [selectedOrderForExc, setSelectedOrderForExc] = useState<Order | null>(null);
  const [selectedExcItems, setSelectedExcItems] = useState<SelectedExchangeItemState[]>([]);
  const [exchangeReason, setExchangeReason] = useState('');

  const handleOpenExchange = (order: Order) => {
    setSelectedOrderForExc(order);
    setSelectedExcItems([]);
    setExchangeReason('');
    setIsExchangeModalOpen(true);
  };

  const handleToggleItemSelection = (productId: string, size: number, maxQty: number) => {
    setSelectedExcItems(prev => {
      const exists = prev.find(i => i.productId === productId && i.size === size);
      if (exists) {
        return prev.filter(i => !(i.productId === productId && i.size === size));
      } else {
        return [...prev, { productId, size, quantity: Math.min(1, maxQty) }];
      }
    });
  };

  const handleUpdateItemQuantity = (productId: string, size: number, newQty: number, maxQty: number) => {
    const clampedQty = Math.max(1, Math.min(newQty, maxQty));
    setSelectedExcItems(prev =>
      prev.map(item =>
        item.productId === productId && item.size === size
          ? { ...item, quantity: clampedQty }
          : item
      )
    );
  };

  const handleConfirmExchangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForExc || selectedExcItems.length === 0 || !exchangeReason.trim()) return;
    
    requestExchange(selectedOrderForExc.id, selectedExcItems, exchangeReason.trim());
    setIsExchangeModalOpen(false);
  };

  // --- CONTROLE DE DETALHES DE PEDIDO ---
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);

  const handleOpenOrderDetails = (order: Order) => {
    setSelectedOrderForDetails(order);
    setIsOrderDetailsModalOpen(true);
  };

  // Filtrar dados do cliente atual
  const customerOrders = orders.filter(o => o.customerId === activeCustomer.id);
  const customerCoupons = coupons.filter(c => c.customerId === activeCustomer.id);

  return (
    <div className="customer-area-page">
      <div className="customer-container">
        
        {/* Banner do Perfil do Cliente */}
        <div className="profile-header-banner">
          <div className="profile-avatar">
            {activeCustomer.name.charAt(0)}
          </div>
          <div className="profile-header-info">
            <h2 className="profile-client-name">{activeCustomer.name}</h2>
            <p className="profile-client-email">{activeCustomer.email}</p>
            <span className={`status-badge ${activeCustomer.status.toLowerCase()}`}>
              Conta {activeCustomer.status}
            </span>
          </div>

          <div className="profile-header-action">
            {activeCustomer.status === 'ATIVO' ? (
              <button 
                onClick={() => setIsInactivateModalOpen(true)} 
                className="btn btn-secondary btn-inactivate"
                type="button"
              >
                INATIVAR MEU CADASTRO
              </button>
            ) : (
              <button 
                onClick={() => setIsReactivateModalOpen(true)} 
                className="btn btn-primary btn-reactivate"
                type="button"
              >
                REATIVAR MEU CADASTRO
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="profile-tabs-bar">
          <button 
            onClick={() => handleTabChange('perfil')} 
            className={`profile-tab-btn ${activeTab === 'perfil' ? 'active' : ''}`}
            type="button"
          >
            PERFIL
          </button>
          <button 
            onClick={() => handleTabChange('pedidos')} 
            className={`profile-tab-btn ${activeTab === 'pedidos' ? 'active' : ''}`}
            type="button"
          >
            PEDIDOS
          </button>
          <button 
            onClick={() => handleTabChange('cupons')} 
            className={`profile-tab-btn ${activeTab === 'cupons' ? 'active' : ''}`}
            type="button"
          >
            CUPONS
          </button>
        </div>

        {/* ================= ABA 1: PERFIL ================= */}
        {activeTab === 'perfil' && (
          <div className="tab-content-wrapper">
            
            {/* Dados Pessoais */}
            <div className="profile-card-section">
              <div className="section-card-header">
                <h3 className="section-card-title">Dados Pessoais</h3>
                {!isEditingProfile && (
                  <button 
                    onClick={() => setIsEditingProfile(true)} 
                    className="btn btn-secondary btn-small"
                    type="button"
                  >
                    EDITAR
                  </button>
                )}
              </div>

              {!isEditingProfile ? (
                <div className="personal-data-grid">
                  <div className="data-field">
                    <span className="field-label">Nome Completo</span>
                    <span className="field-val">{activeCustomer.name}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">E-mail</span>
                    <span className="field-val">{activeCustomer.email}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">CPF</span>
                    <span className="field-val">{activeCustomer.cpf}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Telefone</span>
                    <span className="field-val">{activeCustomer.phone}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Gênero</span>
                    <span className="field-val">{activeCustomer.gender}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Data de Nascimento</span>
                    <span className="field-val">{activeCustomer.birthDate}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="personal-data-form">
                  <div className="personal-data-grid">
                    <div className="form-group">
                      <label htmlFor="edit-name">Nome Completo</label>
                      <input
                        type="text"
                        id="edit-name"
                        value={profileForm.name}
                        onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-email">E-mail</label>
                      <input
                        type="email"
                        id="edit-email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>CPF (Apenas Leitura)</label>
                      <input type="text" value={activeCustomer.cpf} disabled className="disabled-field" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-phone">Telefone</label>
                      <input
                        type="text"
                        id="edit-phone"
                        value={profileForm.phone}
                        onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-gender">Gênero</label>
                      <select
                        id="edit-gender"
                        value={profileForm.gender}
                        onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                      >
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-birth">Data de Nascimento</label>
                      <input
                        type="text"
                        id="edit-birth"
                        value={profileForm.birthDate}
                        onChange={e => setProfileForm(p => ({ ...p, birthDate: e.target.value }))}
                        placeholder="dd/mm/aaaa"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions-edit">
                    <button 
                      type="button" 
                      onClick={() => {
                        setProfileForm({
                          name: activeCustomer.name,
                          email: activeCustomer.email,
                          phone: activeCustomer.phone,
                          gender: activeCustomer.gender,
                          birthDate: activeCustomer.birthDate
                        });
                        setIsEditingProfile(false);
                      }} 
                      className="btn btn-secondary btn-small"
                    >
                      CANCELAR
                    </button>
                    <button type="submit" className="btn btn-primary btn-small">
                      SALVAR ALTERAÇÕES
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Endereços de Entrega */}
            <div className="profile-card-section">
              <div className="section-card-header">
                <h3 className="section-card-title">Meus Endereços</h3>
                <button 
                  onClick={handleOpenAddAddr} 
                  className="btn btn-secondary btn-small"
                  type="button"
                >
                  + ADICIONAR ENDEREÇO
                </button>
              </div>

              <div className="profile-addresses-grid">
                {activeCustomer.addresses.map(addr => (
                  <div key={addr.id} className="profile-address-card">
                    <div className="addr-card-header">
                      <span className="profile-addr-label">{addr.label}</span>
                      <button 
                        type="button" 
                        onClick={() => handleOpenEditAddr(addr)} 
                        className="btn-edit-link"
                      >
                        Editar
                      </button>
                    </div>
                    <p className="addr-txt">{addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`}</p>
                    <p className="addr-txt">{addr.neighborhood} - {addr.city} / {addr.state}</p>
                    <p className="addr-txt text-light">CEP {addr.zipCode}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cartões de Crédito */}
            <div className="profile-card-section">
              <div className="section-card-header">
                <h3 className="section-card-title">Cartões de Crédito</h3>
                <button 
                  onClick={handleOpenAddCard} 
                  className="btn btn-secondary btn-small"
                  type="button"
                >
                  + ADICIONAR CARTÃO
                </button>
              </div>

              <div className="profile-cards-list">
                {activeCustomer.cards.length > 0 ? (
                  activeCustomer.cards.map(card => (
                    <div key={card.id} className="profile-card-row">
                      <div className="card-left-info">
                        <span className="card-brand">{card.brand}</span>
                        <span className="card-digits">final {card.lastFour}</span>
                        <span className="card-exp">val {card.expirationDate}</span>
                        {card.isPreferred && <span className="pref-tag">Preferencial</span>}
                      </div>

                      <div className="card-row-actions">
                        <button 
                          onClick={() => handleOpenEditCard(card)} 
                          className="btn-text-action"
                          type="button"
                        >
                          Editar
                        </button>
                        {!card.isPreferred && (
                          <button 
                            onClick={() => setCardAsPreferred(activeCustomer.id, card.id)} 
                            className="btn-text-action"
                            type="button"
                          >
                            Tornar preferencial
                          </button>
                        )}
                        <button 
                          onClick={() => setCardToRemoveId(card.id)} 
                          className="btn-text-action remove-action"
                          type="button"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-cards-txt">Nenhum cartão cadastrado.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ================= ABA 2: PEDIDOS ================= */}
        {activeTab === 'pedidos' && (
          <div className="tab-content-wrapper">
            <h3 className="tab-section-title">Histórico de Pedidos</h3>
            
            {customerOrders.length > 0 ? (
              <div className="profile-orders-list">
                {customerOrders.map(order => {
                  const isAberto = order.status === 'EM ABERTO';
                  const isEntregue = order.status === 'ENTREGUE';
                  const hasExchange = !!order.exchangeStatus;

                  return (
                    <div key={order.id} className="order-profile-card">
                      <div className="order-profile-card-header">
                        <div>
                          <span className="order-id-label">Pedido {order.id}</span>
                          <span className="order-date">{order.date}</span>
                        </div>
                        <span className={`order-status-tag ${order.status.replace(' ', '_').toLowerCase()}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="order-profile-card-body">
                        {order.items.map(item => (
                          <div key={`${item.product.id}-${item.size}`} className="order-item-mini-row">
                            <span>{item.product.brand} - {item.product.name} (Tamanho {item.size})</span>
                            <span>{item.quantity}x {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        ))}
                      </div>

                      <div className="order-profile-card-footer">
                        <div className="order-total-block">
                          <span>Total Pago: </span>
                          <strong>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>

                        {/* Status da Troca se houver */}
                        {hasExchange && (
                          <div className="order-exchange-status-box">
                            <span className="exc-tag-label">Troca:</span>
                            <span className="exc-tag-val">{order.exchangeStatus}</span>
                            
                            {/* Se aceita, cliente pode despachar */}
                            {order.exchangeStatus === 'TROCA ACEITA' && (
                              <button 
                                onClick={() => {
                                  const exc = exchanges.find(e => e.orderId === order.id);
                                  if (exc) {
                                    updateExchangeStatus(exc.id, 'ITEM ENVIADO');
                                  }
                                }}
                                className="btn btn-primary btn-mini"
                                type="button"
                              >
                                INFORMAR DESPACHO
                              </button>
                            )}

                            {/* Mostrar cupom de troca gerado se processada */}
                            {order.exchangeStatus === 'TROCA PROCESSADA' && (
                              <div className="refund-coupon-hint">
                                Cupom gerado: <strong>{exchanges.find(e => e.orderId === order.id)?.refundCouponCode}</strong>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Informações de Cancelamento / Ressarcimento */}
                        {order.status === 'CANCELADO' && (
                          <div className="order-cancellation-info" style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {order.cancellationRefundCouponCode && (
                              <div className="refund-coupon-hint">
                                Cupom de ressarcimento gerado: <strong>{order.cancellationRefundCouponCode}</strong>
                              </div>
                            )}
                            {order.cardRefundedAmount && (
                              <div className="refund-coupon-hint" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#bbb' }}>
                                Estorno no cartão: <strong>{order.cardRefundedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="order-card-actions">
                          <button 
                            onClick={() => handleOpenOrderDetails(order)} 
                            className="btn btn-secondary btn-small"
                            type="button"
                          >
                            VER DETALHES
                          </button>

                          {/* Cancelar em Aberto */}
                          {isAberto && (
                            <button 
                              onClick={() => cancelOrder(order.id)} 
                              className="btn btn-secondary btn-danger-border btn-small"
                              type="button"
                            >
                              CANCELAR PEDIDO
                            </button>
                          )}

                          {/* Confirmação de Recebimento pelo Cliente */}
                          {isEntregue && !order.clientConfirmedReceipt && (
                            <button
                              onClick={() => confirmOrderReceipt(order.id)}
                              className="btn btn-primary btn-small"
                              type="button"
                            >
                              CONFIRMAR RECEBIMENTO
                            </button>
                          )}

                          {/* Solicitar Troca se entregue e com recebimento confirmado */}
                          {isEntregue && order.clientConfirmedReceipt && !hasExchange && (
                            <button 
                              onClick={() => handleOpenExchange(order)} 
                              className="btn btn-primary btn-small"
                              type="button"
                            >
                              SOLICITAR TROCA
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="no-orders-txt">Nenhum pedido realizado.</p>
            )}
          </div>
        )}

        {/* ================= ABA 3: CUPONS ================= */}
        {activeTab === 'cupons' && (
          <div className="tab-content-wrapper">
            <h3 className="tab-section-title">Meus Cupons</h3>
            
            {customerCoupons.length > 0 ? (
              <div className="profile-coupons-grid">
                {customerCoupons.map(coupon => (
                  <div key={coupon.id} className="profile-coupon-card">
                    <div className="coupon-code-badge">{coupon.code}</div>
                    <div className="coupon-card-body">
                      <h4 className="coupon-card-value">
                        {coupon.type === 'promo' ? `${coupon.value}% OFF` : coupon.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </h4>
                      <p className="coupon-card-desc">{coupon.description}</p>
                      <p className="coupon-card-date">Válido até {coupon.expirationDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-coupons-txt">Você não possui cupons ativos.</p>
            )}
          </div>
        )}

      </div>

      {/* MODAL: Confirma Inativação */}
      <Modal
        isOpen={isInactivateModalOpen}
        onClose={() => setIsInactivateModalOpen(false)}
        title="Inativar Cadastro?"
      >
        <div className="inactive-confirm-modal">
          <p className="modal-description-txt">
            Deseja realmente inativar seu cadastro? Após a inativação, você poderá consultar seus dados e pedidos anteriores, mas não poderá realizar novas compras.
          </p>
          <div className="modal-actions">
            <button onClick={() => setIsInactivateModalOpen(false)} className="btn btn-secondary">CANCELAR</button>
            <button 
              onClick={() => {
                updateCustomerStatus(activeCustomer.id, 'INATIVO');
                setIsInactivateModalOpen(false);
              }} 
              className="btn btn-primary"
            >
              CONFIRMAR INATIVAÇÃO
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Confirma Reativação */}
      <Modal
        isOpen={isReactivateModalOpen}
        onClose={() => setIsReactivateModalOpen(false)}
        title="Reativar Cadastro?"
      >
        <div className="inactive-confirm-modal">
          <p className="modal-description-txt">
            Deseja reativar seu cadastro de cliente para voltar a fazer compras no RunWay?
          </p>
          <div className="modal-actions">
            <button onClick={() => setIsReactivateModalOpen(false)} className="btn btn-secondary">CANCELAR</button>
            <button 
              onClick={() => {
                updateCustomerStatus(activeCustomer.id, 'ATIVO');
                setIsReactivateModalOpen(false);
              }} 
              className="btn btn-primary"
            >
              CONFIRMAR REATIVAÇÃO
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Confirmar Exclusão de Cartão */}
      <Modal
        isOpen={cardToRemoveId !== null}
        onClose={() => setCardToRemoveId(null)}
        title="Excluir Cartão?"
      >
        <div className="inactive-confirm-modal">
          <p className="modal-description-txt">
            Deseja realmente excluir este cartão de crédito de sua carteira?
          </p>
          <div className="modal-actions">
            <button onClick={() => setCardToRemoveId(null)} className="btn btn-secondary">CANCELAR</button>
            <button 
              onClick={() => {
                if (cardToRemoveId) {
                  removeCustomerCard(activeCustomer.id, cardToRemoveId);
                }
                setCardToRemoveId(null);
              }} 
              className="btn btn-primary"
            >
              EXCLUIR CARTÃO
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Adicionar / Editar Cartão */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setEditingCard(null);
        }}
        title={editingCard ? 'Editar Cartão' : 'Adicionar Novo Cartão'}
      >
        <form onSubmit={handleSaveCard} className="address-modal-form">
          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="card-brand">Bandeira</label>
              <select
                id="card-brand"
                value={cardForm.brand}
                onChange={e => setCardForm(prev => ({ ...prev, brand: e.target.value as CreditCard['brand'] }))}
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Elo">Elo</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="card-digits">Últimos 4 Dígitos</label>
              <input
                type="text"
                id="card-digits"
                maxLength={4}
                value={cardForm.lastFour}
                onChange={e => setCardForm(prev => ({ ...prev, lastFour: e.target.value.replace(/\D/g, '') }))}
                placeholder="4821"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="card-holder">Nome Impresso no Cartão</label>
              <input
                type="text"
                id="card-holder"
                value={cardForm.holderName}
                onChange={e => setCardForm(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                placeholder="ANA C SILVA"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="card-exp">Validade</label>
              <input
                type="text"
                id="card-exp"
                placeholder="MM/AA"
                maxLength={5}
                value={cardForm.expirationDate}
                onChange={e => setCardForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <label className="checkbox-preferred-label" style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#888', cursor: 'pointer', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={cardForm.isPreferred}
              onChange={e => setCardForm(prev => ({ ...prev, isPreferred: e.target.checked }))}
            />
            Definir como cartão preferencial de pagamento
          </label>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setIsCardModalOpen(false);
                setEditingCard(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCard ? 'SALVAR ALTERAÇÕES' : 'SALVAR CARTÃO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Adicionar/Editar Endereço */}
      <Modal
        isOpen={isAddrModalOpen}
        onClose={() => setIsAddrModalOpen(false)}
        title={editingAddress ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
      >
        <form onSubmit={handleSaveAddress} className="address-modal-form">
          <div className="form-group">
            <label htmlFor="m-addr-label">Identificação (ex: Casa, Trabalho)</label>
            <input
              type="text"
              id="m-addr-label"
              value={addrForm.label}
              onChange={e => setAddrForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Casa, Escritório"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="m-addr-street">Logradouro</label>
              <input
                type="text"
                id="m-addr-street"
                value={addrForm.street}
                onChange={e => setAddrForm(prev => ({ ...prev, street: e.target.value }))}
                placeholder="Rua, Avenida, Alameda..."
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="m-addr-num">Número</label>
              <input
                type="text"
                id="m-addr-num"
                value={addrForm.number}
                onChange={e => setAddrForm(prev => ({ ...prev, number: e.target.value }))}
                placeholder="123"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="m-addr-comp">Complemento</label>
              <input
                type="text"
                id="m-addr-comp"
                value={addrForm.complement}
                onChange={e => setAddrForm(prev => ({ ...prev, complement: e.target.value }))}
                placeholder="Apto 42, Bloco B (opcional)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="m-addr-neigh">Bairro</label>
              <input
                type="text"
                id="m-addr-neigh"
                value={addrForm.neighborhood}
                onChange={e => setAddrForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                placeholder="Bairro"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="m-addr-zip">CEP</label>
              <input
                type="text"
                id="m-addr-zip"
                value={addrForm.zipCode}
                onChange={e => setAddrForm(prev => ({ ...prev, zipCode: e.target.value }))}
                placeholder="00000-000"
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="m-addr-city">Cidade</label>
              <input
                type="text"
                id="m-addr-city"
                value={addrForm.city}
                onChange={e => setAddrForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Cidade"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="m-addr-state">Estado</label>
              <input
                type="text"
                id="m-addr-state"
                value={addrForm.state}
                onChange={e => setAddrForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                placeholder="UF"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddrModalOpen(false)}>CANCELAR</button>
            <button type="submit" className="btn btn-primary">SALVAR ENDEREÇO</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Solicitar Troca */}
      <Modal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        title="Solicitar Troca de Produto"
      >
        <form onSubmit={handleConfirmExchangeRequest} className="address-modal-form">
          {selectedOrderForExc && (
            <>
              <div className="form-group">
                <label className="exchange-group-title">
                  Selecione os itens que deseja trocar:
                </label>
                <div className="exchange-items-selection-list">
                  {selectedOrderForExc.items.map((item, idx) => {
                    const isChecked = selectedExcItems.some(
                      x => x.productId === item.product.id && x.size === item.size
                    );
                    const selectedItemState = selectedExcItems.find(
                      x => x.productId === item.product.id && x.size === item.size
                    );
                    const selectedQty = selectedItemState?.quantity || 1;
                    const remainingQty = item.quantity - (isChecked ? selectedQty : 0);

                    return (
                      <div
                        key={`${item.product.id}-${item.size}-${idx}`}
                        className={`exchange-item-card ${isChecked ? 'selected' : ''}`}
                      >
                        <div className="exchange-item-main-row">
                          <label className="exchange-checkbox-label">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                handleToggleItemSelection(item.product.id, item.size, item.quantity)
                              }
                              className="exchange-checkbox"
                            />
                            <div className="exchange-item-thumb">
                              <img src={item.product.image} alt={item.product.name} />
                            </div>
                            <div className="exchange-item-info">
                              <span className="exchange-item-name">
                                {item.product.brand} {item.product.name}
                              </span>
                              <div className="exchange-item-meta-tags">
                                <span className="exchange-tag">Tamanho {item.size}</span>
                                <span className="exchange-tag">Comprado: {item.quantity} un.</span>
                              </div>
                            </div>
                          </label>

                          <div className="exchange-item-unit-price">
                            <span>
                              {item.product.price.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              })}
                              <small className="unit-label"> /un.</small>
                            </span>
                          </div>
                        </div>

                        {/* Detalhe de quantidade quando selecionado */}
                        {isChecked && (
                          <div className="exchange-item-qty-row">
                            <div className="exchange-qty-selector-container">
                              <span className="exchange-qty-label">Quantidade para troca:</span>
                              {item.quantity > 1 ? (
                                <div className="exchange-qty-stepper">
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={selectedQty <= 1}
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.product.id,
                                        item.size,
                                        selectedQty - 1,
                                        item.quantity
                                      )
                                    }
                                  >
                                    -
                                  </button>
                                  <span className="qty-value">{selectedQty}</span>
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={selectedQty >= item.quantity}
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.product.id,
                                        item.size,
                                        selectedQty + 1,
                                        item.quantity
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                  <span className="qty-max-hint">(Máx: {item.quantity})</span>
                                </div>
                              ) : (
                                <span className="qty-single-tag">1 unidade</span>
                              )}
                            </div>

                            <div className="exchange-item-subtotal-box">
                              <span className="subtotal-label">Subtotal do item:</span>
                              <strong className="subtotal-val">
                                {(item.product.price * selectedQty).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </strong>
                            </div>
                          </div>
                        )}

                        {/* Informação sobre quantidade restante que fica com o cliente */}
                        {isChecked && item.quantity > 1 && (
                          <div className="exchange-item-retention-hint">
                            {remainingQty > 0 ? (
                              <span>
                                ℹ️ <strong>{remainingQty} {remainingQty === 1 ? 'unidade' : 'unidades'}</strong> deste item permanecerá(ão) normalmente com você.
                              </span>
                            ) : (
                              <span>ℹ️ Todas as {item.quantity} unidades deste item serão trocadas.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resumo da Troca */}
              {selectedExcItems.length > 0 && (
                <div className="exchange-summary-banner">
                  <div className="exchange-summary-info">
                    <span className="summary-title">Resumo da Solicitação</span>
                    <span className="summary-count">
                      {selectedExcItems.reduce((sum, i) => sum + i.quantity, 0)}{' '}
                      {selectedExcItems.reduce((sum, i) => sum + i.quantity, 0) === 1
                        ? 'unidade selecionada'
                        : 'unidades selecionadas'}{' '}
                      ({selectedExcItems.length}{' '}
                      {selectedExcItems.length === 1 ? 'item' : 'itens'})
                    </span>
                  </div>
                  <div className="exchange-summary-total">
                    <span className="total-label">Crédito Estimado:</span>
                    <strong className="total-val">
                      {selectedExcItems
                        .reduce((sum, req) => {
                          const it = selectedOrderForExc.items.find(
                            i => i.product.id === req.productId && i.size === req.size
                          );
                          return sum + (it ? it.product.price * req.quantity : 0);
                        }, 0)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label htmlFor="exc-reason">Motivo da Troca *</label>
                <textarea
                  id="exc-reason"
                  rows={3}
                  value={exchangeReason}
                  onChange={e => setExchangeReason(e.target.value)}
                  placeholder="Por favor, descreva o motivo da troca (ex: ficou apertado, defeito...)"
                  required
                />
              </div>

              <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsExchangeModalOpen(false)}
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selectedExcItems.length === 0 || !exchangeReason.trim()}
                >
                  SOLICITAR TROCA
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* MODAL: Detalhes do Pedido */}
      <Modal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => {
          setIsOrderDetailsModalOpen(false);
          setSelectedOrderForDetails(null);
        }}
        title={selectedOrderForDetails ? `Detalhes do Pedido - ${selectedOrderForDetails.id}` : 'Detalhes do Pedido'}
      >
        {selectedOrderForDetails && (
          <div className="order-details-modal-content">
            
            <div className="order-details-section">
              <h4 className="details-sec-title">Informações Gerais</h4>
              <div className="details-grid-2">
                <div className="details-info-item">
                  <span className="info-label">Data do Pedido</span>
                  <span className="info-val">{selectedOrderForDetails.date}</span>
                </div>
                <div className="details-info-item">
                  <span className="info-label">Status</span>
                  <div>
                    <span className={`order-status-tag ${selectedOrderForDetails.status.replace(' ', '_').toLowerCase()}`} style={{ display: 'inline-block', marginTop: '0.2rem' }}>
                      {selectedOrderForDetails.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-details-section">
              <h4 className="details-sec-title">Itens Comprados</h4>
              <div className="details-items-list">
                {selectedOrderForDetails.items.map(item => {
                  const exchangedItem = selectedOrderForDetails.exchangeItems?.find(
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
                        <span className="details-item-meta">Tamanho: {item.size} | Qtd Comprada: {item.quantity}</span>
                        {exchangedQty > 0 && (
                          <div className="details-item-exchange-breakdown" style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="item-badge-exchange" style={{ fontSize: '0.72rem', color: 'var(--color-primary)', backgroundColor: 'rgba(198, 255, 0, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(198, 255, 0, 0.25)' }}>
                              🔄 {exchangedQty} {exchangedQty === 1 ? 'unidade em troca' : 'unidades em troca'}
                            </span>
                            {keptQty > 0 && (
                              <span className="item-badge-kept" style={{ fontSize: '0.72rem', color: '#aaa', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                ✓ {keptQty} {keptQty === 1 ? 'unidade permanece com você' : 'unidades permanecem com você'}
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

            <div className="order-details-section">
              <h4 className="details-sec-title">Endereço de Entrega</h4>
              <div className="details-address-box">
                <strong className="addr-label-tag">{selectedOrderForDetails.shippingAddress.label}</strong>
                <p className="addr-text" style={{ marginTop: '0.25rem' }}>
                  {selectedOrderForDetails.shippingAddress.street}, {selectedOrderForDetails.shippingAddress.number}
                  {selectedOrderForDetails.shippingAddress.complement && ` - ${selectedOrderForDetails.shippingAddress.complement}`}
                </p>
                <p className="addr-text">
                  {selectedOrderForDetails.shippingAddress.neighborhood} - {selectedOrderForDetails.shippingAddress.city} / {selectedOrderForDetails.shippingAddress.state}
                </p>
                <p className="addr-text">CEP {selectedOrderForDetails.shippingAddress.zipCode}</p>
              </div>
            </div>

            <div className="order-details-section">
              <h4 className="details-sec-title">Método de Pagamento</h4>
              <div className="details-payment-list">
                {/* Cupons usados */}
                {selectedOrderForDetails.couponsUsed.map(coupon => (
                  <div key={coupon.id} className="payment-method-row coupon-row">
                    <span>🎫 Cupom ({coupon.code})</span>
                    <strong>- {coupon.type === 'promo' ? `${coupon.value}%` : coupon.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  </div>
                ))}
                {/* Cartões de crédito ou aviso de pagamento integral por cupom */}
                {selectedOrderForDetails.paymentMethods.length === 0 && selectedOrderForDetails.couponsUsed.length > 0 ? (
                  <div className="payment-method-row">
                    <span>💳 Cartão de Crédito</span>
                    <strong style={{ color: 'var(--color-success)' }}>R$ 0,00 (Pago integralmente por cupom)</strong>
                  </div>
                ) : (
                  selectedOrderForDetails.paymentMethods.map(pm => {
                    const card = activeCustomer.cards.find(c => c.id === pm.cardId);
                    return (
                      <div key={pm.cardId} className="payment-method-row">
                        <span>💳 Cartão {card ? `${card.brand} final ${card.lastFour}` : `final ${pm.cardId.slice(-4)}`}</span>
                        <strong>{pm.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="order-details-section" style={{ marginBottom: 0 }}>
              <h4 className="details-sec-title">Resumo de Valores</h4>
              <div className="details-totals-box">
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>{selectedOrderForDetails.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="totals-row">
                  <span>Frete</span>
                  <span>{(selectedOrderForDetails.shippingCost && selectedOrderForDetails.shippingCost > 0) ? selectedOrderForDetails.shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis'}</span>
                </div>
                {selectedOrderForDetails.discountPromo && selectedOrderForDetails.discountPromo > 0 ? (
                  <div className="totals-row discount-text">
                    <span>Desconto Promocional</span>
                    <span>- {selectedOrderForDetails.discountPromo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ) : null}
                {selectedOrderForDetails.discountExchange && selectedOrderForDetails.discountExchange > 0 ? (
                  <div className="totals-row discount-text">
                    <span>Cupom de Troca</span>
                    <span>- {selectedOrderForDetails.discountExchange.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ) : null}
                {(!selectedOrderForDetails.discountPromo && !selectedOrderForDetails.discountExchange && selectedOrderForDetails.discount > 0) ? (
                  <div className="totals-row discount-text">
                    <span>Descontos</span>
                    <span>- {selectedOrderForDetails.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ) : null}
                <div className="totals-row total-highlight">
                  <span>Total Pago</span>
                  <span>{selectedOrderForDetails.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>

            {/* Informações de Cancelamento / Ressarcimento se cancelado */}
            {selectedOrderForDetails.status === 'CANCELADO' && (
              <div className="order-details-section" style={{ marginTop: '1.25rem', borderColor: 'rgba(255, 69, 69, 0.3)' }}>
                <h4 className="details-sec-title" style={{ color: 'var(--color-danger)' }}>Informações de Cancelamento</h4>
                <div className="details-payment-list">
                  {selectedOrderForDetails.cancellationRefundCouponCode ? (
                    <div className="payment-method-row coupon-row">
                      <span>🎫 Novo Cupom de Troca Gerado</span>
                      <strong>{selectedOrderForDetails.cancellationRefundCouponCode}</strong>
                    </div>
                  ) : null}
                  {selectedOrderForDetails.cardRefundedAmount ? (
                    <div className="payment-method-row">
                      <span>💳 Estorno no Cartão de Crédito</span>
                      <strong>{selectedOrderForDetails.cardRefundedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  ) : null}
                  {!selectedOrderForDetails.cancellationRefundCouponCode && !selectedOrderForDetails.cardRefundedAmount && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Pedido cancelado pelo cliente.
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedOrderForDetails.exchangeStatus && (
              <div className="order-details-section exchange-details-box" style={{ marginTop: '1.25rem' }}>
                <h4 className="details-sec-title">Informações de Troca</h4>
                <div className="details-grid-2">
                  <div className="details-info-item">
                    <span className="info-label">Status da Troca</span>
                    <span className="exc-tag-val">{selectedOrderForDetails.exchangeStatus}</span>
                  </div>
                  {selectedOrderForDetails.exchangeReason && (
                    <div className="details-info-item">
                      <span className="info-label">Motivo</span>
                      <span className="info-val">{selectedOrderForDetails.exchangeReason}</span>
                    </div>
                  )}
                </div>

                {selectedOrderForDetails.exchangeItems && selectedOrderForDetails.exchangeItems.length > 0 && (
                  <div className="details-exchange-items-box" style={{ marginTop: '0.85rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.75rem' }}>
                    <span className="info-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, color: '#e0e0e0' }}>
                      Itens em processo de troca:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {selectedOrderForDetails.exchangeItems.map((exItem, idx) => (
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
                      ✓ Itens e unidades não listados acima continuam normalmente sob sua posse.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  setIsOrderDetailsModalOpen(false);
                  setSelectedOrderForDetails(null);
                }}
              >
                FECHAR
              </button>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}

