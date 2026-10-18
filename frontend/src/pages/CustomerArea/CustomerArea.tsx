import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import Toast from '../../components/Toast/Toast';
import OrderDetailsModal from '../../components/OrderDetailsModal/OrderDetailsModal';
import { BRAZILIAN_STATES } from '../../data/brazilianStates';
import type { Address, Order, BandeiraDto, ElegibilidadeTrocaResponseDto, ItemElegibilidadeTrocaDto } from '../../types';
import { trocaService } from '../../services/trocaService';
import {
  listarBandeiras,
  alterarSenhaCliente,
  convertDateBrToIso,
  type ClienteUpdateRequestDto
} from '../../services/clienteService';
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
    inativarCustomer,
    cancelOrder,
    confirmOrderReceipt,
    requestExchange,
    updateOrderStatus,
    refreshOrders,
    refreshExchanges,
    refreshCoupons,
    updateCustomerProfile,
    addCustomerAddress,
    updateCustomerAddress,
    refreshCustomerAddresses,
    removeCustomerAddress,
    refreshCustomerCards,
    addCustomerCard,
    setCardAsPreferred
  } = useApp();

  const [addressToRemove, setAddressToRemove] = useState<Address | null>(null);

  useEffect(() => {
    if (activeCustomer?.id) {
      refreshOrders();
      refreshExchanges();
      refreshCoupons(activeCustomer.id);
    }
  }, [activeCustomer?.id, refreshOrders, refreshExchanges, refreshCoupons]);

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

  // Módulos de Edição de Perfil (RF0022 - Comunicação real com a API)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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

  const handleSaveProfile = async (e: React.FormEvent) => {
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

    const cleanDdd = profileForm.phoneDdd.replace(/\D/g, '').slice(0, 2);
    const cleanPhone = profileForm.phoneNumber.replace(/\D/g, '');
    const payload: ClienteUpdateRequestDto = {
      nome: profileForm.name.trim(),
      email: profileForm.email.trim(),
      genero: profileForm.gender,
      dataNascimento: convertDateBrToIso(profileForm.birthDate),
      telefone: {
        tipo: profileForm.phoneType,
        ddd: cleanDdd,
        numero: cleanPhone
      }
    };

    setIsSavingProfile(true);
    try {
      const res = await updateCustomerProfile(activeCustomer.id, payload);
      if (res.success) {
        setToastMessage('Dados cadastrais atualizados com sucesso!');
        setToastType('success');
        setIsEditingProfile(false);
      } else {
        setProfileError(res.error || 'Não foi possível atualizar os dados cadastrais.');
      }
    } catch {
      setProfileError('Erro de conexão ao atualizar os dados cadastrais.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEditBirthDateChange = (val: string) => {
    setProfileForm(p => ({ ...p, birthDate: maskBirthDate(val) }));
  };

  const handleEditPhoneNumChange = (val: string) => {
    setProfileForm(p => ({ ...p, phoneNumber: maskPhoneNumber(val) }));
  };

  // Módulo de Inativação (Card #57 / RF0023 - Comunicação real via PATCH)
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);
  const [isInactivating, setIsInactivating] = useState(false);
  const [inactivateError, setInactivateError] = useState<string | null>(null);

  const handleConfirmInactivate = async () => {
    setIsInactivating(true);
    setInactivateError(null);
    try {
      const res = await inativarCustomer(activeCustomer.id);
      if (res.success) {
        setToastMessage(res.mensagem || 'Cadastro inativado com sucesso.');
        setToastType('success');
        setIsInactivateModalOpen(false);
      } else {
        setInactivateError(res.error || 'Não foi possível inativar o cadastro.');
      }
    } catch {
      setInactivateError('Falha ao conectar com o servidor para inativar o cadastro.');
    } finally {
      setIsInactivating(false);
    }
  };

  // Módulo de Alteração de Senha (RF0028 - Comunicação real via PATCH)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    novaSenha: '',
    confirmacaoNovaSenha: ''
  });

  const handleOpenPasswordModal = () => {
    setPasswordForm({ novaSenha: '', confirmacaoNovaSenha: '' });
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Validações de UX
    if (!passwordForm.novaSenha) {
      setPasswordError('Informe a nova senha.');
      return;
    }
    if (passwordForm.novaSenha.length < 8) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (passwordForm.novaSenha !== passwordForm.confirmacaoNovaSenha) {
      setPasswordError('A confirmação da nova senha não confere com a senha digitada.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await alterarSenhaCliente(activeCustomer.id, passwordForm.novaSenha, passwordForm.confirmacaoNovaSenha);
      if (res.success) {
        setToastMessage(res.mensagem || 'Senha alterada com sucesso!');
        setToastType('success');
        setIsPasswordModalOpen(false);
        setPasswordForm({ novaSenha: '', confirmacaoNovaSenha: '' });
      } else {
        setPasswordError(res.error || 'Não foi possível alterar a senha.');
      }
    } catch {
      setPasswordError('Falha ao conectar com o servidor para alterar a senha.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Módulos de Cartões (Card #52)
  const [bandeiras, setBandeiras] = useState<BandeiraDto[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardModalError, setCardModalError] = useState<string | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    bandeiraId: 1,
    cardNumber: '',
    holderName: '',
    expirationDate: '',
    cvv: '',
    isPreferred: false
  });

  useEffect(() => {
    async function carregarBandeiras() {
      const res = await listarBandeiras();
      if (res.success && res.bandeiras) {
        setBandeiras(res.bandeiras);
      }
    }
    carregarBandeiras();
  }, []);

  const handleOpenAddCard = () => {
    setCardModalError(null);
    setCardForm({
      bandeiraId: 0,
      cardNumber: '',
      holderName: '',
      expirationDate: '',
      cvv: '',
      isPreferred: false
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardModalError(null);

    const cleanNum = cardForm.cardNumber.replace(/\D/g, '');
    const numVal = validateCardNumber(cleanNum);
    if (!numVal.isValid) {
      setCardModalError(numVal.error || 'Informe um número de cartão válido.');
      return;
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

    const cleanCvv = cardForm.cvv.replace(/\D/g, '');
    const cvvVal = validateCardCvv(cleanCvv);
    if (!cvvVal.isValid) {
      setCardModalError(cvvVal.error || 'Código CVV inválido.');
      return;
    }

    if (!cardForm.bandeiraId || cardForm.bandeiraId <= 0) {
      setCardModalError('Selecione uma bandeira válida.');
      return;
    }

    setIsSavingCard(true);

    try {
      const res = await addCustomerCard(activeCustomer.id, {
        bandeiraId: cardForm.bandeiraId,
        numeroCartao: cleanNum,
        nomeImpresso: cardForm.holderName.toUpperCase().trim(),
        dataValidade: cardForm.expirationDate.trim(),
        cvv: cleanCvv,
        preferencial: cardForm.isPreferred
      });

      if (!res.success) {
        setCardModalError(res.error || 'Erro ao cadastrar o cartão.');
        setIsSavingCard(false);
        return;
      }

      setToastMessage('Novo cartão cadastrado com sucesso!');
      setToastType('success');
      setIsCardModalOpen(false);
    } catch {
      setCardModalError('Erro inesperado ao salvar cartão.');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleSetCardAsPreferred = async (cardId: string) => {
    try {
      const res = await setCardAsPreferred(activeCustomer.id, cardId);
      if (res.success) {
        setToastMessage('Cartão preferencial atualizado com sucesso!');
        setToastType('success');
      } else {
        setToastMessage(res.error || 'Não foi possível definir o cartão como preferencial.');
        setToastType('error');
      }
    } catch {
      setToastMessage('Erro inesperado ao atualizar o cartão preferencial.');
      setToastType('error');
    }
  };

  // Módulos de Endereços
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [addrModalError, setAddrModalError] = useState<string | null>(null);
  const [isSavingAddr, setIsSavingAddr] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
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
    isResidential: false,
    isDelivery: false,
    isBilling: false
  });

  useEffect(() => {
    if (activeCustomer?.id) {
      refreshCustomerAddresses(activeCustomer.id);
      refreshCustomerCards(activeCustomer.id);
    }
  }, [activeCustomer?.id]);

  const handleOpenAddAddr = () => {
    setEditingAddress(null);
    setAddrModalError(null);
    setAddrForm({
      label: '', residenceType: 'Casa', streetType: 'Rua', street: '', number: '', complement: '', neighborhood: '',
      zipCode: '', city: '', state: '', country: 'Brasil', observations: '', isResidential: false, isDelivery: false, isBilling: false
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
      state: (addr.state || '').trim().toUpperCase(),
      country: addr.country || 'Brasil',
      observations: addr.observations || '',
      isResidential: !!addr.isResidential,
      isDelivery: !!addr.isDelivery,
      isBilling: !!addr.isBilling
    });
    setIsAddrModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrModalError(null);

    if (
      !addrForm.label.trim() ||
      !addrForm.residenceType.trim() ||
      !addrForm.streetType.trim() ||
      !addrForm.street.trim() ||
      !addrForm.number.trim() ||
      !addrForm.neighborhood.trim() ||
      !addrForm.city.trim() ||
      !addrForm.state.trim() ||
      !addrForm.country.trim()
    ) {
      setAddrModalError('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    const zipVal = validateZipCode(addrForm.zipCode);
    if (!zipVal.isValid) {
      setAddrModalError(zipVal.error || 'Informe um CEP válido com 8 dígitos.');
      return;
    }

    if (!addrForm.isResidential && !addrForm.isDelivery && !addrForm.isBilling) {
      setAddrModalError('O endereço deve possuir pelo menos uma finalidade: Residencial, Entrega ou Cobrança.');
      return;
    }

    setIsSavingAddr(true);

    try {
      if (editingAddress) {
        const res = await updateCustomerAddress(activeCustomer.id, {
          ...editingAddress,
          ...addrForm,
          zipCode: maskZipCode(addrForm.zipCode)
        });
        if (!res.success) {
          setAddrModalError(res.error || 'Erro ao atualizar o endereço.');
          setIsSavingAddr(false);
          return;
        }
        setToastMessage('Endereço atualizado com sucesso!');
        setToastType('success');
      } else {
        const res = await addCustomerAddress(activeCustomer.id, {
          ...addrForm,
          zipCode: maskZipCode(addrForm.zipCode)
        });
        if (!res.success) {
          setAddrModalError(res.error || 'Erro ao cadastrar o endereço.');
          setIsSavingAddr(false);
          return;
        }
        setToastMessage('Novo endereço cadastrado com sucesso!');
        setToastType('success');
      }

      setIsAddrModalOpen(false);
    } catch {
      setAddrModalError('Erro inesperado ao salvar endereço.');
    } finally {
      setIsSavingAddr(false);
    }
  };

  // --- CONTROLE DE TROCA ---
  interface SelectedExchangeItemState {
    itemPedidoId: number;
    productId: string;
    productName: string;
    size: number;
    quantity: number;
    price: number;
  }

  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [selectedOrderForExc, setSelectedOrderForExc] = useState<Order | null>(null);
  const [selectedExcItems, setSelectedExcItems] = useState<SelectedExchangeItemState[]>([]);
  const [exchangeReason, setExchangeReason] = useState('');
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibilityData, setEligibilityData] = useState<ElegibilidadeTrocaResponseDto | null>(null);
  const [exchangeModalError, setExchangeModalError] = useState<string | null>(null);
  const [isSubmittingExchange, setIsSubmittingExchange] = useState(false);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);

  const handleOpenExchange = async (order: Order) => {
    setSelectedOrderForExc(order);
    setSelectedExcItems([]);
    setExchangeReason('');
    setExchangeModalError(null);
    setEligibilityData(null);
    setIsCheckingEligibility(true);
    setIsExchangeModalOpen(true);

    try {
      const res = await trocaService.consultarElegibilidade(order.id);
      if (res.success && res.dados) {
        setEligibilityData(res.dados);
        if (!res.dados.podeSolicitarTroca) {
          setExchangeModalError(res.dados.motivoBloqueio || 'Este pedido não está elegível para solicitação de troca.');
        }
      } else {
        setExchangeModalError(res.error || 'Erro ao verificar elegibilidade da troca.');
      }
    } catch (err: any) {
      setExchangeModalError(err.message || 'Falha ao consultar elegibilidade do pedido.');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleToggleItemSelection = (item: ItemElegibilidadeTrocaDto) => {
    setSelectedExcItems(prev => {
      const exists = prev.find(i => i.itemPedidoId === item.itemPedidoId);
      if (exists) {
        return prev.filter(i => i.itemPedidoId !== item.itemPedidoId);
      } else {
        return [
          ...prev,
          {
            itemPedidoId: item.itemPedidoId,
            productId: String(item.produtoVariacaoId),
            productName: item.nomeProduto,
            size: item.tamanho,
            quantity: 1,
            price: item.precoUnitario
          }
        ];
      }
    });
  };

  const handleUpdateItemQuantity = (itemPedidoId: number, newQty: number, maxQty: number) => {
    const clampedQty = Math.max(1, Math.min(newQty, maxQty));
    setSelectedExcItems(prev =>
      prev.map(item =>
        item.itemPedidoId === itemPedidoId
          ? { ...item, quantity: clampedQty }
          : item
      )
    );
  };

  const handleConfirmExchangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForExc || selectedExcItems.length === 0 || !exchangeReason.trim()) return;

    setIsSubmittingExchange(true);
    setExchangeModalError(null);

    try {
      const res = await requestExchange(
        selectedOrderForExc.id,
        selectedExcItems.map(i => ({
          productId: i.productId,
          size: i.size,
          quantity: i.quantity,
          itemPedidoId: i.itemPedidoId
        })),
        exchangeReason.trim()
      );

      if (res.success && res.troca) {
        setIsExchangeModalOpen(false);
        setToastMessage(`Solicitação de troca ${res.troca.id} realizada com sucesso!`);
        setToastType('success');
        await Promise.all([refreshOrders(), refreshExchanges()]);
      } else {
        setExchangeModalError(res.error || 'Erro ao solicitar troca.');
      }
    } catch (err: any) {
      setExchangeModalError(err.message || 'Falha de comunicação ao solicitar troca.');
    } finally {
      setIsSubmittingExchange(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setActionLoadingOrderId(orderId);
    try {
      const res = await cancelOrder(orderId);
      if (res.success) {
        setToastMessage('Pedido cancelado com sucesso.');
        setToastType('success');
      } else {
        setToastMessage(res.error || 'Erro ao cancelar pedido.');
        setToastType('error');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Erro ao cancelar pedido.');
      setToastType('error');
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleConfirmOrderReceipt = async (orderId: string) => {
    setActionLoadingOrderId(orderId);
    try {
      const res = await updateOrderStatus(orderId, 'ENTREGUE');
      if (res.success) {
        confirmOrderReceipt(orderId);
        setToastMessage('Recebimento confirmado com sucesso!');
        setToastType('success');
      } else {
        setToastMessage(res.error || 'Erro ao confirmar recebimento.');
        setToastType('error');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Erro ao confirmar recebimento.');
      setToastType('error');
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  // --- CONTROLE DE DETALHES DE PEDIDO ---
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);

  const handleOpenOrderDetails = (order: Order) => {
    setSelectedOrderForDetails(order);
    setIsOrderDetailsModalOpen(true);
  };

  // Filtrar dados do cliente atual
  const customerOrders = orders.filter(
    o => o.customerId === activeCustomer.id || o.customerId === String(activeCustomer.id)
  );
  const customerCoupons = coupons.filter(
    c => c.customerId === activeCustomer.id || c.customerId === String(activeCustomer.id) || c.type === 'promo'
  );


  return (
    <div className="customer-area-page">
      <div className="customer-container">

        {/* Banner do Perfil do Cliente */}
        <div className="profile-header-banner">
          <div className="profile-avatar">
            {activeCustomer.name ? activeCustomer.name.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="profile-header-info">
            <h2 className="profile-client-name">{activeCustomer.name || 'Cliente'}</h2>
            <p className="profile-client-email">{activeCustomer.email}</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`status-badge ${activeCustomer.status.toLowerCase()}`} data-cy="perfil-status-badge">
                Conta {activeCustomer.status}
              </span>
            </div>
          </div>

          <div className="profile-header-action">
            {activeCustomer.status === 'ATIVO' && (
              <button
                onClick={() => {
                  setInactivateError(null);
                  setIsInactivateModalOpen(true);
                }}
                className="btn btn-secondary btn-inactivate"
                type="button"
                data-cy="perfil-inativar-btn"
              >
                INATIVAR MEU CADASTRO
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
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!isEditingProfile && (
                    <>
                      <button
                        onClick={handleOpenPasswordModal}
                        className="btn btn-secondary btn-small"
                        type="button"
                        data-cy="alterar-senha-btn"
                      >
                        ALTERAR SENHA
                      </button>
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="btn btn-secondary btn-small"
                        type="button"
                        data-cy="perfil-editar-btn"
                      >
                        EDITAR
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!isEditingProfile ? (
                <div className="personal-data-grid">
                  <div className="data-field">
                    <span className="field-label">Nome Completo</span>
                    <span className="field-val" data-cy="perfil-nome-val">{activeCustomer.name}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">E-mail</span>
                    <span className="field-val" data-cy="perfil-email-val">{activeCustomer.email}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">CPF</span>
                    <span className="field-val" data-cy="perfil-cpf-val">{activeCustomer.cpf}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Telefone</span>
                    <span className="field-val" data-cy="perfil-telefone-val">
                      {activeCustomer.phoneDdd && activeCustomer.phoneNumber 
                        ? `(${activeCustomer.phoneDdd}) ${activeCustomer.phoneNumber} (${activeCustomer.phoneType || 'Celular'})`
                        : `${activeCustomer.phone} (${activeCustomer.phoneType || 'Celular'})`}
                    </span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Gênero</span>
                    <span className="field-val" data-cy="perfil-genero-val">{activeCustomer.gender}</span>
                  </div>
                  <div className="data-field">
                    <span className="field-label">Data de Nascimento</span>
                    <span className="field-val" data-cy="perfil-nascimento-val">{activeCustomer.birthDate}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="personal-data-form">
                  {profileError && (
                    <div
                      data-cy="perfil-error-banner"
                      style={{
                        backgroundColor: 'rgba(255, 69, 69, 0.1)',
                        border: '1px solid var(--color-danger)',
                        color: 'var(--color-danger)',
                        padding: '0.65rem 0.9rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        marginBottom: '1rem',
                        gridColumn: '1 / -1'
                      }}
                    >
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
                        data-cy="perfil-input-nome"
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
                        data-cy="perfil-input-email"
                      />
                    </div>
                    <div className="form-group">
                      <label>CPF (Apenas Leitura)</label>
                      <input type="text" value={activeCustomer.cpf} disabled className="disabled-field" data-cy="perfil-input-cpf" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-phone-type">Tipo de Telefone</label>
                      <select
                        id="edit-phone-type"
                        value={profileForm.phoneType}
                        onChange={e => setProfileForm(p => ({ ...p, phoneType: e.target.value }))}
                        data-cy="perfil-select-phone-type"
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
                          data-cy="perfil-input-phone-ddd"
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
                          data-cy="perfil-input-phone-num"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-gender">Gênero</label>
                      <select
                        id="edit-gender"
                        value={profileForm.gender}
                        onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                        data-cy="perfil-select-gender"
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
                        data-cy="perfil-input-birth"
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
                      data-cy="perfil-cancelar-btn"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-small"
                      disabled={isSavingProfile}
                      data-cy="perfil-salvar-btn"
                    >
                      {isSavingProfile ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Endereços de Entrega */}
            <div className="profile-card-section" data-cy="enderecos-section">
              <div className="section-card-header">
                <h3 className="section-card-title">Meus Endereços</h3>
                <button
                  onClick={handleOpenAddAddr}
                  className="btn btn-secondary btn-small"
                  type="button"
                  data-cy="novo-endereco-btn"
                >
                  + ADICIONAR ENDEREÇO
                </button>
              </div>

              <div className="profile-addresses-grid">
                {activeCustomer.addresses.map(addr => (
                  <div key={addr.id} className="profile-address-card" data-cy="endereco-card">
                    <div className="addr-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', rowGap: '0.25rem' }}>
                        <span className="profile-addr-label" data-cy="endereco-nome">{addr.label}</span>
                        {addr.isResidential && (
                          <span data-cy="tag-residencial" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255, 165, 0, 0.15)', color: '#ffaa00', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #ffaa00' }}>
                            Residencial
                          </span>
                        )}
                        {addr.isDelivery && (
                          <span data-cy="tag-entrega" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(67, 185, 86, 0.15)', color: 'var(--color-success)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-success)' }}>
                            Entrega
                          </span>
                        )}
                        {addr.isBilling && (
                          <span data-cy="tag-cobranca" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(0, 191, 255, 0.15)', color: '#00bfff', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #00bfff' }}>
                            Cobrança
                          </span>
                        )}
                      </div>
                      <div className="addr-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditAddr(addr)}
                          className="btn-edit-link"
                          data-cy="endereco-editar-btn"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                    <p className="addr-txt" data-cy="endereco-logradouro-txt">
                      {addr.streetType ? `${addr.streetType} ` : ''}{addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`} ({addr.residenceType || 'Residencial'})
                    </p>
                    <p className="addr-txt" data-cy="endereco-cidade-txt">{addr.neighborhood} - {addr.city} / {addr.state} - {addr.country || 'Brasil'}</p>
                    <p className="addr-txt text-light" data-cy="endereco-cep-txt">CEP {addr.zipCode}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cartões de Crédito */}
            <div className="profile-card-section" data-cy="cartoes-section">
              <div className="section-card-header">
                <h3 className="section-card-title">Cartões de Crédito</h3>
                <button
                  onClick={handleOpenAddCard}
                  className="btn btn-secondary btn-small"
                  type="button"
                  data-cy="novo-cartao-btn"
                >
                  + ADICIONAR CARTÃO
                </button>
              </div>

              <div className="profile-cards-list">
                {activeCustomer.cards.length > 0 ? (
                  activeCustomer.cards.map(card => (
                    <div key={card.id} className="profile-card-row" data-cy="cartao-card">
                      <div className="card-left-info">
                        <span className="card-brand" data-cy="cartao-bandeira">{card.brand}</span>
                        <span className="card-digits" data-cy="cartao-final">final {card.lastFour}</span>
                        <span className="card-exp">val {card.expirationDate}</span>
                        {card.isPreferred && <span className="pref-tag" data-cy="cartao-preferencial-badge">Preferencial</span>}
                      </div>

                      <div className="card-row-actions">
                        {!card.isPreferred && (
                          <button
                            onClick={() => handleSetCardAsPreferred(card.id)}
                            className="btn-text-action"
                            type="button"
                            data-cy="cartao-definir-preferencial"
                          >
                            Tornar preferencial
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-cards-txt" data-cy="sem-cartoes-txt">Nenhum cartão cadastrado.</p>
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
                    const relatedExchanges = exchanges.filter(e => e.orderId === order.id);

                    return (
                      <div key={order.id} className="order-profile-card" data-cy={`order-card-${order.id}`}>
                        <div className="order-profile-card-header">
                          <div>
                            <span className="order-id-label">Pedido {order.id}</span>
                            <span className="order-date">{order.date}</span>
                          </div>
                          <span className={`order-status-tag ${order.status.replace(/\s+/g, '_').toLowerCase()}`} data-cy={`order-status-${order.id}`}>
                            {order.status}
                          </span>
                        </div>

                        <div className="order-profile-card-body">
                          {order.items.map((item, idx) => (
                            <div key={`${item.product.id}-${item.size}-${idx}`} className="order-item-mini-row">
                              <span>{item.product.brand} - {item.product.name} (Tamanho {item.size})</span>
                              <span>{item.quantity}x {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          ))}

                          {order.shippingAddress && (
                            <div className="order-shipping-hint" style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem', borderTop: '1px solid #1a1a1a', paddingTop: '0.4rem' }}>
                              <strong style={{ color: '#aaa' }}>Entrega:</strong> {order.shippingAddress.street}, {order.shippingAddress.number} {order.shippingAddress.complement ? `- ${order.shippingAddress.complement}` : ''} - {order.shippingAddress.neighborhood}, {order.shippingAddress.city}/{order.shippingAddress.state} (CEP: {order.shippingAddress.zipCode})
                            </div>
                          )}

                          {(order.paymentMethods.length > 0 || order.couponsUsed.length > 0) && (
                            <div className="order-payment-hint" style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.2rem' }}>
                              <strong style={{ color: '#aaa' }}>Pagamento:</strong> {order.paymentMethods.length > 0 ? `${order.paymentMethods.length} cartão(ões) de crédito` : 'Integralmente por cupom'}
                              {order.couponsUsed.length > 0 && ` | Cupons: ${order.couponsUsed.map(c => c.code).join(', ')}`}
                            </div>
                          )}
                        </div>

                        <div className="order-profile-card-footer">
                          <div className="order-total-block">
                            <span>Total Pago: </span>
                            <strong>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                          </div>

                          {/* Trocas vinculadas a este pedido */}
                          {relatedExchanges.length > 0 && (
                            <div className="order-related-exchanges" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.35rem' }}>
                              {relatedExchanges.map(exc => (
                                <div key={exc.id} className="order-exchange-status-box" style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid #222' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span className="exc-tag-label" style={{ fontWeight: 600, color: '#ccc' }}>Troca {exc.id}:</span>
                                      <span className={`order-status-tag ${exc.status.replace(/\s+/g, '_').toLowerCase()}`} style={{ marginLeft: '0.4rem' }}>
                                        {exc.status}
                                      </span>
                                    </div>
                                    {exc.items && exc.items.length > 0 && (
                                      <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                        {exc.items.reduce((s, it) => s + it.quantity, 0)} {exc.items.reduce((s, it) => s + it.quantity, 0) === 1 ? 'item' : 'itens'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Notificação de autorização */}
                                  {exc.notificacaoCliente && (
                                    <div className="exchange-notif-box" style={{ marginTop: '0.35rem', fontSize: '0.8rem', padding: '0.35rem 0.5rem', borderRadius: '4px', background: 'rgba(57, 255, 20, 0.08)', border: '1px solid rgba(57, 255, 20, 0.2)', color: 'var(--color-primary)' }}>
                                      📢 {exc.notificacaoCliente}
                                    </div>
                                  )}

                                  {/* Cupom gerado */}
                                  {(exc.status === 'TROCADO' || exc.status === 'TROCA PROCESSADA') && (
                                    <div className="refund-coupon-hint" style={{ marginTop: '0.35rem' }}>
                                      Cupom gerado: <strong>{exc.refundCouponCode || exc.codigoCupom || 'Gerado'}</strong>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Informações de Cancelamento / Ressarcimento */}
                          {order.status === 'REPROVADA' && (
                            <div className="order-cancellation-info" style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ color: 'var(--color-danger)', fontSize: '0.82rem' }}>Pedido cancelado/reprovado.</span>
                            </div>
                          )}

                          <div className="order-card-actions">
                            <button
                              onClick={() => handleOpenOrderDetails(order)}
                              className="btn btn-secondary btn-small"
                              type="button"
                              data-cy={`btn-detalhes-${order.id}`}
                            >
                              VER DETALHES
                            </button>

                            {/* Cancelar em Aberto ou Em Processamento */}
                            {(order.status === 'EM PROCESSAMENTO' || order.status === 'EM ABERTO') && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                className="btn btn-secondary btn-danger-border btn-small"
                                type="button"
                                disabled={actionLoadingOrderId === order.id}
                                data-cy={`btn-cancelar-${order.id}`}
                              >
                                {actionLoadingOrderId === order.id ? 'CANCELANDO...' : 'CANCELAR PEDIDO'}
                              </button>
                            )}

                            {/* Confirmação de Recebimento pelo Cliente */}
                            {order.status === 'EM TRANSPORTE' && (
                              <button
                                onClick={() => handleConfirmOrderReceipt(order.id)}
                                className="btn btn-primary btn-small"
                                type="button"
                                disabled={actionLoadingOrderId === order.id}
                                data-cy={`btn-confirmar-recebimento-${order.id}`}
                              >
                                {actionLoadingOrderId === order.id ? 'CONFIRMANDO...' : 'CONFIRMAR RECEBIMENTO'}
                              </button>
                            )}

                            {/* Solicitar Troca */}
                            {(order.status === 'ENTREGUE' || order.status === 'EM TROCA' || order.status === 'TROCA AUTORIZADA') && (
                              <button
                                onClick={() => handleOpenExchange(order)}
                                className="btn btn-primary btn-small"
                                type="button"
                                data-cy={`btn-solicitar-troca-${order.id}`}
                              >
                                {relatedExchanges.length > 0 ? 'SOLICITAR NOVA TROCA' : 'SOLICITAR TROCA'}
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
                  <div key={coupon.id} className="profile-coupon-card" data-cy={`coupon-card-${coupon.code}`}>
                    <div className="coupon-code-badge">{coupon.code}</div>
                    <div className="coupon-card-body">
                      <h4 className="coupon-card-value">
                        {coupon.type === 'promo' ? `${coupon.value}% OFF` : coupon.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </h4>
                      <p className="coupon-card-desc">{coupon.description}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: coupon.type === 'promo' ? 'rgba(0,191,255,0.12)' : 'rgba(57,255,20,0.12)', color: coupon.type === 'promo' ? '#00bfff' : 'var(--color-primary)', fontWeight: 600 }}>
                          {coupon.type === 'promo' ? 'Promocional' : 'Troca / Devolução'}
                        </span>
                        <span className="coupon-card-date" style={{ fontSize: '0.75rem', color: '#888' }}>
                          Disponível
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-coupons-txt" data-cy="sem-cupons-txt">Você não possui cupons ativos.</p>
            )}
          </div>
        )}


      </div>

      {/* MODAL: Confirma Inativação (Card #57 / RF0023) */}
      <Modal
        isOpen={isInactivateModalOpen}
        onClose={() => !isInactivating && setIsInactivateModalOpen(false)}
        title="Inativar Cadastro?"
      >
        <div className="inactive-confirm-modal">
          {inactivateError && (
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
              ⚠️ {inactivateError}
            </div>
          )}
          <p className="modal-description-txt">
            Deseja realmente inativar seu cadastro? Após a inativação, você poderá consultar seus dados e pedidos anteriores, mas não poderá realizar novas compras.
          </p>
          <div className="modal-actions">
            <button
              onClick={() => setIsInactivateModalOpen(false)}
              className="btn btn-secondary"
              disabled={isInactivating}
              type="button"
              data-cy="perfil-cancelar-inativacao"
            >
              CANCELAR
            </button>
            <button
              onClick={handleConfirmInactivate}
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              disabled={isInactivating}
              type="button"
              data-cy="perfil-confirmar-inativacao"
            >
              {isInactivating ? 'INATIVANDO...' : 'CONFIRMAR INATIVAÇÃO'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Alterar Senha (RF0028) */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          if (!isSavingPassword) {
            setIsPasswordModalOpen(false);
            setPasswordError(null);
            setPasswordForm({ novaSenha: '', confirmacaoNovaSenha: '' });
          }
        }}
        title="Alterar Minha Senha"
      >
        <form onSubmit={handleSavePassword} className="address-modal-form">
          {passwordError && (
            <div
              data-cy="senha-error-banner"
              style={{
                backgroundColor: 'rgba(255, 69, 69, 0.1)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                padding: '0.65rem 0.9rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}
            >
              ⚠️ {passwordError}
            </div>
          )}

          <p style={{ color: '#888', fontSize: '0.82rem', lineHeight: '1.4', margin: '0 0 1rem 0' }}>
            A nova senha deve ter no mínimo 8 caracteres, contendo ao menos uma letra maiúscula, uma minúscula e um caractere especial (!@#$%&*...).
          </p>

          <div className="form-group">
            <label htmlFor="user-new-pwd">Nova Senha *</label>
            <input
              type="password"
              id="user-new-pwd"
              value={passwordForm.novaSenha}
              onChange={e => setPasswordForm(prev => ({ ...prev, novaSenha: e.target.value }))}
              placeholder="Digite a nova senha"
              required
              autoComplete="new-password"
              data-cy="nova-senha"
            />
          </div>

          <div className="form-group">
            <label htmlFor="user-confirm-pwd">Confirmação da Nova Senha *</label>
            <input
              type="password"
              id="user-confirm-pwd"
              value={passwordForm.confirmacaoNovaSenha}
              onChange={e => setPasswordForm(prev => ({ ...prev, confirmacaoNovaSenha: e.target.value }))}
              placeholder="Confirme a nova senha"
              required
              autoComplete="new-password"
              data-cy="confirmacao-nova-senha"
            />
          </div>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSavingPassword}
              onClick={() => {
                setIsPasswordModalOpen(false);
                setPasswordError(null);
                setPasswordForm({ novaSenha: '', confirmacaoNovaSenha: '' });
              }}
              data-cy="cancelar-nova-senha"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingPassword || !passwordForm.novaSenha || !passwordForm.confirmacaoNovaSenha}
              data-cy="salvar-nova-senha"
            >
              {isSavingPassword ? 'SALVANDO...' : 'SALVAR SENHA'}
            </button>
          </div>
        </form>
      </Modal>
      {/* MODAL: Adicionar Cartão */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardModalError(null);
        }}
        title="Adicionar Novo Cartão"
      >
        <form onSubmit={handleSaveCard} className="address-modal-form" data-cy="cartao-form">
          {cardModalError && (
            <div data-cy="cartao-error-banner" style={{
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
            <label htmlFor="card-number">Número do Cartão *</label>
            <input
              type="text"
              id="card-number"
              data-cy="cartao-input-numero"
              maxLength={19}
              value={cardForm.cardNumber}
              onChange={e => setCardForm(prev => ({ ...prev, cardNumber: maskCardNumber(e.target.value) }))}
              placeholder="0000 0000 0000 0000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="card-holder">Nome Impresso no Cartão *</label>
            <input
              type="text"
              id="card-holder"
              data-cy="cartao-input-nome"
              value={cardForm.holderName}
              onChange={e => setCardForm(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
              placeholder="NOME COMO NO CARTÃO"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="card-brand">Bandeira *</label>
              <select
                id="card-brand"
                data-cy="cartao-select-bandeira"
                value={cardForm.bandeiraId || ''}
                onChange={e => setCardForm(prev => ({ ...prev, bandeiraId: e.target.value ? parseInt(e.target.value, 10) : 0 }))}
                required
              >
                <option value="">Selecione a bandeira...</option>
                {bandeiras.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="card-exp">Validade *</label>
              <input
                type="text"
                id="card-exp"
                data-cy="cartao-input-validade"
                placeholder="MM/AA"
                maxLength={5}
                value={cardForm.expirationDate}
                onChange={e => setCardForm(prev => ({ ...prev, expirationDate: maskCardExpiration(e.target.value) }))}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="card-cvv">CVV *</label>
              <input
                type="text"
                id="card-cvv"
                data-cy="cartao-input-cvv"
                placeholder="123"
                maxLength={4}
                value={cardForm.cvv}
                onChange={e => setCardForm(prev => ({ ...prev, cvv: maskCardCvv(e.target.value) }))}
                required
              />
            </div>
          </div>

          <label className="checkbox-preferred-label" style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#888', cursor: 'pointer', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              data-cy="cartao-checkbox-preferencial"
              checked={cardForm.isPreferred}
              onChange={e => setCardForm(prev => ({ ...prev, isPreferred: e.target.checked }))}
            />
            Definir como cartão preferencial de pagamento
          </label>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-cy="cancelar-cartao"
              onClick={() => {
                setIsCardModalOpen(false);
                setCardModalError(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary" data-cy="salvar-cartao" disabled={isSavingCard}>
              {isSavingCard ? 'SALVANDO...' : 'SALVAR CARTÃO'}
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
        <form onSubmit={handleSaveAddress} className="address-modal-form" data-cy="endereco-form">
          {addrModalError && (
            <div data-cy="endereco-error-banner" style={{
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
                data-cy="endereco-input-nome"
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
                data-cy="endereco-tipo-residencia"
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
                data-cy="endereco-tipo-logradouro"
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
                data-cy="endereco-logradouro"
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
                data-cy="endereco-numero"
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
                data-cy="endereco-complemento"
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
                data-cy="endereco-bairro"
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
                data-cy="endereco-cep"
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
                data-cy="endereco-cidade"
                value={addrForm.city}
                onChange={e => setAddrForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Cidade"
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="m-addr-state">Estado *</label>
              <select
                id="m-addr-state"
                data-cy="endereco-estado"
                value={addrForm.state}
                onChange={e => setAddrForm(prev => ({ ...prev, state: e.target.value }))}
                required
              >
                <option value="">Selecione...</option>
                {BRAZILIAN_STATES.map(uf => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} - {uf.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="m-addr-country">País *</label>
              <input
                type="text"
                id="m-addr-country"
                data-cy="endereco-pais"
                value={addrForm.country}
                onChange={e => setAddrForm(prev => ({ ...prev, country: e.target.value }))}
                placeholder="Brasil"
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="m-addr-obs">Observações (opcional)</label>
              <input
                type="text"
                id="m-addr-obs"
                data-cy="endereco-observacoes"
                value={addrForm.observations}
                onChange={e => setAddrForm(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Ponto de referência, instruções de entrega..."
              />
            </div>
          </div>

          {/* Finalidades do Endereço */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-cy="endereco-residencial"
                checked={addrForm.isResidential}
                onChange={e => setAddrForm(prev => ({ ...prev, isResidential: e.target.checked }))}
              />
              Residencial
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-cy="endereco-entrega"
                checked={addrForm.isDelivery}
                onChange={e => setAddrForm(prev => ({ ...prev, isDelivery: e.target.checked }))}
              />
              Entrega
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-cy="endereco-cobranca"
                checked={addrForm.isBilling}
                onChange={e => setAddrForm(prev => ({ ...prev, isBilling: e.target.checked }))}
              />
              Cobrança
            </label>
          </div>

          <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" data-cy="cancelar-endereco" onClick={() => setIsAddrModalOpen(false)}>CANCELAR</button>
            <button type="submit" className="btn btn-primary" data-cy="salvar-endereco" disabled={isSavingAddr}>
              {isSavingAddr ? 'SALVANDO...' : 'SALVAR ENDEREÇO'}
            </button>
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
        onClose={() => !isSubmittingExchange && setIsExchangeModalOpen(false)}
        title="Solicitar Troca de Produto"
      >
        <form onSubmit={handleConfirmExchangeRequest} className="address-modal-form" data-cy="form-solicitar-troca">
          {exchangeModalError && (
            <div data-cy="exchange-error-banner" style={{
              backgroundColor: 'rgba(255, 69, 69, 0.1)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '0.65rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              ⚠️ {exchangeModalError}
            </div>
          )}

          {isCheckingEligibility && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-primary)' }}>
              Consultando itens elegíveis para troca no servidor...
            </div>
          )}

          {!isCheckingEligibility && selectedOrderForExc && eligibilityData && eligibilityData.podeSolicitarTroca && (
            <>
              <div className="form-group">
                <label className="exchange-group-title">
                  Selecione os itens que deseja trocar:
                </label>
                <div className="exchange-items-selection-list">
                  {eligibilityData.itens.filter(it => it.quantidadeElegivel > 0).map((item, idx) => {
                    const isChecked = selectedExcItems.some(
                      x => x.itemPedidoId === item.itemPedidoId
                    );
                    const selectedItemState = selectedExcItems.find(
                      x => x.itemPedidoId === item.itemPedidoId
                    );
                    const selectedQty = selectedItemState?.quantity || 1;
                    const remainingQty = item.quantidadeElegivel - (isChecked ? selectedQty : 0);

                    const originalOrderItem = selectedOrderForExc.items.find(
                      oi => oi.size === item.tamanho && oi.product.name.toLowerCase().includes(item.nomeProduto.toLowerCase())
                    );
                    const itemImage = originalOrderItem?.product.image || '';

                    return (
                      <div
                        key={`${item.itemPedidoId}-${idx}`}
                        className={`exchange-item-card ${isChecked ? 'selected' : ''}`}
                      >
                        <div className="exchange-item-main-row">
                          <label className="exchange-checkbox-label">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleItemSelection(item)}
                              className="exchange-checkbox"
                              data-cy={`exchange-item-checkbox-${item.itemPedidoId}`}
                            />
                            {itemImage && (
                              <div className="exchange-item-thumb">
                                <img src={itemImage} alt={item.nomeProduto} />
                              </div>
                            )}
                            <div className="exchange-item-info">
                              <span className="exchange-item-name">
                                {item.nomeProduto}
                              </span>
                              <div className="exchange-item-meta-tags">
                                <span className="exchange-tag">Tamanho {item.tamanho}</span>
                                <span className="exchange-tag">Total comprado: {item.quantidadeComprada} un.</span>
                                {item.quantidadeJaEmTroca > 0 && (
                                  <span className="exchange-tag" style={{ color: '#aaa' }}>Já em processo de troca: {item.quantidadeJaEmTroca} un.</span>
                                )}
                                <span className="exchange-tag" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Elegível: {item.quantidadeElegivel} un.</span>
                              </div>
                            </div>
                          </label>

                          <div className="exchange-item-unit-price">
                            <span>
                              {item.precoUnitario.toLocaleString('pt-BR', {
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
                              {item.quantidadeElegivel > 1 ? (
                                <div className="exchange-qty-stepper">
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={selectedQty <= 1}
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.itemPedidoId,
                                        selectedQty - 1,
                                        item.quantidadeElegivel
                                      )
                                    }
                                  >
                                    -
                                  </button>
                                  <span className="qty-value">{selectedQty}</span>
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={selectedQty >= item.quantidadeElegivel}
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.itemPedidoId,
                                        selectedQty + 1,
                                        item.quantidadeElegivel
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                  <span className="qty-max-hint">(Máx: {item.quantidadeElegivel})</span>
                                </div>
                              ) : (
                                <span className="qty-single-tag">1 unidade</span>
                              )}
                            </div>

                            <div className="exchange-item-subtotal-box">
                              <span className="subtotal-label">Subtotal do item:</span>
                              <strong className="subtotal-val">
                                {(item.precoUnitario * selectedQty).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </strong>
                            </div>
                          </div>
                        )}

                        {/* Informação sobre quantidade restante que fica com o cliente */}
                        {isChecked && item.quantidadeElegivel > 1 && (
                          <div className="exchange-item-retention-hint">
                            {remainingQty > 0 ? (
                              <span>
                                ℹ️ <strong>{remainingQty} {remainingQty === 1 ? 'unidade elegível' : 'unidades elegíveis'}</strong> deste item permanecerá(ão) normalmente com você.
                              </span>
                            ) : (
                              <span>ℹ️ Todas as {item.quantidadeElegivel} unidades elegíveis deste item serão trocadas.</span>
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
                        .reduce((sum, req) => sum + req.price * req.quantity, 0)
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
                  data-cy="exchange-reason-input"
                />
              </div>

              <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsExchangeModalOpen(false)}
                  disabled={isSubmittingExchange}
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selectedExcItems.length === 0 || !exchangeReason.trim() || isSubmittingExchange}
                  data-cy="btn-confirmar-solicitar-troca"
                >
                  {isSubmittingExchange ? 'ENVIANDO...' : 'SOLICITAR TROCA'}
                </button>
              </div>
            </>
          )}

          {!isCheckingEligibility && (!eligibilityData || !eligibilityData.podeSolicitarTroca) && (
            <div className="modal-actions" style={{ border: 'none', padding: '0', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsExchangeModalOpen(false)}
              >
                FECHAR
              </button>
            </div>
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

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

