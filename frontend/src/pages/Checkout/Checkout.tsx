import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import type { Address, Coupon, Order } from '../../types';
import './Checkout.css';

export default function Checkout() {
  const navigate = useNavigate();
  const { 
    activeCustomer, 
    cartsByCustomer, 
    coupons, 
    checkoutCart,
    addCustomerAddress,
    updateCustomerAddress,
    addCustomerCard
  } = useApp();

  const cartItems = useMemo(() => {
    return cartsByCustomer[activeCustomer.id] || [];
  }, [cartsByCustomer, activeCustomer.id]);
  
  const [step, setStep] = useState(1); // 1: Em aberto, 2: Pagamento, 3: Revisão, 4: Confirmado
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Se o carrinho estiver vazio e não houver pedido confirmado, volta para o carrinho
  useEffect(() => {
    if (cartItems.length === 0 && step !== 4) {
      navigate('/carrinho');
    }
  }, [cartItems, step, navigate]);

  // --- STEP 1: ENDEREÇO ---
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    activeCustomer.addresses[0]?.id || ''
  );

  // Se o endereço selecionado deixar de existir, limpa e exige seleção explícita do cliente
  useEffect(() => {
    if (selectedAddressId && !activeCustomer.addresses.some(a => a.id === selectedAddressId)) {
      setSelectedAddressId('');
    }
  }, [activeCustomer.addresses, selectedAddressId]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
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

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
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
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: Address, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label,
      street: addr.street,
      number: addr.number,
      complement: addr.complement || '',
      neighborhood: addr.neighborhood,
      zipCode: addr.zipCode,
      city: addr.city,
      state: addr.state,
      country: addr.country || 'Brasil',
      observations: addr.observations || ''
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressForm.label || !addressForm.street || !addressForm.number || !addressForm.zipCode) return;
    
    if (editingAddress) {
      updateCustomerAddress(activeCustomer.id, {
        ...editingAddress,
        ...addressForm
      });
      setSelectedAddressId(editingAddress.id);
    } else {
      addCustomerAddress(activeCustomer.id, addressForm);
    }
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    
    // Reset form
    setAddressForm({
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
  };

  // --- STEP 2: PAGAMENTO ---
  const customerCoupons = coupons.filter(c => c.customerId === activeCustomer.id);
  const promoCoupons = customerCoupons.filter(c => c.type === 'promo');
  const exchangeCoupons = customerCoupons.filter(c => c.type === 'exchange');

  const [selectedPromoCouponId, setSelectedPromoCouponId] = useState<string>('');
  const [selectedExchangeCouponId, setSelectedExchangeCouponId] = useState<string>('');

  const [prevCustomerId, setPrevCustomerId] = useState(activeCustomer.id);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardAmounts, setCardAmounts] = useState<Record<string, string>>({});

  // Modal de novo cartão no checkout
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    brand: 'Visa' as 'Visa' | 'Mastercard' | 'Elo',
    cardNumber: '',
    holderName: '',
    expirationDate: '',
    cvv: '',
    isPreferred: false
  });

  const handleAddNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.cardNumber || !newCard.holderName || !newCard.expirationDate) return;

    const cleanNum = newCard.cardNumber.replace(/\D/g, '');
    const derivedLastFour = cleanNum.length >= 4 ? cleanNum.slice(-4) : '1234';

    const created = addCustomerCard(activeCustomer.id, {
      brand: newCard.brand,
      cardNumber: newCard.cardNumber,
      lastFour: derivedLastFour,
      holderName: newCard.holderName.toUpperCase(),
      expirationDate: newCard.expirationDate,
      cvv: newCard.cvv,
      isPreferred: newCard.isPreferred
    });

    // Selecionar imediatamente o cartão adicionado
    setSelectedCardIds(prev => [...prev, created.id]);
    setIsCardModalOpen(false);
    setNewCard({
      brand: 'Visa',
      cardNumber: '',
      holderName: '',
      expirationDate: '',
      cvv: '',
      isPreferred: false
    });
  };

  // Sincronizar mudança de cliente na renderização
  if (activeCustomer.id !== prevCustomerId) {
    setPrevCustomerId(activeCustomer.id);
    const newAddrId = activeCustomer.addresses[0]?.id || '';
    setSelectedAddressId(newAddrId);
    setSelectedPromoCouponId('');
    setSelectedExchangeCouponId('');
    setSelectedCardIds([]);
    setCardAmounts({});
  }

  // Cálculos do checkout
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  
  const calculateShipping = (addressId: string): number => {
    const addr = activeCustomer.addresses.find(a => a.id === addressId);
    if (!addr) return 0;
    if (subtotal >= 500) return 0; // Frete grátis acima de R$ 500
    const freteByState: Record<string, number> = {
      'SP': 18.90, 'RJ': 22.50, 'MG': 24.90, 'ES': 26.90,
      'PR': 25.90, 'SC': 27.90, 'RS': 29.90
    };
    return freteByState[addr.state.toUpperCase()] ?? 29.90;
  };

  const isFreeShipping = subtotal >= 500;
  const hasSelectedAddress = !!selectedAddressId;
  const shippingCost = hasSelectedAddress ? calculateShipping(selectedAddressId) : 0;
  
  // Calcular descontos
  const promoCoupon = promoCoupons.find(c => c.id === selectedPromoCouponId);
  const exchangeCoupon = exchangeCoupons.find(c => c.id === selectedExchangeCouponId);

  const discountPromo = promoCoupon ? (subtotal * (promoCoupon.value / 100)) : 0;
  const totalPayableBeforeExchange = Math.max(0, subtotal + shippingCost - discountPromo);
  const discountExchange = exchangeCoupon ? exchangeCoupon.value : 0;
  const discountExchangeApplied = Math.min(totalPayableBeforeExchange, discountExchange);

  const totalDiscount = discountPromo + discountExchangeApplied;
  const remainingToPay = Math.max(0, totalPayableBeforeExchange - discountExchange);
  const surplusExchangeCoupon = exchangeCoupon ? Math.max(0, discountExchange - totalPayableBeforeExchange) : 0;

  // Sincronizar autofill do cartão na renderização
  const [prevCardIds, setPrevCardIds] = useState(selectedCardIds);
  const [prevRemainingToPay, setPrevRemainingToPay] = useState(remainingToPay);

  if (selectedCardIds !== prevCardIds || remainingToPay !== prevRemainingToPay) {
    setPrevCardIds(selectedCardIds);
    setPrevRemainingToPay(remainingToPay);
    if (selectedCardIds.length === 0) {
      setCardAmounts({});
    } else if (selectedCardIds.length === 1) {
      setCardAmounts({
        [selectedCardIds[0]]: remainingToPay.toFixed(2)
      });
    }
  }

  const handleCardToggle = (cardId: string) => {
    setSelectedCardIds(prev => {
      let updated;
      if (prev.includes(cardId)) {
        updated = prev.filter(id => id !== cardId);
      } else {
        updated = [...prev, cardId];
      }
      return updated;
    });
  };

  const handleCardAmountChange = (cardId: string, val: string) => {
    setCardAmounts(prev => ({
      ...prev,
      [cardId]: val
    }));
  };

  const autofillRemaining = (cardId: string) => {
    const sumOthers = selectedCardIds
      .filter(id => id !== cardId)
      .reduce((sum, id) => sum + (parseFloat(cardAmounts[id]) || 0), 0);
    const rest = Math.max(0, remainingToPay - sumOthers);
    setCardAmounts(prev => ({
      ...prev,
      [cardId]: rest.toFixed(2)
    }));
  };

  const distributeEqually = () => {
    if (selectedCardIds.length === 0) return;
    const splitVal = (remainingToPay / selectedCardIds.length).toFixed(2);
    const newAmounts: Record<string, string> = {};
    selectedCardIds.forEach(id => {
      newAmounts[id] = splitVal;
    });
    const diff = remainingToPay - (parseFloat(splitVal) * selectedCardIds.length);
    if (diff !== 0 && selectedCardIds.length > 0) {
      const lastId = selectedCardIds[selectedCardIds.length - 1];
      newAmounts[lastId] = (parseFloat(splitVal) + diff).toFixed(2);
    }
    setCardAmounts(newAmounts);
  };

  // Validação de pagamento:
  // Se remainingToPay === 0: 100% coberto por cupom de troca -> cartão NÃO é obrigatório
  // Se remainingToPay > 0:
  // - Exige ao menos um cartão selecionado
  // - Soma dos valores distribuídos deve ser igual a remainingToPay
  // - Cada cartão com valor deve pagar no mínimo R$ 10,00 (exceto se o próprio remainingToPay for inferior a R$ 10)
  const cardAmountsSum = selectedCardIds.reduce((sum, id) => sum + (parseFloat(cardAmounts[id]) || 0), 0);
  
  const isMinAmountPerCardValid = remainingToPay < 10
    ? (selectedCardIds.length === 1 && (parseFloat(cardAmounts[selectedCardIds[0]]) || 0) > 0)
    : (selectedCardIds.length > 0 && selectedCardIds.every(id => {
        const val = parseFloat(cardAmounts[id]) || 0;
        return val >= 10.0;
      }));

  const isPaymentValid = remainingToPay === 0 
    ? (selectedCardIds.length === 0 || Math.abs(cardAmountsSum - remainingToPay) < 0.01)
    : (selectedCardIds.length > 0 && Math.abs(cardAmountsSum - remainingToPay) < 0.01 && isMinAmountPerCardValid);

  // --- STEP 3: REVISÃO E CONFIRMAÇÃO ---
  const handleConfirmOrder = () => {
    const address = activeCustomer.addresses.find(a => a.id === selectedAddressId);
    if (!address) return;

    const cardsForPayment = remainingToPay === 0 
      ? [] 
      : selectedCardIds
          .filter(id => (parseFloat(cardAmounts[id]) || 0) > 0)
          .map(id => ({
            cardId: id,
            amount: parseFloat(cardAmounts[id]) || 0
          }));

    const appliedCoupons: Coupon[] = [];
    if (promoCoupon) appliedCoupons.push(promoCoupon);
    if (exchangeCoupon) appliedCoupons.push(exchangeCoupon);

    const order = checkoutCart(
      address,
      cardsForPayment,
      appliedCoupons,
      subtotal,
      totalDiscount,
      remainingToPay,
      surplusExchangeCoupon,
      {
        shippingCost,
        discountPromo,
        discountExchange: discountExchangeApplied
      }
    );

    setCreatedOrder(order);
    setStep(4);
  };

  const selectedAddressObj = activeCustomer.addresses.find(a => a.id === selectedAddressId);

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        
        {/* Passos do Checkout (Apenas passos 1, 2, 3 visíveis) */}
        {step < 4 && (
          <div className="checkout-wizard-header">
            <div className={`wizard-step ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <span className="step-num">1</span>
              <span className="step-label">Endereço</span>
            </div>
            <div className="wizard-line"></div>
            <div className={`wizard-step ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <span className="step-num">2</span>
              <span className="step-label">Pagamento</span>
            </div>
            <div className="wizard-line"></div>
            <div className={`wizard-step ${step === 3 ? 'active' : ''}`}>
              <span className="step-num">3</span>
              <span className="step-label">Revisão</span>
            </div>
          </div>
        )}

        {/* ================= STEP 1: ENDEREÇO ================= */}
        {step === 1 && (
          <div className="checkout-step-content">
            <h3 className="step-title">Selecione o Endereço de Entrega</h3>
            
            <div className="addresses-list">
              {activeCustomer.addresses.map(addr => (
                <label 
                  key={addr.id} 
                  className={`address-label-card ${selectedAddressId === addr.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="checkout-address"
                    value={addr.id}
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="address-radio-input"
                  />
                  <div className="address-card-info" style={{ width: '100%' }}>
                    <div className="addr-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div className="addr-tag">{addr.label}</div>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditAddress(addr, e)}
                        className="btn-edit-link"
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline', padding: '0 0.25rem' }}
                      >
                        Editar
                      </button>
                    </div>
                    <p className="addr-street">{addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`}</p>
                    <p className="addr-loc">{addr.neighborhood} - {addr.city} / {addr.state}</p>
                    <p className="addr-cep">CEP {addr.zipCode}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="address-actions">
              <button 
                onClick={handleOpenAddAddress} 
                className="btn btn-secondary add-addr-btn"
                type="button"
              >
                + ADICIONAR NOVO ENDEREÇO
              </button>
            </div>

            {/* Previsão de frete */}
            <div className="shipping-preview-box">
              <div className="calc-row">
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="calc-row">
                <span>Frete</span>
                <span className={!hasSelectedAddress ? 'text-muted-italic' : ''}>
                  {!hasSelectedAddress
                    ? 'Selecione um endereço'
                    : isFreeShipping
                      ? 'Grátis'
                      : shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  }
                </span>
              </div>
              <div className="calc-divider"></div>
              <div className="calc-row total-row">
                <span>Total Provisório</span>
                <span>{(hasSelectedAddress ? subtotal + shippingCost : subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <div className="step-footer">
              <Link to="/carrinho" className="btn btn-secondary">Voltar ao Carrinho</Link>
              <button 
                onClick={() => setStep(2)} 
                disabled={!selectedAddressId}
                className="btn btn-primary"
                type="button"
              >
                Ir para o Pagamento
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PAGAMENTO ================= */}
        {step === 2 && (
          <div className="checkout-step-content">
            <h3 className="step-title">Forma de Pagamento e Cupons</h3>

            <div className="payment-layout">
              <div className="payment-inputs">
                
                {/* Cupons */}
                <div className="payment-section">
                  <h4 className="section-subtitle">Cupons Disponíveis</h4>
                  
                  {customerCoupons.length > 0 ? (
                    <div className="coupons-checkout-list">
                      {/* Promocionais */}
                      {promoCoupons.map(c => (
                        <label key={c.id} className="coupon-checkout-row">
                          <input
                            type="checkbox"
                            checked={selectedPromoCouponId === c.id}
                            onChange={() => setSelectedPromoCouponId(prev => prev === c.id ? '' : c.id)}
                          />
                          <div className="coupon-checkout-details">
                            <span className="cp-code">{c.code}</span>
                            <span className="cp-desc">{c.description}</span>
                          </div>
                        </label>
                      ))}

                      {/* De Troca */}
                      {exchangeCoupons.map(c => (
                        <label key={c.id} className="coupon-checkout-row">
                          <input
                            type="checkbox"
                            checked={selectedExchangeCouponId === c.id}
                            onChange={() => setSelectedExchangeCouponId(prev => prev === c.id ? '' : c.id)}
                          />
                          <div className="coupon-checkout-details">
                            <span className="cp-code">{c.code}</span>
                            <span className="cp-desc">{c.description} (Valor: {c.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="no-coupons-text">Você não possui cupons disponíveis.</p>
                  )}
                </div>

                {/* Cartões de Crédito */}
                <div className="payment-section">
                  <div className="cards-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 className="section-subtitle" style={{ margin: 0 }}>Cartões de Crédito</h4>
                    <button 
                      type="button" 
                      onClick={() => setIsCardModalOpen(true)}
                      className="btn btn-secondary btn-small"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      + ADICIONAR NOVO CARTÃO
                    </button>
                  </div>
                  <p className="card-instructions">Selecione um ou mais cartões para realizar o pagamento.</p>

                  <div className="cards-checkout-list">
                    {activeCustomer.cards.map(card => {
                      const isSelected = selectedCardIds.includes(card.id);
                      return (
                        <div key={card.id} className={`card-checkout-row ${isSelected ? 'selected' : ''}`}>
                          <label className="card-selector-label">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleCardToggle(card.id)}
                            />
                            <div className="card-icon-info">
                              <span className="card-brand-tag">{card.brand}</span>
                              <span className="card-number-tag">final {card.lastFour}</span>
                              {card.isPreferred && <span className="pref-badge">Pref</span>}
                            </div>
                          </label>

                          {isSelected && selectedCardIds.length > 1 && (
                            <div className="card-split-input">
                              <span className="currency-prefix">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={cardAmounts[card.id] || ''}
                                onChange={(e) => handleCardAmountChange(card.id, e.target.value)}
                                className="card-amount-field"
                              />
                              <button 
                                type="button" 
                                onClick={() => autofillRemaining(card.id)}
                                className="btn-use-rest"
                              >
                                Usar Restante
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectedCardIds.length > 1 && (
                    <div className="split-actions-bar">
                      <button 
                        type="button" 
                        onClick={distributeEqually} 
                        className="btn btn-secondary btn-small"
                      >
                        DISTRIBUIR IGUALMENTE
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Box de Cálculo da Compra */}
              <div className="payment-calc-sidebar">
                <div className="calc-card">
                  <h4 className="calc-title">Resumo Financeiro</h4>
                  
                  <div className="calc-row">
                    <span>Produtos (Subtotal)</span>
                    <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  
                  <div className="calc-row">
                    <span>Frete</span>
                    <span>{shippingCost === 0 ? 'Grátis' : shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  {discountPromo > 0 && (
                    <div className="calc-row discount-row">
                      <span>Desconto Promocional</span>
                      <span>-{discountPromo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}

                  {discountExchangeApplied > 0 && (
                    <div className="calc-row discount-row">
                      <span>Cupom de Troca</span>
                      <span>-{discountExchangeApplied.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}

                  {surplusExchangeCoupon > 0 && (
                    <div className="calc-row discount-row" style={{ color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                      <span>Saldo Excedente a Gerar</span>
                      <span>+{surplusExchangeCoupon.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}

                  <div className="calc-divider"></div>

                  <div className="calc-row total-row">
                    <span>Total a Pagar</span>
                    <span>{remainingToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  <div className="calc-divider"></div>

                  {/* Detalhamento de Distribuição */}
                  {remainingToPay === 0 ? (
                    <div className="payment-distribution-info">
                      <div className="dist-row">
                        <span>Forma de Pagamento:</span>
                        <span className="text-success">Cupom de Troca (100%)</span>
                      </div>
                      {surplusExchangeCoupon > 0 && (
                        <div className="dist-row" style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          <span>Novo cupom gerado após compra:</span>
                          <strong style={{ color: 'var(--color-primary)' }}>{surplusExchangeCoupon.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="payment-distribution-info">
                      <div className="dist-row">
                        <span>Valor Pago nos Cartões:</span>
                        <span className={isPaymentValid ? 'text-success' : 'text-danger'}>
                          {cardAmountsSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      {!isPaymentValid && (
                        <div className="dist-warning">
                          {selectedCardIds.length === 0 ? (
                            <span>Selecione ao menos um cartão para pagar o restante.</span>
                          ) : !isMinAmountPerCardValid ? (
                            <span>
                              {remainingToPay < 10 
                                ? 'Para valores inferiores a R$ 10,00, utilize apenas um cartão.' 
                                : 'Cada cartão selecionado deve pagar no mínimo R$ 10,00 (sem valores zerados).'}
                            </span>
                          ) : cardAmountsSum < remainingToPay ? (
                            <span>Falta distribuir: <strong>{(remainingToPay - cardAmountsSum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                          ) : (
                            <span>Excedeu: <strong>{(cardAmountsSum - remainingToPay).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="step-footer">
              <button onClick={() => setStep(1)} className="btn btn-secondary" type="button">Voltar</button>
              <button 
                onClick={() => setStep(3)} 
                disabled={!isPaymentValid}
                className="btn btn-primary"
                type="button"
              >
                Revisar Pedido
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: REVISÃO ================= */}
        {step === 3 && (
          <div className="checkout-step-content">
            <h3 className="step-title">Revisão do seu Pedido</h3>

            <div className="review-layout">
              <div className="review-main">
                {/* Endereço */}
                <div className="review-section">
                  <h4 className="review-subtitle">Endereço de Entrega</h4>
                  {selectedAddressObj && (
                    <div className="review-addr-card">
                      <strong>{selectedAddressObj.label}</strong>
                      <p>{selectedAddressObj.street}, {selectedAddressObj.number} {selectedAddressObj.complement && `- ${selectedAddressObj.complement}`}</p>
                      <p>{selectedAddressObj.neighborhood} - {selectedAddressObj.city} / {selectedAddressObj.state}</p>
                    </div>
                  )}
                </div>

                {/* Pagamento */}
                <div className="review-section">
                  <h4 className="review-subtitle">Forma de Pagamento</h4>
                  <div className="review-payments-list">
                    {promoCoupon && (
                      <div className="review-pay-item">
                        <span>Cupom Promocional <strong>{promoCoupon.code}</strong> ({promoCoupon.value}% OFF)</span>
                        <span><strong>-{discountPromo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                      </div>
                    )}
                    {exchangeCoupon && (
                      <div className="review-pay-item">
                        <span>Cupom de Troca <strong>{exchangeCoupon.code}</strong></span>
                        <span><strong>-{discountExchangeApplied.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                      </div>
                    )}
                    {remainingToPay === 0 ? (
                      <div className="review-pay-item">
                        <span>Cobrança em Cartão de Crédito</span>
                        <span className="text-success"><strong>R$ 0,00 (Pago integralmente por cupom)</strong></span>
                      </div>
                    ) : (
                      selectedCardIds.map(id => {
                        const c = activeCustomer.cards.find(x => x.id === id);
                        const amt = parseFloat(cardAmounts[id] || '0');
                        return c && amt > 0 ? (
                          <div key={c.id} className="review-pay-item">
                            <span>Cartão <strong>{c.brand}</strong> (final {c.lastFour})</span>
                            <span><strong>{amt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                          </div>
                        ) : null;
                      })
                    )}
                  </div>
                </div>

                {/* Itens */}
                <div className="review-section">
                  <h4 className="review-subtitle">Itens do Pedido</h4>
                  <div className="review-items-list">
                    {cartItems.map(item => (
                      <div key={`${item.product.id}-${item.size}`} className="review-item-row">
                        <div className="rev-item-info">
                          <span>{item.product.brand} - <strong>{item.product.name}</strong> (Tamanho {item.size})</span>
                          <span className="rev-qty">Qtd: {item.quantity}</span>
                        </div>
                        <span className="rev-price">
                          {(item.product.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sumário */}
              <div className="review-summary-sidebar">
                <div className="calc-card">
                  <h4 className="calc-title">Resumo do Pedido</h4>
                  <div className="calc-row">
                    <span>Subtotal</span>
                    <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="calc-row">
                    <span>Frete</span>
                    <span>{shippingCost === 0 ? 'Grátis' : shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="calc-row discount-row">
                      <span>Descontos</span>
                      <span>-{totalDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}
                  <div className="calc-divider"></div>
                  <div className="calc-row total-row">
                    <span>Total Final</span>
                    <span>{remainingToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="step-footer">
              <button onClick={() => setStep(2)} className="btn btn-secondary" type="button">Voltar</button>
              <button 
                onClick={handleConfirmOrder} 
                className="btn btn-primary btn-confirm-order"
                type="button"
              >
                CONFIRMAR PEDIDO
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: CONFIRMADO ================= */}
        {step === 4 && createdOrder && (
          <div className="order-confirmed-screen">
            <div className="success-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            
            <h2 className="confirmed-title">PEDIDO REALIZADO!</h2>
            <p className="confirmed-desc">Seu pedido foi confirmado e está sendo processado.</p>

            <div className="confirmed-details-card">
              <div className="conf-detail-row">
                <span>Número do Pedido</span>
                <strong className="neon-text">{createdOrder.id}</strong>
              </div>
              <div className="conf-detail-row">
                <span>Status</span>
                <span className="status-badge-open">{createdOrder.status}</span>
              </div>
              <div className="conf-detail-row">
                <span>Total Pago</span>
                <strong>{createdOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
            </div>

            <div className="confirmed-actions">
              <Link to="/cliente?tab=pedidos" className="btn btn-confirmed-orders">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span>MEUS PEDIDOS</span>
              </Link>
              <Link to="/catalogo" className="btn btn-confirmed-continue">
                <span>CONTINUAR COMPRANDO</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* Modal Adicionar / Editar Endereço no Checkout */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        title={editingAddress ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
      >
        <form onSubmit={handleSaveAddress} className="address-modal-form">
          <div className="form-group">
            <label htmlFor="addr-label">Identificação (ex: Casa, Trabalho)</label>
            <input
              type="text"
              id="addr-label"
              value={addressForm.label}
              onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="ex: Minha Casa"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="addr-street">Logradouro</label>
              <input
                type="text"
                id="addr-street"
                value={addressForm.street}
                onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                placeholder="Rua, Avenida..."
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-number">Número</label>
              <input
                type="text"
                id="addr-number"
                value={addressForm.number}
                onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                placeholder="123"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="addr-comp">Complemento</label>
              <input
                type="text"
                id="addr-comp"
                value={addressForm.complement}
                onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                placeholder="Apto, Bloco..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="addr-neighborhood">Bairro</label>
              <input
                type="text"
                id="addr-neighborhood"
                value={addressForm.neighborhood}
                onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                placeholder="Jardim..."
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="addr-zip">CEP</label>
              <input
                type="text"
                id="addr-zip"
                value={addressForm.zipCode}
                onChange={(e) => setAddressForm(prev => ({ ...prev, zipCode: e.target.value }))}
                placeholder="00000-000"
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="addr-city">Cidade</label>
              <input
                type="text"
                id="addr-city"
                value={addressForm.city}
                onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-state">Estado</label>
              <input
                type="text"
                id="addr-state"
                value={addressForm.state}
                onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                placeholder="SP"
                required
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1rem', border: 'none', padding: '0' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => {
                setIsAddressModalOpen(false);
                setEditingAddress(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary">
              {editingAddress ? 'SALVAR ALTERAÇÕES' : 'SALVAR ENDEREÇO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Adicionar Cartão no Checkout */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        title="Adicionar Novo Cartão"
      >
        <form onSubmit={handleAddNewCard} className="address-modal-form">
          <div className="form-group">
            <label htmlFor="chk-card-number">Número do Cartão</label>
            <input
              type="text"
              id="chk-card-number"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={newCard.cardNumber}
              onChange={e => setNewCard(prev => ({ ...prev, cardNumber: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="chk-card-holder">Nome Impresso no Cartão</label>
            <input
              type="text"
              id="chk-card-holder"
              placeholder="NOME COMO NO CARTÃO"
              value={newCard.holderName}
              onChange={e => setNewCard(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="chk-card-brand">Bandeira</label>
              <select
                id="chk-card-brand"
                value={newCard.brand}
                onChange={e => setNewCard(prev => ({ ...prev, brand: e.target.value as 'Visa' | 'Mastercard' | 'Elo' }))}
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Elo">Elo</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="chk-card-exp">Validade</label>
              <input
                type="text"
                id="chk-card-exp"
                placeholder="MM/AA"
                maxLength={5}
                value={newCard.expirationDate}
                onChange={e => setNewCard(prev => ({ ...prev, expirationDate: e.target.value }))}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="chk-card-cvv">CVV</label>
              <input
                type="text"
                id="chk-card-cvv"
                placeholder="123"
                maxLength={4}
                value={newCard.cvv}
                onChange={e => setNewCard(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                required
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#a0a0a0', cursor: 'pointer', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              checked={newCard.isPreferred}
              onChange={e => setNewCard(prev => ({ ...prev, isPreferred: e.target.checked }))}
            />
            Definir como cartão preferencial
          </label>

          <div className="modal-actions" style={{ marginTop: '1rem', border: 'none', padding: '0' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setIsCardModalOpen(false)}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary">
              SALVAR E USAR CARTÃO
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
