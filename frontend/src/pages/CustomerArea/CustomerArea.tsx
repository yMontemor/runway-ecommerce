import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import OrderDetailsModal from '../../components/OrderDetailsModal/OrderDetailsModal';
import type { Address, CreditCard, Order } from '../../types';
import {
  maskBirthDate,
  maskPhoneNumber,
  validateBirthDate,
  validatePhoneFields,
  maskCardNumber,
  maskCardExpiration,
  maskCardCvv,
  validateCardNumber,
  validateCardExpiration,
  validateCardCvv,
  maskZipCode,
  validateZipCode
} from '../../utils/maskAndValidate';
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
    removeCustomerAddress,
    addCustomerCard,
    updateCustomerCard,
    removeCustomerCard,
    setCardAsPreferred
  } = useApp();

  const [addressToRemove, setAddressToRemove] = useState<Address | null>(null);

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
    phoneType: activeCustomer.phoneType || 'Celular',
    phoneDdd: activeCustomer.phoneDdd || (activeCustomer.phone.match(/\((\d{2})\)/)?.[1] || '11'),
    phoneNumber: activeCustomer.phoneNumber || activeCustomer.phone.replace(/^\(\d{2}\)\s*/, ''),
    gender: activeCustomer.gender,
    birthDate: activeCustomer.birthDate
  });

  const [profileError, setProfileError] = useState<string | null>(null);

  const [prevCustomerForProfile, setPrevCustomerForProfile] = useState(activeCustomer.id);
  if (activeCustomer.id !== prevCustomerForProfile) {
    setPrevCustomerForProfile(activeCustomer.id);
    setProfileError(null);
    setProfileForm({
      name: activeCustomer.name,
      email: activeCustomer.email,
      phoneType: activeCustomer.phoneType || 'Celular',
      phoneDdd: activeCustomer.phoneDdd || (activeCustomer.phone.match(/\((\d{2})\)/)?.[1] || '11'),
      phoneNumber: activeCustomer.phoneNumber || activeCustomer.phone.replace(/^\(\d{2}\)\s*/, ''),
      gender: activeCustomer.gender,
      birthDate: activeCustomer.birthDate
    });
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const birthVal = validateBirthDate(profileForm.birthDate);
    if (!birthVal.isValid) {
      setProfileError(birthVal.error || 'Informe uma data de nascimento válida.');
      return;
    }

    const phoneVal = validatePhoneFields(profileForm.phoneDdd, profileForm.phoneNumber);
    if (!phoneVal.isValid) {
      setProfileError(phoneVal.error || 'Telefone inválido.');
      return;
    }

    updateCustomerProfile({
      ...activeCustomer,
      ...profileForm,
      phone: `(${profileForm.phoneDdd.replace(/\D/g, '')}) ${profileForm.phoneNumber.trim()}`
    });
    setIsEditingProfile(false);
  };

  const handleEditBirthDateChange = (val: string) => {
    setProfileForm(p => ({ ...p, birthDate: maskBirthDate(val) }));
  };

  const handleEditPhoneNumChange = (val: string) => {
    setProfileForm(p => ({ ...p, phoneNumber: maskPhoneNumber(val) }));
  };

  // Módulos de Inativação/Reativação
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);

  // Módulos de Cartões
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardModalError, setCardModalError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardForm, setCardForm] = useState({
    brand: 'Visa' as CreditCard['brand'],
    cardNumber: '',
    lastFour: '',
    holderName: '',
    expirationDate: '',
    cvv: '',
    isPreferred: false
  });
  const [cardToRemoveId, setCardToRemoveId] = useState<string | null>(null);

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardModalError(null);
    setCardForm({
      brand: 'Visa',
      cardNumber: '',
      lastFour: '',
      holderName: '',
      expirationDate: '',
      cvv: '',
      isPreferred: false
    });
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setCardModalError(null);
    setCardForm({
      brand: card.brand,
      cardNumber: card.cardNumber ? maskCardNumber(card.cardNumber) : `•••• •••• •••• ${card.lastFour}`,
      lastFour: card.lastFour,
      holderName: card.holderName,
      expirationDate: card.expirationDate,
      cvv: card.cvv || '',
      isPreferred: card.isPreferred
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    setCardModalError(null);

    // Validação do número do cartão (se fornecido ou se novo cadastro)
    const cleanNum = cardForm.cardNumber.replace(/\D/g, '');
    if (!editingCard || cleanNum.length > 4) {
      const numVal = validateCardNumber(cleanNum);
      if (!numVal.isValid) {
        setCardModalError(numVal.error || 'Informe um número de cartão válido.');
        return;
      }
    }

    if (!cardForm.holderName.trim()) {
      setCardModalError('O nome impresso no cartão é obrigatório.');
      return;
    }

    const expVal = validateCardExpiration(cardForm.expirationDate);
    if (!expVal.isValid) {
      setCardModalError(expVal.error || 'Data de validade inválida.');
      return;
    }

    if (cardForm.cvv) {
      const cvvVal = validateCardCvv(cardForm.cvv);
      if (!cvvVal.isValid) {
        setCardModalError(cvvVal.error || 'Código CVV inválido.');
        return;
      }
    }

    const derivedLastFour = cleanNum.length >= 4 ? cleanNum.slice(-4) : (cardForm.lastFour || '1234');

    if (editingCard) {
      updateCustomerCard(activeCustomer.id, {
        ...editingCard,
        brand: cardForm.brand,
        cardNumber: cleanNum.length >= 13 ? maskCardNumber(cleanNum) : editingCard.cardNumber,
        lastFour: derivedLastFour,
        holderName: cardForm.holderName.toUpperCase().trim(),
        expirationDate: cardForm.expirationDate.trim(),
        cvv: cardForm.cvv ? cardForm.cvv.replace(/\D/g, '') : editingCard.cvv,
        isPreferred: cardForm.isPreferred
      });
    } else {
      addCustomerCard(activeCustomer.id, {
        brand: cardForm.brand,
        cardNumber: maskCardNumber(cleanNum),
        lastFour: derivedLastFour,
        holderName: cardForm.holderName.toUpperCase().trim(),
        expirationDate: cardForm.expirationDate.trim(),
        cvv: cardForm.cvv.replace(/\D/g, ''),
        isPreferred: cardForm.isPreferred
      });
    }
    setIsCardModalOpen(false);
    setEditingCard(null);
    setCardForm({ brand: 'Visa', cardNumber: '', lastFour: '', holderName: '', expirationDate: '', cvv: '', isPreferred: false });
  };

  // Módulos de Endereços
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [addrModalError, setAddrModalError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addrForm, setAddrForm] = useState({
    label: '',
    residenceType: 'Casa',
    streetType: 'Rua',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    zipCode: '',
    city: '',
    state: '',
    country: 'Brasil',
    observations: '',
    isDelivery: true,
    isBilling: true
  });

  const handleOpenAddAddr = () => {
    setEditingAddress(null);
    setAddrModalError(null);
    setAddrForm({
      label: '', residenceType: 'Casa', streetType: 'Rua', street: '', number: '', complement: '', neighborhood: '',
      zipCode: '', city: '', state: '', country: 'Brasil', observations: '', isDelivery: true, isBilling: true
    });
    setIsAddrModalOpen(true);
  };

  const handleOpenEditAddr = (addr: Address) => {
    setEditingAddress(addr);
    setAddrModalError(null);
    setAddrForm({
      label: addr.label,
      residenceType: addr.residenceType || 'Casa',
      streetType: addr.streetType || 'Rua',
      street: addr.street,
      number: addr.number,
      complement: addr.complement || '',
      neighborhood: addr.neighborhood,
      zipCode: maskZipCode(addr.zipCode),
      city: addr.city,
      state: addr.state,
      country: addr.country || 'Brasil',
      observations: addr.observations || '',
      isDelivery: addr.isDelivery ?? true,
      isBilling: addr.isBilling ?? true
    });
    setIsAddrModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddrModalError(null);

    if (!addrForm.label.trim() || !addrForm.street.trim() || !addrForm.number.trim() || !addrForm.city.trim() || !addrForm.state.trim()) {
      setAddrModalError('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    const zipVal = validateZipCode(addrForm.zipCode);
    if (!zipVal.isValid) {
      setAddrModalError(zipVal.error || 'Informe um CEP válido com 8 dígitos.');
      return;
    }

    if (editingAddress) {
      updateCustomerAddress(activeCustomer.id, {
        ...editingAddress,
        ...addrForm,
        zipCode: maskZipCode(addrForm.zipCode)
      });
    } else {
      addCustomerAddress(activeCustomer.id, {
        ...addrForm,
        zipCode: maskZipCode(addrForm.zipCode)
      });
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`status-badge ${activeCustomer.status.toLowerCase()}`}>
                Conta {activeCustomer.status}
              </span>
            </div>
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
                    <span className="field-val">
                      {activeCustomer.phoneDdd && activeCustomer.phoneNumber 
                        ? `(${activeCustomer.phoneDdd}) ${activeCustomer.phoneNumber} (${activeCustomer.phoneType || 'Celular'})`
                        : `${activeCustomer.phone} (${activeCustomer.phoneType || 'Celular'})`}
                    </span>
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
                  {profileError && (
                    <div style={{
                      backgroundColor: 'rgba(255, 69, 69, 0.1)',
                      border: '1px solid var(--color-danger)',
                      color: 'var(--color-danger)',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      gridColumn: '1 / -1'
                    }}>
                      ⚠️ {profileError}
                    </div>
                  )}
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
                      <label htmlFor="edit-phone-type">Tipo de Telefone</label>
                      <select
                        id="edit-phone-type"
                        value={profileForm.phoneType}
                        onChange={e => setProfileForm(p => ({ ...p, phoneType: e.target.value }))}
                      >
                        <option value="Celular">Celular</option>
                        <option value="Fixo">Fixo</option>
                        <option value="Comercial">Comercial</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ width: '70px' }}>
                        <label htmlFor="edit-phone-ddd">DDD</label>
                        <input
                          type="text"
                          id="edit-phone-ddd"
                          value={profileForm.phoneDdd}
                          onChange={e => setProfileForm(p => ({ ...p, phoneDdd: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                          maxLength={2}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor="edit-phone-num">Número</label>
                        <input
                          type="text"
                          id="edit-phone-num"
                          value={profileForm.phoneNumber}
                          onChange={e => handleEditPhoneNumChange(e.target.value)}
                          maxLength={10}
                          required
                        />
                      </div>
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
                        onChange={e => handleEditBirthDateChange(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
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
                          phoneType: activeCustomer.phoneType || 'Celular',
                          phoneDdd: activeCustomer.phoneDdd || '11',
                          phoneNumber: activeCustomer.phoneNumber || activeCustomer.phone,
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="profile-addr-label">{addr.label}</span>
                        {addr.isDelivery && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(67, 185, 86, 0.15)', color: 'var(--color-success)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-success)' }}>
                            Entrega
                          </span>
                        )}
                        {addr.isBilling && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(0, 191, 255, 0.15)', color: '#00bfff', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #00bfff' }}>
                            Cobrança
                          </span>
                        )}
                      </div>
                      <div className="addr-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditAddr(addr)}
                          className="btn-edit-link"
                        >
                          Editar
                        </button>
                        {activeCustomer.addresses.length > 1 && (
                          <>
                            <span style={{ color: 'var(--color-border)', fontSize: '0.75rem' }}>|</span>
                            <button
                              type="button"
                              onClick={() => setAddressToRemove(addr)}
                              className="btn-edit-link"
                              style={{ color: 'var(--color-danger)' }}
                            >
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="addr-txt">
                      {addr.streetType ? `${addr.streetType} ` : ''}{addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`} ({addr.residenceType || 'Residencial'})
                    </p>
                    <p className="addr-txt">{addr.neighborhood} - {addr.city} / {addr.state} - {addr.country || 'Brasil'}</p>
                    <p className="addr-txt text-light">CEP {addr.zipCode}</p>
                  </div>
                ))}
              </div>
              {activeCustomer.addresses.length <= 1 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                  * Pelo menos um endereço deve ser mantido cadastrado no seu perfil.
                </p>
              )}
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
          {cardModalError && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 69, 0.1)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '0.65rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              ⚠️ {cardModalError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="card-number">Número do Cartão</label>
            <input
              type="text"
              id="card-number"
              maxLength={19}
              value={cardForm.cardNumber}
              onChange={e => setCardForm(prev => ({ ...prev, cardNumber: maskCardNumber(e.target.value) }))}
              placeholder="0000 0000 0000 0000"
              required={!editingCard}
            />
          </div>

          <div className="form-group">
            <label htmlFor="card-holder">Nome Impresso no Cartão</label>
            <input
              type="text"
              id="card-holder"
              value={cardForm.holderName}
              onChange={e => setCardForm(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
              placeholder="NOME COMO NO CARTÃO"
              required
            />
          </div>

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
              <label htmlFor="card-exp">Validade</label>
              <input
                type="text"
                id="card-exp"
                placeholder="MM/AA"
                maxLength={5}
                value={cardForm.expirationDate}
                onChange={e => setCardForm(prev => ({ ...prev, expirationDate: maskCardExpiration(e.target.value) }))}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="card-cvv">CVV</label>
              <input
                type="text"
                id="card-cvv"
                placeholder="123"
                maxLength={4}
                value={cardForm.cvv}
                onChange={e => setCardForm(prev => ({ ...prev, cvv: maskCardCvv(e.target.value) }))}
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
        onClose={() => {
          setIsAddrModalOpen(false);
          setAddrModalError(null);
        }}
        title={editingAddress ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
      >
        <form onSubmit={handleSaveAddress} className="address-modal-form">
          {addrModalError && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 69, 0.1)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '0.65rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              ⚠️ {addrModalError}
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="m-addr-label">Identificação</label>
              <input
                type="text"
                id="m-addr-label"
                value={addrForm.label}
                onChange={e => setAddrForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Casa, Escritório"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="m-res-type">Tipo de Residência *</label>
              <select
                id="m-res-type"
                value={addrForm.residenceType}
                onChange={e => setAddrForm(prev => ({ ...prev, residenceType: e.target.value }))}
                required
              >
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Sobrado">Sobrado</option>
                <option value="Comercial">Comercial</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="m-street-type">Tipo de Logradouro *</label>
              <select
                id="m-street-type"
                value={addrForm.streetType}
                onChange={e => setAddrForm(prev => ({ ...prev, streetType: e.target.value }))}
                required
              >
                <option value="Rua">Rua</option>
                <option value="Avenida">Avenida</option>
                <option value="Alameda">Alameda</option>
                <option value="Praça">Praça</option>
                <option value="Travessa">Travessa</option>
                <option value="Rodovia">Rodovia</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="m-addr-street">Logradouro *</label>
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
              <label htmlFor="m-addr-num">Número *</label>
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
            <div className="form-group flex-1">
              <label htmlFor="m-addr-comp">Complemento</label>
              <input
                type="text"
                id="m-addr-comp"
                value={addrForm.complement}
                onChange={e => setAddrForm(prev => ({ ...prev, complement: e.target.value }))}
                placeholder="Apto 42, Bloco B (opcional)"
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="m-addr-neigh">Bairro *</label>
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
              <label htmlFor="m-addr-zip">CEP *</label>
              <input
                type="text"
                id="m-addr-zip"
                value={addrForm.zipCode}
                onChange={e => setAddrForm(prev => ({ ...prev, zipCode: maskZipCode(e.target.value) }))}
                placeholder="00000-000"
                maxLength={9}
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="m-addr-city">Cidade *</label>
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
              <label htmlFor="m-addr-state">Estado *</label>
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

          {/* Finalidades do Endereço */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addrForm.isDelivery}
                onChange={e => setAddrForm(prev => ({ ...prev, isDelivery: e.target.checked }))}
              />
              Endereço de entrega
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addrForm.isBilling}
                onChange={e => setAddrForm(prev => ({ ...prev, isBilling: e.target.checked }))}
              />
              Endereço de cobrança
            </label>
          </div>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddrModalOpen(false)}>CANCELAR</button>
            <button type="submit" className="btn btn-primary">SALVAR ENDEREÇO</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Confirmação de Remoção de Endereço */}
      <Modal
        isOpen={!!addressToRemove}
        onClose={() => setAddressToRemove(null)}
        title="Remover endereço?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
            Tem certeza de que deseja remover o endereço <strong>"{addressToRemove?.label}"</strong> ({addressToRemove?.street}, nº {addressToRemove?.number}) do seu perfil?
          </p>
          <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>
            Esta ação removerá o endereço para compras futuras. Pedidos já realizados não serão afetados.
          </p>
          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAddressToRemove(null)}
            >
              CANCELAR
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (addressToRemove) {
                  removeCustomerAddress(activeCustomer.id, addressToRemove.id);
                  setAddressToRemove(null);
                }
              }}
            >
              REMOVER ENDEREÇO
            </button>
          </div>
        </div>
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
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => {
          setIsOrderDetailsModalOpen(false);
          setSelectedOrderForDetails(null);
        }}
        order={selectedOrderForDetails}
      />
    </div>
  );
}

