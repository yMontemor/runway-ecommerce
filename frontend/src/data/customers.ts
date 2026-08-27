import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'CLI-0001',
    name: 'Ana Carolina Silva',
    email: 'ana.silva@email.com',
    cpf: '382.194.730-21',
    phone: '(11) 98765-4321',
    phoneType: 'Celular',
    phoneDdd: '11',
    phoneNumber: '98765-4321',
    gender: 'Feminino',
    birthDate: '14/03/1990',
    status: 'ATIVO',
    ranking: 1, // Pontuação inicial base do protótipo
    addresses: [
      {
        id: 'ana_addr_1',
        label: 'Casa',
        residenceType: 'Casa',
        streetType: 'Rua',
        street: 'Rua das Palmeiras',
        number: '142',
        complement: 'Apto 82',
        neighborhood: 'Jardim Paulista',
        zipCode: '01310-100',
        city: 'São Paulo',
        state: 'SP',
        country: 'Brasil',
        isDelivery: true,
        isBilling: true
      },
      {
        id: 'ana_addr_2',
        label: 'Trabalho',
        residenceType: 'Comercial',
        streetType: 'Avenida',
        street: 'Avenida Paulista',
        number: '1200',
        complement: 'Conjunto 301',
        neighborhood: 'Bela Vista',
        zipCode: '01310-200',
        city: 'São Paulo',
        state: 'SP',
        country: 'Brasil',
        isDelivery: true,
        isBilling: false
      }
    ],
    cards: [
      {
        id: 'ana_card_1',
        brand: 'Visa',
        lastFour: '4821',
        holderName: 'ANA C SILVA',
        expirationDate: '08/27',
        isPreferred: true
      },
      {
        id: 'ana_card_2',
        brand: 'Mastercard',
        lastFour: '9234',
        holderName: 'ANA C SILVA',
        expirationDate: '03/27',
        isPreferred: false
      }
    ]
  },
  {
    id: 'CLI-0002',
    name: 'Carlos Roberto Mendes',
    email: 'carlos.mendes@email.com',
    cpf: '541.029.870-33',
    phone: '(41) 99234-5678',
    phoneType: 'Celular',
    phoneDdd: '41',
    phoneNumber: '99234-5678',
    gender: 'Masculino',
    birthDate: '21/07/1985',
    status: 'ATIVO',
    ranking: 1, // Pontuação inicial base do protótipo
    addresses: [
      {
        id: 'carlos_addr_1',
        label: 'Casa',
        residenceType: 'Casa',
        streetType: 'Rua',
        street: 'Rua XV de Novembro',
        number: '500',
        neighborhood: 'Centro',
        zipCode: '80020-300',
        city: 'Curitiba',
        state: 'PR',
        country: 'Brasil',
        isDelivery: true,
        isBilling: true
      }
    ],
    cards: [
      {
        id: 'carlos_card_1',
        brand: 'Elo',
        lastFour: '5571',
        holderName: 'CARLOS R MENDES',
        expirationDate: '11/27',
        isPreferred: true
      }
    ]
  },
  {
    id: 'CLI-0003',
    name: 'Maria Oliveira Santos',
    email: 'maria.santos@email.com',
    cpf: '219.384.560-44',
    phone: '(81) 97654-3210',
    phoneType: 'Celular',
    phoneDdd: '81',
    phoneNumber: '97654-3210',
    gender: 'Feminino',
    birthDate: '07/11/1995',
    status: 'INATIVO',
    ranking: 1, // RN0027: Pontuação inicial/base do protótipo
    addresses: [
      {
        id: 'maria_addr_1',
        label: 'Casa',
        residenceType: 'Apartamento',
        streetType: 'Avenida',
        street: 'Avenida Boa Viagem',
        number: '1500',
        complement: 'Apto 301',
        neighborhood: 'Boa Viagem',
        zipCode: '51011-000',
        city: 'Recife',
        state: 'PE',
        country: 'Brasil',
        isDelivery: true,
        isBilling: true
      }
    ],
    cards: [
      {
        id: 'maria_card_1',
        brand: 'Visa',
        lastFour: '3399',
        holderName: 'MARIA O SANTOS',
        expirationDate: '07/28',
        isPreferred: true
      }
    ]
  }
];
