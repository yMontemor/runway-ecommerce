import type { Customer, NewCustomerInput, Address } from '../types';

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

/**
 * Converte data do padrão brasileiro DD/MM/AAAA para formato ISO YYYY-MM-DD aceito pelo backend.
 */
function convertDateBrToIso(dateStr: string): string {
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
function convertDateIsoToBr(isoStr: string): string {
  if (!isoStr) return '';
  const parts = isoStr.trim().split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoStr;
}

/**
 * Mapeia o DTO de resposta do backend para o modelo de Customer utilizado no frontend.
 * Conforme requisito:
 * - response.codigo é atribuído a Customer.id para compatibilidade temporária com o protótipo.
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

  const addresses: Address[] = (dto.enderecos || []).map(addr => ({
    id: `addr_${addr.id}`,
    label: addr.nome,
    residenceType: addr.tipoResidencia,
    streetType: addr.tipoLogradouro,
    street: addr.logradouro,
    number: addr.numero,
    complement: addr.complemento || undefined,
    neighborhood: addr.bairro,
    zipCode: addr.cep.length === 8 ? `${addr.cep.slice(0, 5)}-${addr.cep.slice(5)}` : addr.cep,
    city: addr.cidade,
    state: addr.estado,
    country: addr.pais,
    observations: addr.observacoes || undefined,
    isDelivery: addr.entrega,
    isBilling: addr.cobranca
  }));

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
      try {
        const errorData = await response.json();
        let errorMessage = errorData.erro || errorData.title || 'Dados inválidos para cadastro.';
        if (errorData.errors && typeof errorData.errors === 'object') {
          const firstKey = Object.keys(errorData.errors)[0];
          if (Array.isArray(errorData.errors[firstKey]) && errorData.errors[firstKey].length > 0) {
            errorMessage = errorData.errors[firstKey][0];
          }
        }
        return { success: false, error: sanitizarMensagemErro(errorMessage) };
      } catch {
        return { success: false, error: 'Ocorreu um erro de validação ao processar o cadastro.' };
      }
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
