import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/Modal/Modal';
import type { 
  Address, 
  Order, 
  BandeiraDto, 
  CreditCard,
  CalcularFreteRequestDto, 
  CalcularFreteResponseDto,
  CupomResponseDto,
  ValidarPagamentoRequestDto,
  ValidarPagamentoResponseDto,
  NovoCartaoPagamentoDto,
  CriarPedidoRequestDto,
  PedidoResponseDto
} from '../../types';
import { listarBandeiras } from '../../services/clienteService';
import { freteService } from '../../services/freteService';
import { cupomService } from '../../services/cupomService';
import { pagamentoService } from '../../services/pagamentoService';
import { pedidoService } from '../../services/pedidoService';
import { BRAZILIAN_STATES } from '../../data/brazilianStates';
import { getInstallmentOptions, getMaxInstallments } from '../../utils/payment';
import {
  maskCardNumber,
  maskCardExpiration,
  maskCardCvv,
  validateCardNumber,
  validateCardExpiration,
  validateCardCvv,
  maskZipCode,
  validateZipCode
} from '../../utils/maskAndValidate';
import './Checkout.css';

interface CustomCreditCard extends CreditCard {
  isTemporary?: boolean;
  rawNovoCartao?: NovoCartaoPagamentoDto;
}

function parseNumericId(id: string | number | undefined): number | undefined {
  if (id === undefined || id === null) return undefined;
  if (typeof id === 'number') return id > 0 ? id : undefined;
  const cleaned = String(id).replace(/^(card_|addr_)/, '');
  const num = parseInt(cleaned, 10);
  return !isNaN(num) && num > 0 ? num : undefined;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { 
    activeCustomer, 
    cartsByCustomer, 
    clearCart,
    addCustomerAddress,
    updateCustomerAddress,
    addCustomerCard
  } = useApp();

  const cartItems = useMemo(() => {
    return cartsByCustomer[activeCustomer.id] || [];
  }, [cartsByCustomer, activeCustomer.id]);
  
  const [step, setStep] = useState(1); // 1: Endereço, 2: Pagamento, 3: Revisão, 4: Confirmado
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [createdPedidoResponse, setCreatedPedidoResponse] = useState<PedidoResponseDto | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlacementError, setOrderPlacementError] = useState<string | null>(null);

  // Se o carrinho estiver vazio e não houver pedido confirmado, volta para o carrinho
  useEffect(() => {
    if (cartItems.length === 0 && step !== 4) {
      navigate('/carrinho');
    }
  }, [cartItems, step, navigate]);

  // --- STEP 1: ENDEREÇO ---
  const [temporaryAddress, setTemporaryAddress] = useState<Address | null>(null);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState<boolean>(true);

  const availableAddresses = useMemo(() => {
    if (temporaryAddress) {
      const exists = activeCustomer.addresses.some(a => a.id === temporaryAddress.id);
      if (!exists) {
        return [...activeCustomer.addresses, temporaryAddress];
      }
    }
    return activeCustomer.addresses;
  }, [activeCustomer.addresses, temporaryAddress]);

  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    activeCustomer.addresses[0]?.id || ''
  );

  const selectedAddress = useMemo(() => {
    return availableAddresses.find(a => a.id === selectedAddressId) || null;
  }, [availableAddresses, selectedAddressId]);

  // Se o endereço selecionado deixar de existir, limpa e exige seleção explícita do cliente
  useEffect(() => {
    if (selectedAddressId && !availableAddresses.some(a => a.id === selectedAddressId)) {
      setSelectedAddressId(availableAddresses[0]?.id || '');
    }
  }, [availableAddresses, selectedAddressId]);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalError, setAddressModalError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
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

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setSaveAddressToProfile(true);
    setAddressModalError(null);
    setAddressForm({
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
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: Address, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingAddress(addr);
    setSaveAddressToProfile(addr.id !== 'temp-checkout-address');
    setAddressModalError(null);
    setAddressForm({
      label: addr.label.replace(' (Apenas nesta compra)', ''),
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
      isDelivery: addr.isDelivery ?? true,
      isBilling: addr.isBilling ?? true
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressModalError(null);

    if (!addressForm.label.trim() || !addressForm.street.trim() || !addressForm.number.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !(addressForm.country || 'Brasil').trim()) {
      setAddressModalError('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    const zipVal = validateZipCode(addressForm.zipCode);
    if (!zipVal.isValid) {
      setAddressModalError(zipVal.error || 'Informe um CEP válido com 8 dígitos.');
      return;
    }
    
    if (editingAddress) {
      if (editingAddress.id === 'temp-checkout-address') {
        const updatedTemp: Address = {
          ...editingAddress,
          ...addressForm,
          country: 'Brasil',
          state: addressForm.state.toUpperCase().trim(),
          zipCode: maskZipCode(addressForm.zipCode)
        };
        setTemporaryAddress(updatedTemp);
        setSelectedAddressId(updatedTemp.id);
      } else {
        await updateCustomerAddress(activeCustomer.id, {
          ...editingAddress,
          ...addressForm,
          country: 'Brasil',
          zipCode: maskZipCode(addressForm.zipCode)
        });
        setSelectedAddressId(editingAddress.id);
      }
    } else {
      if (saveAddressToProfile) {
        const res = await addCustomerAddress(activeCustomer.id, {
          ...addressForm,
          country: 'Brasil',
          zipCode: maskZipCode(addressForm.zipCode)
        });
        if (res.success && res.address) {
          setSelectedAddressId(res.address.id);
        } else if (res.error) {
          setAddressModalError(res.error);
          return;
        }
      } else {
        const tempAddr: Address = {
          id: 'temp-checkout-address',
          label: addressForm.label || 'Endereço de Entrega',
          residenceType: addressForm.residenceType,
          streetType: addressForm.streetType,
          street: addressForm.street,
          number: addressForm.number,
          complement: addressForm.complement,
          neighborhood: addressForm.neighborhood,
          zipCode: maskZipCode(addressForm.zipCode),
          city: addressForm.city,
          state: addressForm.state.toUpperCase().trim(),
          country: addressForm.country || 'Brasil',
          observations: addressForm.observations,
          isDelivery: true,
          isBilling: false,
          isResidential: false
        };
        setTemporaryAddress(tempAddr);
        setSelectedAddressId(tempAddr.id);
      }
    }
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    
    setAddressForm({
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
  };

  // --- CÁLCULO DE FRETE (STEP 1) ---
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [isCalculatingFrete, setIsCalculatingFrete] = useState<boolean>(false);
  const [freteError, setFreteError] = useState<string | null>(null);
  const [freteDetalhes, setFreteDetalhes] = useState<CalcularFreteResponseDto | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function recalcularFrete() {
      if (!selectedAddress || cartItems.length === 0) {
        setShippingCost(0);
        setFreteError(null);
        setFreteDetalhes(null);
        setIsCalculatingFrete(false);
        return;
      }

      setIsCalculatingFrete(true);
      setFreteError(null);

      const numericAddressId = parseNumericId(selectedAddress.id);

      const request: CalcularFreteRequestDto = {
        codigoCliente: activeCustomer.id,
        enderecoId: numericAddressId,
        estado: selectedAddress.state,
        cep: selectedAddress.zipCode,
        itens: cartItems.map(item => ({
          produtoVariacaoId: item.variacaoId,
          quantidade: item.quantity
        }))
      };

      const result = await freteService.calcularFrete(request);
      if (isCancelled) return;

      if (result.success && result.dados) {
        setShippingCost(Number(result.dados.valorFrete));
        setFreteDetalhes(result.dados);
        setFreteError(null);
      } else {
        setShippingCost(0);
        setFreteDetalhes(null);
        setFreteError(result.error || 'Não foi possível calcular o frete para este endereço.');
      }
      setIsCalculatingFrete(false);
    }

    recalcularFrete();

    return () => {
      isCancelled = true;
    };
  }, [selectedAddress, cartItems, activeCustomer.id]);

  const hasSelectedAddress = !!selectedAddressId;

  // --- STEP 2: CUPONS E FORMAS DE PAGAMENTO ---
  const defaultPromoCoupons: CupomResponseDto[] = useMemo(() => [
    { id: 1, codigo: 'PROMO20', tipo: 'PROMOCIONAL', valor: 20 },
    { id: 2, codigo: 'BEMVINDO50', tipo: 'PROMOCIONAL', valor: 50 }
  ], []);

  const [exchangeCoupons, setExchangeCoupons] = useState<CupomResponseDto[]>([]);
  const [customCoupons, setCustomCoupons] = useState<CupomResponseDto[]>([]);
  const [selectedCouponCodes, setSelectedCouponCodes] = useState<string[]>([]);
  const [manualCouponCode, setManualCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  // Carregar cupons de troca reais do cliente
  useEffect(() => {
    let isCancelled = false;
    async function carregarCuponsTroca() {
      const res = await cupomService.listarCuponsTrocaCliente(activeCustomer.id);
      if (!isCancelled && res.success && res.cupons) {
        setExchangeCoupons(res.cupons);
      }
    }
    carregarCuponsTroca();
    return () => { isCancelled = true; };
  }, [activeCustomer.id]);

  const allAvailableCoupons = useMemo(() => {
    const map = new Map<string, CupomResponseDto>();
    defaultPromoCoupons.forEach(c => map.set(c.codigo, c));
    exchangeCoupons.forEach(c => map.set(c.codigo, c));
    customCoupons.forEach(c => map.set(c.codigo, c));
    return Array.from(map.values());
  }, [defaultPromoCoupons, exchangeCoupons, customCoupons]);

  // Cartões
  const [temporaryCards, setTemporaryCards] = useState<CustomCreditCard[]>([]);
  const [saveCardToProfile, setSaveCardToProfile] = useState<boolean>(true);
  const availableCards: CustomCreditCard[] = useMemo(() => {
    return [...activeCustomer.cards, ...temporaryCards];
  }, [activeCustomer.cards, temporaryCards]);

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardAmounts, setCardAmounts] = useState<Record<string, string>>({});
  const [cardInstallments, setCardInstallments] = useState<Record<string, number>>({});

  // Modal de novo cartão
  const [bandeiras, setBandeiras] = useState<BandeiraDto[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardModalError, setCardModalError] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({
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
        if (res.bandeiras.length > 0) {
          setNewCard(prev => ({
            ...prev,
            bandeiraId: prev.bandeiraId || res.bandeiras![0].id
          }));
        }
      }
    }
    carregarBandeiras();
  }, []);

  const handleAddNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardModalError(null);

    const numVal = validateCardNumber(newCard.cardNumber);
    if (!numVal.isValid) {
      setCardModalError(numVal.error || 'Informe um número de cartão válido.');
      return;
    }

    if (!newCard.holderName.trim()) {
      setCardModalError('O nome impresso no cartão é obrigatório.');
      return;
    }

    const expVal = validateCardExpiration(newCard.expirationDate);
    if (!expVal.isValid) {
      setCardModalError(expVal.error || 'Data de validade inválida.');
      return;
    }

    const cvvVal = validateCardCvv(newCard.cvv);
    if (!cvvVal.isValid) {
      setCardModalError(cvvVal.error || 'Código CVV inválido.');
      return;
    }

    const cleanNum = newCard.cardNumber.replace(/\D/g, '');

    if (!newCard.bandeiraId || newCard.bandeiraId <= 0) {
      setCardModalError('Selecione uma bandeira válida.');
      return;
    }

    const selectedBandeira = bandeiras.find(b => b.id === newCard.bandeiraId);

    if (saveCardToProfile) {
      const res = await addCustomerCard(activeCustomer.id, {
        bandeiraId: newCard.bandeiraId,
        numeroCartao: cleanNum,
        nomeImpresso: newCard.holderName.toUpperCase().trim(),
        dataValidade: newCard.expirationDate.trim(),
        cvv: newCard.cvv.replace(/\D/g, ''),
        preferencial: newCard.isPreferred
      });

      if (res.success && res.card) {
        setSelectedCardIds(prev => [...prev, res.card!.id]);
        setIsCardModalOpen(false);
        setNewCard({
          bandeiraId: bandeiras.length > 0 ? bandeiras[0].id : 1,
          cardNumber: '',
          holderName: '',
          expirationDate: '',
          cvv: '',
          isPreferred: false
        });
      } else {
        setCardModalError(res.error || 'Erro ao cadastrar o cartão.');
      }
    } else {
      const tempId = `temp-card-${Date.now()}`;
      const tempCard: CustomCreditCard = {
        id: tempId,
        brand: selectedBandeira?.nome || 'Cartão',
        lastFour: cleanNum.slice(-4),
        holderName: newCard.holderName.toUpperCase().trim(),
        expirationDate: newCard.expirationDate.trim(),
        isPreferred: false,
        isTemporary: true,
        rawNovoCartao: {
          bandeiraId: newCard.bandeiraId,
          numeroCartao: cleanNum,
          nomeImpresso: newCard.holderName.toUpperCase().trim(),
          dataValidade: newCard.expirationDate.trim(),
          cvv: newCard.cvv.replace(/\D/g, ''),
          salvarNoPerfil: false
        }
      };

      setTemporaryCards(prev => [...prev, tempCard]);
      setSelectedCardIds(prev => [...prev, tempId]);
      setIsCardModalOpen(false);
      setNewCard({
        bandeiraId: bandeiras.length > 0 ? bandeiras[0].id : 1,
        cardNumber: '',
        holderName: '',
        expirationDate: '',
        cvv: '',
        isPreferred: false
      });
    }
  };

  // Reset ao trocar de cliente
  const [prevCustomerId, setPrevCustomerId] = useState(activeCustomer.id);
  if (activeCustomer.id !== prevCustomerId) {
    setPrevCustomerId(activeCustomer.id);
    const newAddrId = activeCustomer.addresses[0]?.id || '';
    setTemporaryAddress(null);
    setSelectedAddressId(newAddrId);
    setSelectedCouponCodes([]);
    setTemporaryCards([]);
    setSelectedCardIds([]);
    setCardAmounts({});
    setCardInstallments({});
  }

  // --- VALIDAÇÃO OFICIAL DE PAGAMENTO COM O BACKEND ---
  const [paymentValidation, setPaymentValidation] = useState<ValidarPagamentoResponseDto | null>(null);
  const [isValidatingPayment, setIsValidatingPayment] = useState<boolean>(false);
  const [paymentValidationError, setPaymentValidationError] = useState<string | null>(null);

  // Valores oficiais (com fallback provisório até resposta do backend)
  const provisionalSubtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const subtotal = paymentValidation?.subtotal ?? provisionalSubtotal;
  const officialFrete = paymentValidation?.valorFrete ?? shippingCost;
  const valorTotal = paymentValidation?.valorTotal ?? (subtotal + officialFrete);

  const provisionalSumCoupons = allAvailableCoupons
    .filter(c => selectedCouponCodes.includes(c.codigo))
    .reduce((sum, c) => sum + c.valor, 0);

  const totalPagoCupons = paymentValidation?.totalPagoCupons ?? Math.min(valorTotal, provisionalSumCoupons);
  const saldoRestante = paymentValidation?.saldoRestante ?? Math.max(0, valorTotal - provisionalSumCoupons);
  const valorExcedenteCupons = paymentValidation?.valorExcedenteCupons ?? Math.max(0, provisionalSumCoupons - valorTotal);

  // Sincronizar autofill do cartão quando o saldo restante mudar
  const [prevCardIds, setPrevCardIds] = useState(selectedCardIds);
  const [prevSaldoRestante, setPrevSaldoRestante] = useState(saldoRestante);

  if (selectedCardIds !== prevCardIds || saldoRestante !== prevSaldoRestante) {
    setPrevCardIds(selectedCardIds);
    setPrevSaldoRestante(saldoRestante);
    if (selectedCardIds.length === 0 || saldoRestante === 0) {
      setCardAmounts({});
    } else if (selectedCardIds.length === 1) {
      setCardAmounts({
        [selectedCardIds[0]]: saldoRestante.toFixed(2)
      });
    }
  }

  // Efeito de validação contínua e determinística no backend
  useEffect(() => {
    if (step !== 2 || !selectedAddress || cartItems.length === 0) return;

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      const numericAddressId = parseNumericId(selectedAddress.id);

      const effectiveCardAmounts = { ...cardAmounts };
      if (selectedCardIds.length === 1 && !effectiveCardAmounts[selectedCardIds[0]] && saldoRestante > 0) {
        effectiveCardAmounts[selectedCardIds[0]] = saldoRestante.toFixed(2);
      }

      const cartoesComValor = selectedCardIds
        .filter(id => (parseFloat(effectiveCardAmounts[id]) || 0) > 0)
        .map(id => {
          const card = availableCards.find(c => c.id === id);
          const amount = parseFloat(effectiveCardAmounts[id]) || 0;
          const isTemp = card?.isTemporary || card?.id.startsWith('temp-');
          const numericCardId = parseNumericId(card?.id);
          return {
            cartaoId: isTemp ? undefined : numericCardId,
            cartaoNovo: isTemp ? card?.rawNovoCartao : undefined,
            valor: amount
          };
        });

      const request: ValidarPagamentoRequestDto = {
        codigoCliente: activeCustomer.id,
        itens: cartItems.map(item => ({
          produtoVariacaoId: item.variacaoId,
          quantidade: item.quantity
        })),
        enderecoId: numericAddressId,
        estado: selectedAddress.state,
        cep: selectedAddress.zipCode,
        cupons: selectedCouponCodes,
        cartoes: cartoesComValor
      };

      setIsValidatingPayment(true);
      const res = await pagamentoService.validarPagamento(request);
      if (isCancelled) return;
      setIsValidatingPayment(false);

      if (res.success && res.dados) {
        setPaymentValidation(res.dados);
        setPaymentValidationError(null);
      } else {
        setPaymentValidation(null);
        setPaymentValidationError(res.error || 'Erro na composição do pagamento.');
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    step,
    selectedAddress,
    cartItems,
    activeCustomer.id,
    selectedCouponCodes,
    selectedCardIds,
    cardAmounts,
    availableCards
  ]);

  const handleCardToggle = (cardId: string) => {
    setSelectedCardIds(prev => {
      let updated;
      if (prev.includes(cardId)) {
        updated = prev.filter(id => id !== cardId);
        setCardInstallments(instPrev => {
          const next = { ...instPrev };
          delete next[cardId];
          return next;
        });
      } else {
        updated = [...prev, cardId];
      }
      return updated;
    });
  };

  const handleCardInstallmentsChange = (cardId: string, inst: number) => {
    setCardInstallments(prev => ({
      ...prev,
      [cardId]: inst
    }));
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
    const rest = Math.max(0, saldoRestante - sumOthers);
    setCardAmounts(prev => ({
      ...prev,
      [cardId]: rest.toFixed(2)
    }));
  };

  const distributeEqually = () => {
    if (selectedCardIds.length === 0) return;
    const splitVal = (saldoRestante / selectedCardIds.length).toFixed(2);
    const newAmounts: Record<string, string> = {};
    selectedCardIds.forEach(id => {
      newAmounts[id] = splitVal;
    });
    const diff = saldoRestante - (parseFloat(splitVal) * selectedCardIds.length);
    if (diff !== 0 && selectedCardIds.length > 0) {
      const lastId = selectedCardIds[selectedCardIds.length - 1];
      newAmounts[lastId] = (parseFloat(splitVal) + diff).toFixed(2);
    }
    setCardAmounts(newAmounts);
  };

  const handleCouponToggle = (codigo: string) => {
    setCouponError(null);
    setCouponSuccess(null);
    setSelectedCouponCodes(prev => {
      if (prev.includes(codigo)) {
        return prev.filter(c => c !== codigo);
      } else {
        return [...prev, codigo];
      }
    });
  };

  const handleApplyManualCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCouponCode.trim().toUpperCase();
    if (!code) return;

    setCouponError(null);
    setCouponSuccess(null);

    if (selectedCouponCodes.includes(code)) {
      setCouponError(`O cupom '${code}' já está selecionado.`);
      return;
    }

    setIsCheckingCoupon(true);
    const res = await cupomService.consultarCupom(code, activeCustomer.id);
    setIsCheckingCoupon(false);

    if (res.success && res.cupom) {
      const c = res.cupom;
      setCustomCoupons(prev => {
        const exists = prev.some(x => x.codigo === c.codigo);
        return exists ? prev : [...prev, c];
      });
      setSelectedCouponCodes(prev => [...prev, c.codigo]);
      setManualCouponCode('');
      setCouponSuccess(`Cupom '${c.codigo}' aplicado com sucesso!`);
    } else {
      setCouponError(res.error || 'Cupom inválido ou não disponível.');
    }
  };

  const cardAmountsSum = selectedCardIds.reduce((sum, id) => sum + (parseFloat(cardAmounts[id]) || 0), 0);

  const handleGoToReview = async () => {
    setPaymentValidationError(null);
    setIsValidatingPayment(true);

    const numericAddressId = parseNumericId(selectedAddress?.id);

    const effectiveCardAmounts = { ...cardAmounts };
    if (selectedCardIds.length === 1 && !effectiveCardAmounts[selectedCardIds[0]] && saldoRestante > 0) {
      effectiveCardAmounts[selectedCardIds[0]] = saldoRestante.toFixed(2);
    }

    const cartoesComValor = selectedCardIds
      .filter(id => (parseFloat(effectiveCardAmounts[id]) || 0) > 0)
      .map(id => {
        const card = availableCards.find(c => c.id === id);
        const amount = parseFloat(effectiveCardAmounts[id]) || 0;
        const isTemp = card?.isTemporary || card?.id.startsWith('temp-');
        const numericCardId = parseNumericId(card?.id);
        return {
          cartaoId: isTemp ? undefined : numericCardId,
          cartaoNovo: isTemp ? card?.rawNovoCartao : undefined,
          valor: amount
        };
      });

    const request: ValidarPagamentoRequestDto = {
      codigoCliente: activeCustomer.id,
      itens: cartItems.map(item => ({
        produtoVariacaoId: item.variacaoId,
        quantidade: item.quantity
      })),
      enderecoId: numericAddressId,
      estado: selectedAddress?.state,
      cep: selectedAddress?.zipCode,
      cupons: selectedCouponCodes,
      cartoes: cartoesComValor
    };

    const res = await pagamentoService.validarPagamento(request);
    setIsValidatingPayment(false);

    if (res.success && res.dados && res.dados.valido) {
      setPaymentValidation(res.dados);
      setPaymentValidationError(null);
      setStep(3);
    } else {
      setPaymentValidation(null);
      setPaymentValidationError(res.error || 'Erro na composição do pagamento.');
    }
  };

  // --- STEP 3: REVISÃO E CONFIRMAÇÃO ---
  const handleConfirmOrder = async () => {
    const address = availableAddresses.find(a => a.id === selectedAddressId) || temporaryAddress;
    if (!address || !paymentValidation) return;

    const numericAddressId = parseNumericId(address.id);

    const effectiveCardAmounts = { ...cardAmounts };
    if (selectedCardIds.length === 1 && !effectiveCardAmounts[selectedCardIds[0]] && saldoRestante > 0) {
      effectiveCardAmounts[selectedCardIds[0]] = saldoRestante.toFixed(2);
    }

    const cardsForPayment = saldoRestante === 0 
      ? [] 
      : selectedCardIds
          .filter(id => (parseFloat(effectiveCardAmounts[id]) || 0) > 0)
          .map(id => {
            const card = availableCards.find(c => c.id === id);
            const amount = parseFloat(effectiveCardAmounts[id]) || 0;
            const isTemp = card?.isTemporary || card?.id.startsWith('temp-');
            const numericCardId = parseNumericId(card?.id);
            return {
              cartaoId: isTemp ? undefined : numericCardId,
              cartaoNovo: isTemp ? card?.rawNovoCartao : undefined,
              valor: amount
            };
          });

    const request: CriarPedidoRequestDto = {
      codigoCliente: activeCustomer.id,
      itens: cartItems.map(item => ({
        produtoVariacaoId: item.variacaoId,
        quantidade: item.quantity
      })),
      enderecoId: numericAddressId,
      enderecoAvulso: !numericAddressId ? {
        tipoResidencia: address.residenceType || 'Casa',
        tipoLogradouro: address.streetType || 'Rua',
        logradouro: address.street,
        numero: address.number,
        complemento: address.complement,
        bairro: address.neighborhood,
        cep: address.zipCode,
        cidade: address.city,
        estado: address.state,
        pais: address.country || 'Brasil',
        observacoes: address.observations,
        salvarNoPerfil: !!address.saveToProfile
      } : undefined,
      cupons: selectedCouponCodes,
      cartoes: cardsForPayment
    };

    setIsPlacingOrder(true);
    setOrderPlacementError(null);

    const res = await pedidoService.criarPedido(request);
    setIsPlacingOrder(false);

    if (res.success && res.dados) {
      setCreatedPedidoResponse(res.dados);

      // Limpeza do carrinho SOMENTE após confirmação bem-sucedida do backend
      clearCart(activeCustomer.id);

      const order: Order = {
        id: res.dados.codigo,
        date: new Date(res.dados.dataPedido).toLocaleDateString('pt-BR'),
        customerId: activeCustomer.id,
        status: 'EM PROCESSAMENTO',
        items: [...cartItems],
        shippingAddress: { ...address },
        paymentMethods: cardsForPayment.map(c => ({
          cardId: String(c.cartaoId || 'novo'),
          amount: c.valor,
          installments: 1
        })),
        couponsUsed: paymentValidation.cuponsUtilizados.map(c => ({
          id: `cupom_${c.codigo}`,
          code: c.codigo,
          type: c.tipo === 'PROMOCIONAL' ? 'promo' : 'exchange',
          value: c.valorUtilizado,
          description: `Cupom ${c.tipo.toLowerCase()} ${c.codigo}`,
          expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          customerId: activeCustomer.id
        })),
        subtotal: res.dados.subtotal,
        shippingCost: res.dados.valorFrete,
        discountPromo: paymentValidation.cuponsUtilizados.filter(c => c.tipo === 'PROMOCIONAL').reduce((s, c) => s + c.valorUtilizado, 0),
        discountExchange: paymentValidation.cuponsUtilizados.filter(c => c.tipo === 'TROCA').reduce((s, c) => s + c.valorUtilizado, 0),
        discount: paymentValidation.totalPagoCupons,
        total: res.dados.valorTotal
      };

      setCreatedOrder(order);
      setStep(4);
    } else {
      setOrderPlacementError(res.error || 'Erro ao processar e finalizar o pedido no servidor.');
    }
  };

  const selectedAddressObj = availableAddresses.find(a => a.id === selectedAddressId);

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        
        {/* Passos do Checkout (Passos 1, 2, 3 visíveis) */}
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
          <div className="checkout-step-content" data-cy="checkout-step-1">
            <h3 className="step-title">Selecione o Endereço de Entrega</h3>
            
            <div className="addresses-list" data-cy="checkout-addresses-list">
              {availableAddresses.map(addr => {
                const isTemp = addr.id === 'temp-checkout-address';

                return (
                  <label 
                    key={addr.id} 
                    className={`address-label-card ${selectedAddressId === addr.id ? 'selected' : ''}`}
                    data-cy={`address-label-card-${addr.id}`}
                  >
                    <input
                      type="radio"
                      name="checkout-address"
                      value={addr.id}
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="address-radio-input"
                      data-cy={`select-address-${addr.id}`}
                    />
                    <div className="address-card-info" style={{ width: '100%' }}>
                      <div className="addr-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <div className="addr-tag">{addr.label}</div>
                          {isTemp ? (
                            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.05rem 0.35rem', borderRadius: '3px', border: '1px solid #eab308' }}>
                              Apenas nesta compra
                            </span>
                          ) : addr.isDelivery ? (
                            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(67, 185, 86, 0.15)', color: 'var(--color-success)', padding: '0.05rem 0.3rem', borderRadius: '3px', border: '1px solid var(--color-success)' }}>
                              Entrega
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditAddress(addr, e)}
                          className="btn-edit-link"
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline', padding: '0 0.25rem' }}
                        >
                          Editar
                        </button>
                      </div>
                      <p className="addr-street">
                        {addr.streetType ? `${addr.streetType} ` : ''}{addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`} ({addr.residenceType || 'Residencial'})
                      </p>
                      <p className="addr-loc">{addr.neighborhood} - {addr.city} / {addr.state}</p>
                      <p className="addr-cep">CEP {addr.zipCode}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="address-actions">
              <button 
                onClick={handleOpenAddAddress} 
                className="btn btn-secondary add-addr-btn"
                type="button"
                data-cy="btn-add-new-address"
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
                    : isCalculatingFrete
                      ? 'Calculando frete...'
                      : freteError
                        ? 'Erro no cálculo'
                        : shippingCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  }
                </span>
              </div>
              {freteError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.25rem', textAlign: 'right' }}>
                  {freteError}
                </div>
              )}
              {freteDetalhes && !freteError && !isCalculatingFrete && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem', marginTop: '0.15rem', textAlign: 'right' }}>
                  Região {freteDetalhes.regiao} ({freteDetalhes.estado}) • {freteDetalhes.quantidadeItens} {freteDetalhes.quantidadeItens === 1 ? 'par' : 'pares'}
                </div>
              )}
              <div className="calc-divider"></div>
              <div className="calc-row total-row">
                <span>Total Provisório</span>
                <span>{(hasSelectedAddress && !freteError && !isCalculatingFrete ? subtotal + shippingCost : subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <div className="step-footer">
              <Link to="/carrinho" className="btn btn-secondary">Voltar ao Carrinho</Link>
              <button 
                onClick={() => setStep(2)} 
                disabled={!selectedAddressId || isCalculatingFrete || !!freteError || shippingCost <= 0}
                className="btn btn-primary"
                type="button"
                data-cy="btn-go-to-payment"
              >
                {isCalculatingFrete ? 'Calculando...' : 'Ir para o Pagamento'}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PAGAMENTO ================= */}
        {step === 2 && (
          <div className="checkout-step-content" data-cy="checkout-step-2">
            <h3 className="step-title">Forma de Pagamento e Cupons</h3>

            <div className="payment-layout">
              <div className="payment-inputs">
                
                {/* Cupons */}
                <div className="payment-section">
                  <h4 className="section-subtitle">Cupons Disponíveis</h4>
                  
                  {allAvailableCoupons.length > 0 ? (
                    <div className="coupons-checkout-list" data-cy="coupons-checkout-list">
                      {allAvailableCoupons.map(c => {
                        const isSelected = selectedCouponCodes.includes(c.codigo);
                        const isPromo = c.tipo === 'PROMOCIONAL';
                        return (
                          <label key={c.codigo} className={`coupon-checkout-row ${isSelected ? 'selected' : ''}`} data-cy={`coupon-row-${c.codigo}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleCouponToggle(c.codigo)}
                              data-cy={`chk-coupon-${c.codigo}`}
                            />
                            <div className="coupon-checkout-details" style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span className="cp-code">{c.codigo}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '3px',
                                    backgroundColor: isPromo ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: isPromo ? '#60a5fa' : '#34d399',
                                    border: `1px solid ${isPromo ? '#3b82f6' : '#10b981'}`
                                  }}>
                                    {isPromo ? 'Promocional' : 'Troca'}
                                  </span>
                                </div>
                                <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                                  {c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </strong>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-coupons-text">Nenhum cupom disponível no momento.</p>
                  )}

                  {/* Adicionar cupom por código */}
                  <form onSubmit={handleApplyManualCoupon} style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="CÓDIGO DO CUPOM"
                      value={manualCouponCode}
                      onChange={e => setManualCouponCode(e.target.value.toUpperCase())}
                      data-cy="input-coupon-code"
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.75rem',
                        backgroundColor: '#111',
                        border: '1px solid #333',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '0.82rem',
                        textTransform: 'uppercase'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!manualCouponCode.trim() || isCheckingCoupon}
                      className="btn btn-secondary btn-small"
                      data-cy="btn-apply-coupon"
                      style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem', whiteSpace: 'nowrap' }}
                    >
                      {isCheckingCoupon ? 'Verificando...' : 'APLICAR'}
                    </button>
                  </form>

                  {couponError && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.4rem' }} data-cy="coupon-error-message">
                      ⚠️ {couponError}
                    </div>
                  )}
                  {couponSuccess && (
                    <div style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '0.4rem' }} data-cy="coupon-success-message">
                      ✓ {couponSuccess}
                    </div>
                  )}
                </div>

                {/* Cartões de Crédito */}
                <div className="payment-section">
                  <div className="cards-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 className="section-subtitle" style={{ margin: 0 }}>Cartões de Crédito</h4>
                    <button 
                      type="button" 
                      onClick={() => {
                        setCardModalError(null);
                        setSaveCardToProfile(true);
                        setNewCard({
                          bandeiraId: bandeiras.length > 0 ? bandeiras[0].id : 1,
                          cardNumber: '',
                          holderName: '',
                          expirationDate: '',
                          cvv: '',
                          isPreferred: false
                        });
                        setIsCardModalOpen(true);
                      }}
                      className="btn btn-secondary btn-small"
                      data-cy="btn-add-new-card"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      + ADICIONAR NOVO CARTÃO
                    </button>
                  </div>

                  {saldoRestante === 0 ? (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px', color: '#34d399', fontSize: '0.85rem' }} data-cy="zero-cards-needed-msg">
                      ✓ Compra 100% coberta pelos cupons aplicados. Não é necessário cartão de crédito.
                    </div>
                  ) : (
                    <>
                      <p className="card-instructions">
                        Selecione um ou mais cartões para cobrir o saldo restante de <strong>{saldoRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
                      </p>

                      <div className="cards-checkout-list" data-cy="checkout-cards-list">
                        {availableCards.map(card => {
                          const isSelected = selectedCardIds.includes(card.id);
                          const cardAmountVal = parseFloat(cardAmounts[card.id]) || (selectedCardIds.length === 1 ? saldoRestante : 0);
                          const installmentOptions = getInstallmentOptions(cardAmountVal);
                          const currentInstallment = Math.min(cardInstallments[card.id] || 1, getMaxInstallments(cardAmountVal));
                          const isTemp = card.isTemporary || card.id.startsWith('temp-');

                          return (
                            <div key={card.id} className={`card-checkout-row ${isSelected ? 'selected' : ''}`} data-cy={`card-checkout-row-${card.id}`}>
                              <label className="card-selector-label">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleCardToggle(card.id)}
                                  data-cy={`chk-card-${card.id}`}
                                />
                                <div className="card-icon-info">
                                  <span className="card-brand-tag">{card.brand}</span>
                                  <span className="card-number-tag">final {card.lastFour}</span>
                                  {isTemp ? (
                                    <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.05rem 0.35rem', borderRadius: '3px', border: '1px solid #eab308' }}>
                                      Apenas nesta compra
                                    </span>
                                  ) : card.isPreferred ? (
                                    <span className="pref-badge">Pref</span>
                                  ) : null}
                                </div>
                              </label>

                              {isSelected && (
                                <div className="card-controls-wrapper">
                                  {selectedCardIds.length > 1 && (
                                    <div className="card-split-input">
                                      <span className="currency-prefix">R$</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={cardAmounts[card.id] || ''}
                                        onChange={(e) => handleCardAmountChange(card.id, e.target.value)}
                                        className="card-amount-field"
                                        data-cy={`input-card-amount-${card.id}`}
                                      />
                                      <button 
                                        type="button" 
                                        onClick={() => autofillRemaining(card.id)}
                                        className="btn-use-rest"
                                        data-cy={`btn-use-rest-${card.id}`}
                                      >
                                        Usar Restante
                                      </button>
                                    </div>
                                  )}

                                  <div className="card-installments-row">
                                    <label className="installments-label" htmlFor={`installments-${card.id}`}>Parcelas:</label>
                                    <select
                                      id={`installments-${card.id}`}
                                      value={currentInstallment}
                                      onChange={(e) => handleCardInstallmentsChange(card.id, parseInt(e.target.value, 10))}
                                      className="card-installments-select"
                                      disabled={cardAmountVal <= 0}
                                      data-cy={`select-installments-${card.id}`}
                                    >
                                      {installmentOptions.map(opt => (
                                        <option key={opt.count} value={opt.count}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
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
                            data-cy="btn-distribute-equally"
                          >
                            DISTRIBUIR IGUALMENTE
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Sidebar de Resumo Financeiro */}
              <div className="payment-calc-sidebar">
                <div className="calc-card">
                  <h4 className="calc-title">Resumo Financeiro</h4>
                  
                  <div className="calc-row">
                    <span>Produtos (Subtotal)</span>
                    <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  
                  <div className="calc-row">
                    <span>Frete</span>
                    <span>{officialFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  <div className="calc-divider"></div>

                  <div className="calc-row total-row">
                    <span>Valor Total</span>
                    <span>{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  {totalPagoCupons > 0 && (
                    <div className="calc-row discount-row">
                      <span>Cupons Utilizados</span>
                      <span>-{totalPagoCupons.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}

                  {valorExcedenteCupons > 0 && (
                    <div className="calc-row discount-row" style={{ color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                      <span>Prévia Novo Cupom</span>
                      <span>+{valorExcedenteCupons.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}

                  <div className="calc-divider"></div>

                  <div className="calc-row total-row">
                    <span>Saldo a Pagar</span>
                    <span data-cy="checkout-remaining-balance">{saldoRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  <div className="calc-divider"></div>

                  {/* Informações de Distribuição */}
                  {saldoRestante === 0 && !paymentValidationError ? (
                    <div className="payment-distribution-info">
                      <div className="dist-row">
                        <span>Forma de Pagamento:</span>
                        <span className="text-success">Cupons (100%)</span>
                      </div>
                      {valorExcedenteCupons > 0 && (
                        <div className="dist-row" style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          <span>Novo cupom gerado após compra:</span>
                          <strong style={{ color: 'var(--color-primary)' }}>{valorExcedenteCupons.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="payment-distribution-info">
                      <div className="dist-row">
                        <span>Valor Pago nos Cartões:</span>
                        <span className={paymentValidation?.valido ? 'text-success' : 'text-danger'}>
                          {cardAmountsSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      {(!paymentValidation?.valido || paymentValidationError) && (
                        <div className="dist-warning" data-cy="payment-validation-warning">
                          {paymentValidationError ? (
                            <span>{paymentValidationError}</span>
                          ) : selectedCardIds.length === 0 ? (
                            <span>Selecione ao menos um cartão para pagar o restante.</span>
                          ) : cardAmountsSum < saldoRestante ? (
                            <span>Falta distribuir: <strong>{(saldoRestante - cardAmountsSum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                          ) : (
                            <span>Excedeu: <strong>{(cardAmountsSum - saldoRestante).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
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
                onClick={handleGoToReview} 
                disabled={isValidatingPayment || !paymentValidation?.valido}
                className="btn btn-primary"
                type="button"
                data-cy="btn-go-to-review"
              >
                {isValidatingPayment ? 'Validando...' : 'Revisar Pedido'}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: REVISÃO ================= */}
        {step === 3 && paymentValidation && (
          <div className="checkout-step-content" data-cy="checkout-step-3">
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
                    {paymentValidation.cuponsUtilizados.map(cupom => (
                      <div key={cupom.codigo} className="review-pay-item">
                        <span>
                          Cupom {cupom.tipo === 'PROMOCIONAL' ? 'Promocional' : 'de Troca'} <strong>{cupom.codigo}</strong>
                        </span>
                        <span><strong>-{cupom.valorUtilizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                      </div>
                    ))}

                    {paymentValidation.saldoRestante === 0 && paymentValidation.cartoesUtilizados.length === 0 ? (
                      <div className="review-pay-item">
                        <span>Cobrança em Cartão de Crédito</span>
                        <span className="text-success"><strong>R$ 0,00 (Pago integralmente por cupom)</strong></span>
                      </div>
                    ) : (
                      paymentValidation.cartoesUtilizados.map((c, idx) => {
                        const localCard = availableCards.find(x => x.id === (c.cartaoId ? String(c.cartaoId) : undefined)) 
                          || availableCards.find(x => x.lastFour === c.ultimosDigitos);
                        const cardIdKey = localCard?.id || String(idx);
                        const maxInst = getMaxInstallments(c.valor);
                        const inst = Math.min(cardInstallments[cardIdKey] || 1, maxInst);

                        return (
                          <div key={cardIdKey} className="review-pay-item">
                            <div>
                              <span>Cartão <strong>{c.bandeira}</strong> (final {c.ultimosDigitos})</span>
                              {c.salvarNoPerfil === false && !c.cartaoId && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.05rem 0.35rem', borderRadius: '3px', border: '1px solid #eab308' }}>
                                  Apenas nesta compra
                                </span>
                              )}
                              <div className="review-pay-subtext">
                                {inst === 1
                                  ? '1x à vista'
                                  : `${inst}x de ${(c.valor / inst).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`}
                              </div>
                            </div>
                            <span><strong>{c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                          </div>
                        );
                      })
                    )}

                    {paymentValidation.novoCupomTroca && (
                      <div className="review-pay-item" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#60a5fa', fontWeight: 600 }}>Prévia de Novo Cupom de Troca a Gerar</span>
                          <div style={{ fontSize: '0.75rem', color: '#ccc', marginTop: '0.15rem' }}>
                            {paymentValidation.novoCupomTroca.mensagem}
                          </div>
                        </div>
                        <strong style={{ color: '#60a5fa' }}>
                          +{paymentValidation.novoCupomTroca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
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
                    <span>{paymentValidation.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="calc-row">
                    <span>Frete</span>
                    <span>{paymentValidation.valorFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="calc-divider"></div>
                  <div className="calc-row total-row">
                    <span>Valor Total</span>
                    <span data-cy="review-total-value">{paymentValidation.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  {paymentValidation.totalPagoCupons > 0 && (
                    <div className="calc-row discount-row">
                      <span>Cupons Utilizados</span>
                      <span>-{paymentValidation.totalPagoCupons.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}
                  {paymentValidation.totalPagoCartoes > 0 && (
                    <div className="calc-row">
                      <span>Cartão de Crédito</span>
                      <span>{paymentValidation.totalPagoCartoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}
                  {paymentValidation.valorExcedenteCupons > 0 && (
                    <div className="calc-row discount-row" style={{ color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                      <span>Saldo Excedente de Troca</span>
                      <span>+{paymentValidation.valorExcedenteCupons.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  )}
                  <div className="calc-divider"></div>
                  <div className="calc-row total-row">
                    <span>Total Quitado</span>
                    <span>{(paymentValidation.totalPagoCupons + paymentValidation.totalPagoCartoes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>
            </div>

            {orderPlacementError && (
              <div style={{
                margin: '1.25rem 0 0.5rem 0',
                padding: '0.8rem 1rem',
                backgroundColor: 'rgba(255, 69, 69, 0.12)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                textAlign: 'left'
              }}>
                ⚠️ {orderPlacementError}
              </div>
            )}

            <div className="step-footer">
              <button 
                onClick={() => setStep(2)} 
                className="btn btn-secondary" 
                type="button" 
                disabled={isPlacingOrder}
              >
                Voltar
              </button>
              <button 
                onClick={handleConfirmOrder} 
                className="btn btn-primary btn-confirm-order"
                type="button"
                disabled={isPlacingOrder}
                data-cy="btn-confirm-order"
              >
                {isPlacingOrder ? 'PROCESSANDO PEDIDO...' : 'CONFIRMAR PEDIDO'}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: CONFIRMADO ================= */}
        {step === 4 && createdOrder && (
          <div className="order-confirmed-screen" data-cy="order-confirmed-screen">
            <div className="success-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            
            <h2 className="confirmed-title">PEDIDO CONFIRMADO!</h2>
            <p className="confirmed-desc">Seu pedido foi registrado no sistema e está em processamento.</p>

            <div className="confirmed-details-card">
              <div className="conf-detail-row">
                <span>Número do Pedido</span>
                <strong className="neon-text" data-cy="confirmed-order-code">{createdOrder.id}</strong>
              </div>
              <div className="conf-detail-row">
                <span>Status</span>
                <span className="status-badge-open" style={{ backgroundColor: 'rgba(57, 255, 20, 0.15)', color: 'var(--color-primary)' }} data-cy="confirmed-order-status">{createdOrder.status}</span>
              </div>
              <div className="conf-detail-row">
                <span>Total Pago</span>
                <strong data-cy="confirmed-order-total">{createdOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>

              {/* Endereço de Entrega Snapshot */}
              {createdPedidoResponse?.enderecoEntrega && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #222', textAlign: 'left', fontSize: '0.82rem', color: '#ccc' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.35rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Endereço de Entrega
                  </div>
                  <div>
                    {createdPedidoResponse.enderecoEntrega.tipoLogradouro} {createdPedidoResponse.enderecoEntrega.logradouro}, {createdPedidoResponse.enderecoEntrega.numero}
                    {createdPedidoResponse.enderecoEntrega.complemento ? ` - ${createdPedidoResponse.enderecoEntrega.complemento}` : ''}
                  </div>
                  <div>
                    {createdPedidoResponse.enderecoEntrega.bairro} - {createdPedidoResponse.enderecoEntrega.cidade}/{createdPedidoResponse.enderecoEntrega.estado} - CEP {createdPedidoResponse.enderecoEntrega.cep}
                  </div>
                </div>
              )}

              {/* Pagamento em Cartões */}
              {createdOrder.paymentMethods.length > 0 && (
                <div className="conf-detail-payments" style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #222' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.35rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>
                    Pagamento nos Cartões
                  </div>
                  {createdOrder.paymentMethods.map(pm => {
                    const card = availableCards.find(c => c.id === pm.cardId);
                    const inst = pm.installments ?? 1;
                    return (
                      <div key={pm.cardId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '0.25rem', color: '#ccc' }}>
                        <span>💳 {card ? `${card.brand} (final ${card.lastFour})` : `Cartão final ${pm.cardId.slice(-4)}`} ({inst === 1 ? '1x à vista' : `${inst}x de ${(pm.amount / inst).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`})</span>
                        <strong style={{ color: '#fff' }}>{pm.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Banner de Cupom de Troca Gerado por Excedente */}
              {createdPedidoResponse?.novoCupomTroca && (
                <div style={{
                  marginTop: '0.85rem',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(57, 255, 20, 0.08)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: '8px',
                  textAlign: 'left'
                }} data-cy="surplus-coupon-banner">
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🎁 Novo Cupom de Troca Gerado
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem', fontFamily: 'monospace' }} data-cy="surplus-coupon-code">
                    {createdPedidoResponse.novoCupomTroca.codigo}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#ccc', marginTop: '0.2rem' }}>
                    Crédito disponível: <strong style={{ color: 'var(--color-primary)' }} data-cy="surplus-coupon-value">{createdPedidoResponse.novoCupomTroca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    {createdPedidoResponse.novoCupomTroca.mensagem}
                  </div>
                </div>
              )}
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
          setAddressModalError(null);
          setEditingAddress(null);
        }}
        title={editingAddress ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
      >
        <form onSubmit={handleSaveAddress} className="address-modal-form">
          {addressModalError && (
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
              ⚠️ {addressModalError}
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="addr-label">Identificação (ex: Casa, Trabalho)</label>
              <input
                type="text"
                id="addr-label"
                value={addressForm.label}
                onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="ex: Minha Casa"
                data-cy="input-addr-label"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-res-type">Tipo de Residência *</label>
              <select
                id="addr-res-type"
                value={addressForm.residenceType}
                onChange={(e) => setAddressForm(prev => ({ ...prev, residenceType: e.target.value }))}
                data-cy="select-addr-residence-type"
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
              <label htmlFor="addr-street-type">Tipo de Logradouro *</label>
              <select
                id="addr-street-type"
                value={addressForm.streetType}
                onChange={(e) => setAddressForm(prev => ({ ...prev, streetType: e.target.value }))}
                data-cy="select-addr-street-type"
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
              <label htmlFor="addr-street">Logradouro *</label>
              <input
                type="text"
                id="addr-street"
                value={addressForm.street}
                onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                placeholder="Rua, Avenida..."
                data-cy="input-addr-street"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-number">Número *</label>
              <input
                type="text"
                id="addr-number"
                value={addressForm.number}
                onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                placeholder="123"
                data-cy="input-addr-number"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="addr-comp">Complemento</label>
              <input
                type="text"
                id="addr-comp"
                value={addressForm.complement}
                onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                placeholder="Apto, Bloco..."
                data-cy="input-addr-complement"
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-neighborhood">Bairro *</label>
              <input
                type="text"
                id="addr-neighborhood"
                value={addressForm.neighborhood}
                onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                placeholder="Jardim..."
                data-cy="input-addr-neighborhood"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="addr-zip">CEP *</label>
              <input
                type="text"
                id="addr-zip"
                value={addressForm.zipCode}
                onChange={(e) => setAddressForm(prev => ({ ...prev, zipCode: maskZipCode(e.target.value) }))}
                placeholder="00000-000"
                maxLength={9}
                data-cy="input-addr-zip"
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="addr-city">Cidade *</label>
              <input
                type="text"
                id="addr-city"
                value={addressForm.city}
                onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                data-cy="input-addr-city"
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="addr-state">Estado *</label>
              <select
                id="addr-state"
                value={addressForm.state}
                onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                data-cy="select-addr-state"
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
              <label htmlFor="addr-country">País *</label>
              <input
                type="text"
                id="addr-country"
                name="country"
                value={addressForm.country || 'Brasil'}
                readOnly
                data-cy="input-addr-country"
                title="Decisão de implementação RunWay: entregas restritas ao Brasil"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed', color: 'var(--color-text-secondary)' }}
                required
              />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="addr-observations">Observações</label>
              <input
                type="text"
                id="addr-observations"
                value={addressForm.observations || ''}
                onChange={(e) => setAddressForm(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Ponto de referência, instruções de entrega..."
                data-cy="input-addr-observations"
              />
            </div>
          </div>

          {/* Finalidades do Endereço */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addressForm.isDelivery}
                onChange={e => setAddressForm(prev => ({ ...prev, isDelivery: e.target.checked }))}
              />
              Endereço de entrega
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addressForm.isBilling}
                onChange={e => setAddressForm(prev => ({ ...prev, isBilling: e.target.checked }))}
              />
              Endereço de cobrança
            </label>
          </div>

          {!editingAddress && (
            <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#ffffff', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={saveAddressToProfile}
                  onChange={e => setSaveAddressToProfile(e.target.checked)}
                  data-cy="chk-save-address-to-profile"
                />
                Salvar este endereço no meu perfil para compras futuras
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '1.45rem', marginTop: '0.2rem' }}>
                {saveAddressToProfile
                  ? 'O endereço será adicionado permanentemente à sua lista de endereços.'
                  : 'O endereço será utilizado exclusivamente para a entrega desta compra.'}
              </div>
            </div>
          )}

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
            <button type="submit" className="btn btn-primary" data-cy="btn-save-address">
              {editingAddress ? 'SALVAR ALTERAÇÕES' : 'SALVAR ENDEREÇO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Adicionar Novo Cartão */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardModalError(null);
        }}
        title="Adicionar Novo Cartão"
      >
        <form onSubmit={handleAddNewCard} className="address-modal-form">
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
            <label htmlFor="chk-card-number">Número do Cartão</label>
            <input
              type="text"
              id="chk-card-number"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={newCard.cardNumber}
              onChange={e => setNewCard(prev => ({ ...prev, cardNumber: maskCardNumber(e.target.value) }))}
              data-cy="input-card-number"
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
              data-cy="input-card-holder"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="chk-card-brand">Bandeira *</label>
              <select
                id="chk-card-brand"
                value={newCard.bandeiraId}
                onChange={e => setNewCard(prev => ({ ...prev, bandeiraId: parseInt(e.target.value, 10) }))}
                data-cy="select-card-brand"
                required
              >
                {bandeiras.length === 0 && <option value="">Carregando bandeiras...</option>}
                {bandeiras.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
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
                onChange={e => setNewCard(prev => ({ ...prev, expirationDate: maskCardExpiration(e.target.value) }))}
                data-cy="input-card-exp"
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
                onChange={e => setNewCard(prev => ({ ...prev, cvv: maskCardCvv(e.target.value) }))}
                data-cy="input-card-cvv"
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

          <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#ffffff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={saveCardToProfile}
                onChange={e => setSaveCardToProfile(e.target.checked)}
                data-cy="chk-save-card-to-profile"
              />
              Salvar este cartão no meu perfil para compras futuras
            </label>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '1.45rem', marginTop: '0.2rem' }}>
              {saveCardToProfile
                ? 'O cartão será adicionado permanentemente à sua carteira.'
                : 'O cartão será utilizado exclusivamente para o pagamento desta compra.'}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1rem', border: 'none', padding: '0' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setIsCardModalOpen(false)}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary" data-cy="btn-save-card">
              SALVAR E USAR CARTÃO
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
