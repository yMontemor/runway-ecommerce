export interface ProdutoVariacaoDto {
  id: number;
  produtoId: number;
  tamanho: number;
  quantidadeEstoque: number;
  ativo: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  brand: string;
  category: string; // primary category for compatibility
  categories: string[]; // multiple categories
  weight: string; // e.g. "250g"
  drop: string;   // e.g. "8mm"
  sizes: number[]; // e.g. [38, 39, 40, 41, 42, 43, 44]
  color: string;
  technologies: string[];
  variacoes?: ProdutoVariacaoDto[];
}

export interface Address {
  id: string;
  label: string; // e.g. "Casa", "Trabalho", "Cobrança Principal"
  residenceType?: 'Casa' | 'Apartamento' | 'Sobrado' | 'Comercial' | 'Outro' | string; // RN0023
  streetType?: 'Rua' | 'Avenida' | 'Alameda' | 'Praça' | 'Travessa' | 'Rodovia' | 'Outro' | string; // RN0023
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  observations?: string;
  isDelivery?: boolean; // RN0022 - Endereço de entrega
  isBilling?: boolean;  // RN0021 - Endereço de cobrança
  isResidential?: boolean; // RN0026 - Endereço residencial
  saveToProfile?: boolean;
}

export interface BandeiraDto {
  id: number;
  nome: string;
}

export interface CreditCard {
  id: string;
  brand: string; // Ex: 'Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard'
  bandeiraId?: number;
  cardNumber?: string;
  lastFour: string;
  holderName: string;
  expirationDate: string;
  cvv?: string;
  isPreferred: boolean;
}

export interface CartItem {
  product: Product;
  variacaoId: number;
  size: number;
  quantity: number;
  itemPedidoId?: number;
}

export interface ItemValidacaoEstoqueResponse {
  produtoVariacaoId: number;
  nomeProduto: string;
  tamanho: number;
  quantidadeSolicitada: number;
  quantidadeDisponivel: number;
  disponivel: boolean;
  mensagem: string;
}

export interface ValidacaoEstoqueResponse {
  valido: boolean;
  mensagem: string;
  itens: ItemValidacaoEstoqueResponse[];
}

export interface Coupon {
  id: string;
  code: string;
  type: 'promo' | 'exchange';
  value: number; // promo: discount percentage (e.g. 20 for 20%), exchange: fixed credit amount (e.g. 849.90)
  description: string;
  expirationDate: string;
  customerId: string; // bound to a specific customer
}

export interface Order {
  id: string; // e.g. "RW-2026-007"
  date: string;
  customerId: string; // bound to a specific customer
  status: 'EM ABERTO' | 'EM PROCESSAMENTO' | 'PAGAMENTO REALIZADO' | 'EM TRÂNSITO' | 'ENTREGUE' | 'CANCELADO' | 'APROVADA' | 'REPROVADA' | 'EM TRANSPORTE' | 'EM TROCA' | 'TROCA AUTORIZADA' | 'TROCADO';
  items: CartItem[];
  shippingAddress: Address;
  paymentMethods: {
    cardId: string;
    amount: number;
    installments?: number;
  }[];
  couponsUsed: Coupon[];
  subtotal: number;
  shippingCost?: number;
  discountPromo?: number;
  discountExchange?: number;
  discount: number;
  total: number;
  clientConfirmedReceipt?: boolean;
  cancellationRefundCouponCode?: string;
  cardRefundedAmount?: number;
  exchangeStatus?: 'TROCA SOLICITADA' | 'TROCA ACEITA' | 'ITEM ENVIADO' | 'ITEM RECEBIDO' | 'TROCA PROCESSADA' | 'TROCA NEGADA' | 'EM TROCA' | 'TROCA AUTORIZADA' | 'TROCADO' | 'TROCA RECUSADA';
  exchangeReason?: string;
  exchangeItemId?: string; // product id being returned (retrocompatibilidade)
  exchangeItemSize?: number; // size of product being returned (retrocompatibilidade)
  exchangeItems?: ExchangeItem[];
}

export interface Customer {
  id: string; // RNF0035 - Código único do cliente
  name: string;
  email: string;
  cpf: string;
  phone: string; // Mantido para retrocompatibilidade (derivado de phoneDdd + phoneNumber)
  phoneType?: 'Celular' | 'Fixo' | 'Comercial' | string; // RN0026
  phoneDdd?: string; // RN0026
  phoneNumber?: string; // RN0026
  gender: string;
  birthDate: string;
  status: 'ATIVO' | 'INATIVO';
  /**
   * RN0027: Ranking numérico do cliente.
   * NOTA: O valor 1 é apenas a pontuação inicial/base do protótipo e não constitui
   * atendimento integral da RN0027. O cálculo dinâmico baseado no perfil de compras
   * será implementado em etapas futuras.
   */
  ranking: number;
  addresses: Address[];
  cards: CreditCard[];
}

export interface NewCustomerInput {
  name: string;
  email: string;
  cpf: string;
  phoneType: 'Celular' | 'Fixo' | 'Comercial' | string;
  phoneDdd: string;
  phoneNumber: string;
  gender: string;
  birthDate: string;
  senha: string;
  confirmacaoSenha: string;
  initialAddress: Omit<Address, 'id'>;
}

export interface ExchangeItem {
  productId: string;
  productName: string;
  size: number;
  price: number;
  quantity: number;
}

export interface Exchange {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  items: ExchangeItem[];
  item?: ExchangeItem; // retrocompatibilidade
  totalValue: number;
  reason: string;
  date: string;
  status: 'TROCA SOLICITADA' | 'TROCA ACEITA' | 'ITEM ENVIADO' | 'ITEM RECEBIDO' | 'TROCA PROCESSADA' | 'TROCA NEGADA' | 'EM TROCA' | 'TROCA AUTORIZADA' | 'TROCADO' | 'TROCA RECUSADA';
  refundCouponCode?: string;
  codigoCupom?: string;
  notificacaoCliente?: string;
}

export interface AnalyticsEntry {
  date: string; // e.g. "2026-01", "2026-02"
  category: string;
  salesVolume: number;
}

export interface ItemFreteRequestDto {
  produtoVariacaoId: number;
  quantidade: number;
}

export interface CalcularFreteRequestDto {
  codigoCliente?: string;
  enderecoId?: number;
  estado?: string;
  cep?: string;
  itens: ItemFreteRequestDto[];
}

export interface CalcularFreteResponseDto {
  valorFrete: number;
  estado: string;
  regiao: string;
  quantidadeItens: number;
}

export interface CupomResponseDto {
  id: number;
  codigo: string;
  tipo: string;
  valor: number;
  clienteId?: number | null;
}

export interface ConsultarCupomRequestDto {
  codigoCupom: string;
  codigoCliente?: string;
}

export interface ItemPedidoValidacaoDto {
  produtoVariacaoId: number;
  quantidade: number;
}

export interface NovoCartaoPagamentoDto {
  bandeiraId: number;
  numeroCartao: string;
  nomeImpresso: string;
  dataValidade: string;
  cvv: string;
  salvarNoPerfil: boolean;
}

export interface ItemPagamentoCartaoDto {
  cartaoId?: number;
  cartaoNovo?: NovoCartaoPagamentoDto;
  valor: number;
}

export interface ValidarPagamentoRequestDto {
  codigoCliente: string;
  itens: ItemPedidoValidacaoDto[];
  enderecoId?: number;
  estado?: string;
  cep?: string;
  cupons: string[];
  cartoes: ItemPagamentoCartaoDto[];
}

export interface CupomUtilizadoDto {
  codigo: string;
  tipo: string;
  formaPagamento: string;
  valorOriginal: number;
  valorUtilizado: number;
}

export interface CartaoUtilizadoDto {
  cartaoId?: number;
  formaPagamento: string;
  bandeira: string;
  ultimosDigitos: string;
  valor: number;
  salvarNoPerfil: boolean;
}

export interface NovoCupomTrocaPreviewDto {
  valor: number;
  mensagem: string;
}

export interface ValidarPagamentoResponseDto {
  valido: boolean;
  mensagem: string;
  subtotal: number;
  valorFrete: number;
  valorTotal: number;
  totalPagoCupons: number;
  totalPagoCartoes: number;
  saldoRestante: number;
  valorExcedenteCupons: number;
  novoCupomTroca?: NovoCupomTrocaPreviewDto | null;
  cuponsUtilizados: CupomUtilizadoDto[];
  cartoesUtilizados: CartaoUtilizadoDto[];
}

export interface ItemPedidoCriacaoDto {
  produtoVariacaoId: number;
  quantidade: number;
}

export interface EnderecoAvulsoPedidoDto {
  tipoResidencia: string;
  tipoLogradouro: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  pais?: string;
  observacoes?: string;
  salvarNoPerfil: boolean;
}

export interface ItemPagamentoCartaoPedidoDto {
  cartaoId?: number;
  cartaoNovo?: NovoCartaoPagamentoDto;
  valor: number;
}

export interface CriarPedidoRequestDto {
  codigoCliente: string;
  itens: ItemPedidoCriacaoDto[];
  enderecoId?: number;
  enderecoAvulso?: EnderecoAvulsoPedidoDto;
  cupons: string[];
  cartoes: ItemPagamentoCartaoPedidoDto[];
}

export interface EnderecoEntregaResponseDto {
  enderecoId?: number | null;
  tipoResidencia: string;
  tipoLogradouro: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  pais: string;
  observacoes?: string | null;
}

export interface ItemPedidoResponseDto {
  id: number;
  produtoVariacaoId: number;
  produtoCodigo?: string;
  produtoNome: string;
  marca: string;
  imagemUrl?: string;
  tamanho: string;
  quantidade: number;
  precoUnitario: number;
  totalItem: number;
}

export interface PagamentoPedidoResponseDto {
  id: number;
  formaPagamento: string;
  valor: number;
  cartaoId?: number | null;
  bandeira?: string | null;
  cartaoUltimosDigitos?: string | null;
  cartaoNomeImpresso?: string | null;
  cupomId?: number | null;
  cupomCodigo?: string | null;
}

export interface NovoCupomTrocaResponseDto {
  id: number;
  codigo: string;
  valor: number;
  mensagem: string;
}

export interface PedidoResponseDto {
  id: number;
  codigo: string;
  codigoCliente?: string;
  nomeCliente?: string;
  status: string;
  dataPedido: string;
  subtotal: number;
  valorFrete: number;
  valorTotal: number;
  enderecoEntrega: EnderecoEntregaResponseDto;
  itens: ItemPedidoResponseDto[];
  pagamentos: PagamentoPedidoResponseDto[];
  novoCupomTroca?: NovoCupomTrocaResponseDto | null;
}

export interface ItemCarrinhoDto {
  id: number;
  produtoVariacaoId: number;
  produtoId: number;
  codigoProduto: string;
  nomeProduto: string;
  marca: string;
  categoria: string;
  imagemUrl: string;
  tamanho: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  dataAdicionado: string;
}

export interface ItemExpiradoDto {
  produtoVariacaoId: number;
  nomeProduto: string;
  tamanho: number;
  quantidade: number;
  precoUnitario: number;
  imagemUrl: string;
  motivo: string;
}

export interface CarrinhoResponseDto {
  id: number;
  codigoCliente: string;
  dataCriacao: string;
  dataAtualizacao: string;
  dataExpiracao: string;
  tempoRestanteSegundos: number;
  alertaExpirando: boolean;
  expirado: boolean;
  mensagemExpiracao?: string | null;
  quantidadeTotalItens: number;
  subtotal: number;
  itens: ItemCarrinhoDto[];
  itensExpirados: ItemExpiradoDto[];
  avisosEstoque?: string[];
}

export interface ExpiracaoCarrinhoResponseDto {
  dataExpiracao?: string | null;
  tempoRestanteSegundos: number;
  alertaExpirando: boolean;
  expirado: boolean;
  mensagem?: string | null;
}

// ==========================================
// TROCAS E PROCESSAMENTO DE PEDIDOS (ETAPA D / E)
// ==========================================
export interface ItemTrocaResponseDto {
  id: number;
  trocaId: number;
  itemPedidoId: number;
  produtoVariacaoId: number;
  produtoId: number;
  codigoProduto: string;
  nomeProduto: string;
  marca: string;
  categoria: string;
  imagemUrl: string;
  tamanho: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface TrocaResponseDto {
  id: number;
  codigo: string;
  pedidoId: number;
  codigoPedido: string;
  clienteId: number;
  codigoCliente: string;
  nomeCliente: string;
  status: string; // 'EM TROCA' | 'TROCA AUTORIZADA' | 'TROCADO' | 'TROCA RECUSADA'
  tipo: string;   // 'PARCIAL' | 'TOTAL'
  motivo: string;
  valorTotal: number;
  dataSolicitacao: string;
  dataAutorizacao?: string | null;
  adminAutorizacao?: string | null;
  dataRecebimento?: string | null;
  adminRecebimento?: string | null;
  retornouAoEstoque?: boolean | null;
  cupomId?: number | null;
  codigoCupom?: string | null;
  valorCupom?: number | null;
  notificacaoCliente?: string | null;
  dataNotificacao?: string | null;
  itens: ItemTrocaResponseDto[];
}

export interface ItemSolicitacaoTrocaRequestDto {
  itemPedidoId: number;
  quantidade: number;
}

export interface SolicitarTrocaRequestDto {
  codigoCliente: string;
  codigoPedido: string;
  motivo: string;
  itens: ItemSolicitacaoTrocaRequestDto[];
}

export interface AutorizarTrocaRequestDto {
  autorizado: boolean;
  motivoRecusa?: string;
  usuarioResponsavel?: string;
}

export interface ConfirmarRecebimentoTrocaRequestDto {
  retornarAoEstoque: boolean;
  usuarioResponsavel?: string;
  observacoes?: string;
}

export interface NotificacaoTrocaResponseDto {
  codigoTroca: string;
  codigoPedido: string;
  status: string;
  mensagem: string;
  dataNotificacao?: string | null;
}

export interface ItemElegibilidadeTrocaDto {
  itemPedidoId: number;
  produtoVariacaoId: number;
  nomeProduto: string;
  tamanho: number;
  precoUnitario: number;
  quantidadeComprada: number;
  quantidadeJaEmTroca: number;
  quantidadeElegivel: number;
}

export interface ElegibilidadeTrocaResponseDto {
  codigoPedido: string;
  statusPedido: string;
  podeSolicitarTroca: boolean;
  motivoBloqueio?: string | null;
  itens: ItemElegibilidadeTrocaDto[];
}

export interface ProcessarPagamentoPedidoRequestDto {
  forcarResultado?: string;
  motivo?: string;
  usuarioResponsavel?: string;
}

export interface AtualizarStatusPedidoRequestDto {
  novoStatus: string;
  usuarioResponsavel?: string;
  motivo?: string;
}

