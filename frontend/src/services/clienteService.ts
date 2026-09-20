import type { Customer, NewCustomerInput, Address, CreditCard, BandeiraDto } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5035';

export interface TelefoneRequestDto {
  tipo: string;
  ddd: string;
  numero: string;
}

export interface EnderecoRequestDto {
  nome: string;
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
  residencial: boolean;
  entrega: boolean;
  cobranca: boolean;
}

export interface ClienteCreateRequestDto {
  nome: string;
  email: string;
  cpf: string;
  genero: string;
  dataNascimento: string; // formato YYYY-MM-DD
  senha: string;
  confirmacaoSenha: string;
  telefone: TelefoneRequestDto;
  enderecos: EnderecoRequestDto[];
}

export interface ClienteUpdateRequestDto {
  nome: string;
  email: string;
  genero: string;
  dataNascimento: string; // formato YYYY-MM-DD
  telefone: TelefoneRequestDto;
}

export interface ClienteSenhaUpdateRequestDto {
  novaSenha: string;
  confirmacaoNovaSenha: string;
}

export interface AlteracaoSenhaResult {
  success: boolean;
  error?: string;
  mensagem?: string;
}

export interface InativacaoClienteResult {
  success: boolean;
  error?: string;
  mensagem?: string;
}

export interface TelefoneResponseDto {
  id: number;
  tipo: string;
  ddd: string;
  numero: string;
}

export interface EnderecoResponseDto {
  id: number;
  nome: string;
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
  residencial: boolean;
  entrega: boolean;
  cobranca: boolean;
}

export interface ClienteResponseDto {
  id: number;
  codigo: string; // CLI-XXXX
  nome: string;
  email: string;
  cpf: string;
  genero: string;
  dataNascimento: string; // YYYY-MM-DD
  ranking: number;
  ativo: boolean;
  telefone: TelefoneResponseDto;
  enderecos: EnderecoResponseDto[];
}

export interface CadastroClienteResult {
  success: boolean;
  error?: string;
  customer?: Customer;
}

export interface ClienteFiltro {
  codigo?: string;
  nome?: string;
  cpf?: string;
  email?: string;
  genero?: string;
  dataNascimento?: string; // Formato YYYY-MM-DD
  telefone?: string;
  ativo?: boolean;
}

export interface ClienteListItemResponseDto {
  codigo: string;
  nome: string;
  email: string;
  cpf: string;
  genero: string;
  dataNascimento: string; // YYYY-MM-DD
  ranking: number;
  ativo: boolean;
  telefone?: TelefoneResponseDto | null;
}

export interface ConsultaClientesResult {
  success: boolean;
  error?: string;
  clientes: ClienteListItemResponseDto[];
}

/**
 * Converte data do padrão brasileiro DD/MM/AAAA para formato ISO YYYY-MM-DD aceito pelo backend.
 */
export function convertDateBrToIso(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

/**
 * Converte data ISO YYYY-MM-DD retornada pelo backend para padrão brasileiro DD/MM/AAAA para exibição na interface.
 */
export function convertDateIsoToBr(isoStr: string): string {
  if (!isoStr) return '';
  const parts = isoStr.trim().split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoStr;
}

/**
 * Mapeia o DTO de endereço do backend para o modelo de Address do frontend.
 */
export function mapDtoToAddress(dto: EnderecoResponseDto): Address {
  return {
    id: `addr_${dto.id}`,
    label: dto.nome,
    residenceType: dto.tipoResidencia,
    streetType: dto.tipoLogradouro,
    street: dto.logradouro,
    number: dto.numero,
    complement: dto.complemento || undefined,
    neighborhood: dto.bairro,
    zipCode: dto.cep.length === 8 ? `${dto.cep.slice(0, 5)}-${dto.cep.slice(5)}` : dto.cep,
    city: dto.cidade,
    state: dto.estado,
    country: dto.pais,
    observations: dto.observacoes || undefined,
    isResidential: dto.residencial,
    isDelivery: dto.entrega,
    isBilling: dto.cobranca
  };
}

/**
 * Converte um Address do frontend para o DTO EnderecoRequestDto enviado ao backend.
 */
export function mapAddressToRequestDto(address: Partial<Address>): EnderecoRequestDto {
  return {
    nome: address.label?.trim() || '',
    tipoResidencia: address.residenceType || '',
    tipoLogradouro: address.streetType || '',
    logradouro: address.street?.trim() || '',
    numero: address.number?.trim() || '',
    complemento: address.complement?.trim() || null,
    bairro: address.neighborhood?.trim() || '',
    cep: address.zipCode?.replace(/\D/g, '') || '',
    cidade: address.city?.trim() || '',
    estado: address.state?.trim().toUpperCase() || '',
    pais: address.country?.trim() || 'Brasil',
    observacoes: address.observations?.trim() || null,
    residencial: address.isResidential ?? false,
    entrega: address.isDelivery ?? false,
    cobranca: address.isBilling ?? false
  };
}

/**
 * Mapeia o DTO de resposta do backend para o modelo de Customer utilizado no frontend.
 * Conforme requisito:
 * - response.codigo é atribuído a Customer.id para compatibilidade com o protótipo.
 * - Nenhuma senha ou hash é adicionada ao Customer.
 */
function mapDtoToCustomer(dto: ClienteResponseDto): Customer {
  const phoneDdd = dto.telefone.ddd;
  const phoneNum = dto.telefone.numero;
  const formattedPhoneNum =
    phoneNum.length === 9
      ? `${phoneNum.slice(0, 5)}-${phoneNum.slice(5)}`
      : phoneNum.length === 8
        ? `${phoneNum.slice(0, 4)}-${phoneNum.slice(4)}`
        : phoneNum;
  const derivedPhone = `(${phoneDdd}) ${formattedPhoneNum}`;

  const addresses: Address[] = (dto.enderecos || []).map(mapDtoToAddress);

  const cpfFormatted =
    dto.cpf.length === 11
      ? `${dto.cpf.slice(0, 3)}.${dto.cpf.slice(3, 6)}.${dto.cpf.slice(6, 9)}-${dto.cpf.slice(9, 11)}`
      : dto.cpf;

  return {
    id: dto.codigo, // RNF0035: Código único sequencial gerado pelo backend (CLI-XXXX)
    name: dto.nome,
    email: dto.email,
    cpf: cpfFormatted,
    phone: derivedPhone,
    phoneType: dto.telefone.tipo,
    phoneDdd,
    phoneNumber: formattedPhoneNum,
    gender: dto.genero,
    birthDate: convertDateIsoToBr(dto.dataNascimento), // Mantém padrão brasileiro na interface
    status: dto.ativo ? 'ATIVO' : 'INATIVO',
    ranking: dto.ranking,
    addresses,
    cards: []
  };
}

/**
 * Remove identificadores acadêmicos de requisitos (RFxxxx, RNxxxx, RNFxxxx) de mensagens
 * exibidas ao usuário final na interface, preservando a rastreabilidade nos comentários,
 * testes e documentação do código.
 */
export function sanitizarMensagemErro(mensagem: string): string {
  if (!mensagem) return '';

  let limpa = mensagem;

  // 1. Remove parênteses contendo códigos de requisitos (ex: "(RNF0031)", "(RN0021, RN0022, RN0026)")
  limpa = limpa.replace(/\s*\(\s*(?:RF|RNF|RN)\d+[\w\s,;/.-]*\)/gi, '');

  // 2. Remove colchetes contendo códigos de requisitos (ex: "[RF0021]", "[RN0021, RN0022]")
  limpa = limpa.replace(/\s*\[\s*(?:RF|RNF|RN)\d+[\w\s,;/.-]*\]/gi, '');

  // 3. Remove separadores com códigos ao final ou meio (ex: " - RNF0031", " : RN0026")
  limpa = limpa.replace(/\s*[-–—:]\s*(?:RF|RNF|RN)\d+\b/gi, '');

  // 4. Remove qualquer código remanescente isolado (ex: "RNF0031", "RN0026")
  limpa = limpa.replace(/\b(?:RF|RNF|RN)\d+\b/gi, '');

  // 5. Ajustes de pontuação e espaçamentos múltiplos
  limpa = limpa.replace(/\s{2,}/g, ' ');
  limpa = limpa.replace(/\s+\./g, '.');
  limpa = limpa.replace(/\.{2,}/g, '.');

  return limpa.trim();
}

/**
 * Extrai e sanitiza a mensagem de erro retornada pela API.
 */
async function extractErrorMessage(response: Response, defaultMessage: string): Promise<string> {
  try {
    const errorData = await response.json();
    let errorMessage = errorData.erro || errorData.title || defaultMessage;
    if (errorData.errors && typeof errorData.errors === 'object') {
      const firstKey = Object.keys(errorData.errors)[0];
      if (Array.isArray(errorData.errors[firstKey]) && errorData.errors[firstKey].length > 0) {
        errorMessage = errorData.errors[firstKey][0];
      }
    }
    return sanitizarMensagemErro(errorMessage);
  } catch {
    return defaultMessage;
  }
}

/**
 * Realiza o cadastro de cliente via requisição POST /api/clientes.
 * RF0021 / RN0021 / RN0022 / RN0023 / RN0026 / RNF0031 / RNF0032 / RNF0033 / RNF0035
 */
export async function cadastrarCliente(input: NewCustomerInput): Promise<CadastroClienteResult> {
  try {
    const payload: ClienteCreateRequestDto = {
      nome: input.name.trim(),
      email: input.email.trim(),
      cpf: input.cpf.replace(/\D/g, ''),
      genero: input.gender,
      dataNascimento: convertDateBrToIso(input.birthDate),
      senha: input.senha,
      confirmacaoSenha: input.confirmacaoSenha,
      telefone: {
        tipo: input.phoneType,
        ddd: input.phoneDdd.replace(/\D/g, ''),
        numero: input.phoneNumber.replace(/\D/g, '')
      },
      enderecos: [
        {
          nome: input.initialAddress.label?.trim() || 'Residencial Principal',
          tipoResidencia: input.initialAddress.residenceType || 'Casa',
          tipoLogradouro: input.initialAddress.streetType || 'Rua',
          logradouro: input.initialAddress.street.trim(),
          numero: input.initialAddress.number.trim(),
          complemento: input.initialAddress.complement?.trim() || null,
          bairro: input.initialAddress.neighborhood.trim(),
          cep: input.initialAddress.zipCode.replace(/\D/g, ''),
          cidade: input.initialAddress.city.trim(),
          estado: input.initialAddress.state.trim().toUpperCase(),
          pais: input.initialAddress.country?.trim() || 'Brasil',
          observacoes: input.initialAddress.observations?.trim() || null,
          // Conforme especificação: endereço principal do cadastro inicial é Residencial, Entrega e Cobrança
          residencial: true,
          entrega: true,
          cobranca: true
        }
      ]
    };

    const response = await fetch(`${API_BASE_URL}/api/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 201) {
      const data: ClienteResponseDto = await response.json();
      const customer = mapDtoToCustomer(data);
      return { success: true, customer };
    }

    // Erros de validação (400) ou conflito de CPF/e-mail (409)
    if (response.status === 400 || response.status === 409) {
      const errorMessage = await extractErrorMessage(response, 'Dados inválidos para cadastro.');
      return { success: false, error: errorMessage };
    }

    // Outros erros de servidor (500 etc)
    return {
      success: false,
      error: 'Não foi possível concluir o cadastro no momento. Tente novamente mais tarde.'
    };
  } catch {
    // Falha de rede / servidor fora do ar
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor do RunWay. Verifique se a API está em execução.'
    };
  }
}

export interface AlteracaoClienteResult {
  success: boolean;
  error?: string;
  cliente?: ClienteResponseDto;
}

/**
 * RF0022: Altera os dados cadastrais permitidos do cliente via PUT /api/clientes/{codigo}.
 * Envia estritamente os campos permitidos: nome, email, genero, dataNascimento e telefone.
 * Não envia CPF, código, ranking, status, senha, endereços ou cartões.
 */
export async function alterarCliente(
  codigoCliente: string,
  dados: ClienteUpdateRequestDto
): Promise<AlteracaoClienteResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    if (response.ok) {
      const data: ClienteResponseDto = await response.json();
      return {
        success: true,
        cliente: data
      };
    }

    if (response.status === 400 || response.status === 404 || response.status === 409) {
      const errorMsg = await extractErrorMessage(response, 'Não foi possível alterar o cliente.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível atualizar o cliente no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para alterar o cliente.'
    };
  }
}

/**
 * RF0028: Altera exclusivamente a senha do cliente via PATCH /api/clientes/{codigo}/senha.
 * RNF0031: Validação de senha forte (mínimo 8 caracteres, maiúscula, minúscula, caractere especial).
 * RNF0032: Confirmação da nova senha.
 * RNF0033: Armazenamento seguro via hash.
 * Envia estritamente os campos novaSenha e confirmacaoNovaSenha.
 */
export async function alterarSenhaCliente(
  codigoCliente: string,
  dadosOrNovaSenha: ClienteSenhaUpdateRequestDto | string,
  confirmacao?: string
): Promise<AlteracaoSenhaResult> {
  const dados: ClienteSenhaUpdateRequestDto =
    typeof dadosOrNovaSenha === 'string'
      ? { novaSenha: dadosOrNovaSenha, confirmacaoNovaSenha: confirmacao || '' }
      : dadosOrNovaSenha;

  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/senha`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        mensagem: data.mensagem || 'Senha alterada com sucesso.'
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Não foi possível alterar a senha.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível atualizar a senha no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para alterar a senha.'
    };
  }
}

/**
 * RF0023: Inativação lógica do cliente via PATCH /api/clientes/{codigo}/inativar.
 * Operação idempotente sem body e sem DTO.
 * Retorna 200 OK tanto para inativação com sucesso quanto para cliente que já estava inativo.
 */
export async function inativarCliente(
  codigoCliente: string
): Promise<InativacaoClienteResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/inativar`, {
      method: 'PATCH'
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        mensagem: data.mensagem || 'Cliente inativado com sucesso.'
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Não foi possível inativar o cliente.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível inativar o cliente no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para inativar o cliente.'
    };
  }
}

export interface EnderecosResult {
  success: boolean;
  error?: string;
  addresses?: Address[];
}

export interface EnderecoResult {
  success: boolean;
  error?: string;
  address?: Address;
}

/**
 * RF0026: Lista os endereços cadastrados de um cliente pelo seu código.
 */
export async function listarEnderecosCliente(codigoCliente: string): Promise<EnderecosResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/enderecos`);

    if (response.ok) {
      const data: EnderecoResponseDto[] = await response.json();
      return {
        success: true,
        addresses: data.map(mapDtoToAddress)
      };
    }

    if (response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Cliente não encontrado.');
      return { success: false, error: errorMsg };
    }

    const genericError = await extractErrorMessage(response, 'Não foi possível carregar os endereços.');
    return { success: false, error: genericError };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para carregar os endereços.'
    };
  }
}

/**
 * RF0026 / RNF0034: Cadastra um novo endereço para o cliente.
 */
export async function cadastrarEnderecoCliente(
  codigoCliente: string,
  endereco: Partial<Address>
): Promise<EnderecoResult> {
  try {
    const payload = mapAddressToRequestDto(endereco);

    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/enderecos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 201) {
      const data: EnderecoResponseDto = await response.json();
      return {
        success: true,
        address: mapDtoToAddress(data)
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Dados inválidos para o endereço.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível cadastrar o endereço no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para cadastrar o endereço.'
    };
  }
}

/**
 * RF0026 / RNF0034 / RN0021 / RN0022 / RN0026: Altera um endereço existente do cliente.
 */
export async function alterarEnderecoCliente(
  codigoCliente: string,
  enderecoId: string | number,
  endereco: Partial<Address>
): Promise<EnderecoResult> {
  try {
    const rawId = typeof enderecoId === 'string' ? enderecoId.replace('addr_', '') : enderecoId.toString();
    const numericId = parseInt(rawId, 10);

    if (isNaN(numericId)) {
      return {
        success: false,
        error: 'Identificador de endereço inválido.'
      };
    }

    const payload = mapAddressToRequestDto(endereco);

    const response = await fetch(
      `${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/enderecos/${numericId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (response.ok) {
      const data: EnderecoResponseDto = await response.json();
      return {
        success: true,
        address: mapDtoToAddress(data)
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Dados inválidos para alteração do endereço.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível atualizar o endereço no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para atualizar o endereço.'
    };
  }
}

export interface BandeiraResponseDto {
  id: number;
  nome: string;
}

export interface CartaoCreateRequestDto {
  bandeiraId: number;
  numeroCartao: string;
  nomeImpresso: string;
  dataValidade: string;
  cvv: string;
  preferencial: boolean;
}

export interface CartaoResponseDto {
  id: number;
  bandeiraId: number;
  bandeiraNome: string;
  nomeImpresso: string;
  ultimosQuatroDigitos: string;
  dataValidade: string;
  preferencial: boolean;
}

export interface BandeirasResult {
  success: boolean;
  error?: string;
  bandeiras?: BandeiraDto[];
}

export interface CartoesResult {
  success: boolean;
  error?: string;
  cards?: CreditCard[];
}

export interface CartaoResult {
  success: boolean;
  error?: string;
  card?: CreditCard;
}

/**
 * Mapeia o DTO de cartão de crédito do backend para o modelo CreditCard do frontend.
 */
export function mapDtoToCreditCard(dto: CartaoResponseDto): CreditCard {
  return {
    id: `card_${dto.id}`,
    brand: dto.bandeiraNome,
    bandeiraId: dto.bandeiraId,
    lastFour: dto.ultimosQuatroDigitos,
    holderName: dto.nomeImpresso,
    expirationDate: dto.dataValidade,
    isPreferred: dto.preferencial
  };
}

/**
 * RN0025: Lista todas as bandeiras de cartão ativas cadastradas no backend.
 */
export async function listarBandeiras(): Promise<BandeirasResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bandeiras`);

    if (response.ok) {
      const data: BandeiraResponseDto[] = await response.json();
      return {
        success: true,
        bandeiras: data.map(b => ({ id: b.id, nome: b.nome }))
      };
    }

    const errorMsg = await extractErrorMessage(response, 'Não foi possível carregar as bandeiras disponíveis.');
    return { success: false, error: errorMsg };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para carregar as bandeiras.'
    };
  }
}

/**
 * RF0027: Lista os cartões de crédito cadastrados de um cliente pelo seu código.
 */
export async function listarCartoesCliente(codigoCliente: string): Promise<CartoesResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/cartoes`);

    if (response.ok) {
      const data: CartaoResponseDto[] = await response.json();
      return {
        success: true,
        cards: data.map(mapDtoToCreditCard)
      };
    }

    if (response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Cliente não encontrado.');
      return { success: false, error: errorMsg };
    }

    const genericError = await extractErrorMessage(response, 'Não foi possível carregar os cartões de crédito.');
    return { success: false, error: genericError };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para carregar os cartões.'
    };
  }
}

/**
 * RF0027 / RN0024 / RN0025: Cadastra um novo cartão de crédito para o cliente.
 */
export async function cadastrarCartaoCliente(
  codigoCliente: string,
  request: CartaoCreateRequestDto
): Promise<CartaoResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/cartoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (response.status === 201) {
      const data: CartaoResponseDto = await response.json();
      return {
        success: true,
        card: mapDtoToCreditCard(data)
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Dados inválidos para o cartão de crédito.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível cadastrar o cartão no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para cadastrar o cartão.'
    };
  }
}

/**
 * RF0027: Define um cartão existente como o preferencial do cliente via PATCH.
 */
export async function definirCartaoPreferencial(
  codigoCliente: string,
  cartaoId: string | number
): Promise<CartaoResult> {
  try {
    const rawId = typeof cartaoId === 'string' ? cartaoId.replace('card_', '') : cartaoId.toString();
    const numericId = parseInt(rawId, 10);

    if (isNaN(numericId)) {
      return {
        success: false,
        error: 'Identificador de cartão inválido.'
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/api/clientes/${encodeURIComponent(codigoCliente)}/cartoes/${numericId}/preferencial`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data: CartaoResponseDto = await response.json();
      return {
        success: true,
        card: mapDtoToCreditCard(data)
      };
    }

    if (response.status === 400 || response.status === 404) {
      const errorMsg = await extractErrorMessage(response, 'Não foi possível definir o cartão como preferencial.');
      return { success: false, error: errorMsg };
    }

    return {
      success: false,
      error: 'Não foi possível atualizar a preferência do cartão no momento.'
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para atualizar o cartão preferencial.'
    };
  }
}

/**
 * Mapeia o item enxuto retornado pela consulta de clientes (ClienteListItemResponseDto)
 * para o modelo Customer consumido na tela de Administração.
 */
export function mapListItemDtoToCustomer(dto: ClienteListItemResponseDto): Customer {
  const phoneDdd = dto.telefone?.ddd || '';
  const phoneNum = dto.telefone?.numero || '';
  const formattedPhoneNum =
    phoneNum.length === 9
      ? `${phoneNum.slice(0, 5)}-${phoneNum.slice(5)}`
      : phoneNum.length === 8
        ? `${phoneNum.slice(0, 4)}-${phoneNum.slice(4)}`
        : phoneNum;
  const derivedPhone = phoneDdd && phoneNum ? `(${phoneDdd}) ${formattedPhoneNum}` : '';

  const cpfFormatted =
    dto.cpf.length === 11
      ? `${dto.cpf.slice(0, 3)}.${dto.cpf.slice(3, 6)}.${dto.cpf.slice(6, 9)}-${dto.cpf.slice(9, 11)}`
      : dto.cpf;

  return {
    id: dto.codigo,
    name: dto.nome,
    email: dto.email,
    cpf: cpfFormatted,
    phone: derivedPhone,
    phoneType: dto.telefone?.tipo || 'Celular',
    phoneDdd,
    phoneNumber: formattedPhoneNum,
    gender: dto.genero,
    birthDate: convertDateIsoToBr(dto.dataNascimento),
    status: dto.ativo ? 'ATIVO' : 'INATIVO',
    ranking: dto.ranking,
    addresses: [],
    cards: []
  };
}

/**
 * RF0024 / RNF0011: Consulta clientes persistidos no PostgreSQL aplicando filtros opcionais combinados (AND).
 * Sem parâmetros, retorna todos os clientes.
 * Caso nenhum cliente corresponda, retorna lista vazia com sucesso (200 OK).
 */
export async function consultarClientes(filtro?: ClienteFiltro): Promise<ConsultaClientesResult> {
  try {
    const params = new URLSearchParams();
    if (filtro) {
      if (filtro.codigo?.trim()) params.append('codigo', filtro.codigo.trim());
      if (filtro.nome?.trim()) params.append('nome', filtro.nome.trim());
      if (filtro.cpf?.trim()) params.append('cpf', filtro.cpf.trim());
      if (filtro.email?.trim()) params.append('email', filtro.email.trim());
      if (filtro.genero?.trim()) params.append('genero', filtro.genero.trim());
      if (filtro.dataNascimento?.trim()) params.append('dataNascimento', filtro.dataNascimento.trim());
      if (filtro.telefone?.trim()) params.append('telefone', filtro.telefone.trim());
      if (filtro.ativo !== undefined && filtro.ativo !== null) params.append('ativo', String(filtro.ativo));
    }

    const queryString = params.toString();
    const url = queryString ? `${API_BASE_URL}/api/clientes?${queryString}` : `${API_BASE_URL}/api/clientes`;

    const response = await fetch(url);

    if (response.ok) {
      const data: ClienteListItemResponseDto[] = await response.json();
      return {
        success: true,
        clientes: data
      };
    }

    const errorMsg = await extractErrorMessage(response, 'Não foi possível consultar os clientes.');
    return {
      success: false,
      error: errorMsg,
      clientes: []
    };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para consultar os clientes.',
      clientes: []
    };
  }
}

/**
 * Consulta pontual de um cliente pelo seu código único CLI-XXXX.
 * Utiliza internamente consultarClientes({ codigo }) e retorna o primeiro resultado ou null.
 */
export async function obterClientePorCodigo(codigo: string): Promise<ClienteListItemResponseDto | null> {
  if (!codigo?.trim()) return null;
  const res = await consultarClientes({ codigo: codigo.trim() });
  if (res.success && res.clientes.length > 0) {
    return res.clientes[0];
  }
  return null;
}
