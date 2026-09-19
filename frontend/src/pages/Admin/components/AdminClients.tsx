import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/Modal/Modal';
import Toast from '../../../components/Toast/Toast';
import type { Customer, NewCustomerInput } from '../../../types';
import { maskBirthDate, maskPhoneNumber, maskZipCode } from '../../../utils/maskAndValidate';
import { BRAZILIAN_STATES } from '../../../data/brazilianStates';
import {
  consultarClientes,
  alterarCliente,
  mapListItemDtoToCustomer,
  convertDateBrToIso,
  type ClienteFiltro,
  type ClienteUpdateRequestDto
} from '../../../services/clienteService';

export default function AdminClients() {
  const { orders, updateCustomerStatus, addCustomer } = useApp();

  // Estado da listagem real de clientes persistidos no PostgreSQL (RF0024 / RNF0011)
  const [clientsList, setClientsList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filtros simples
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS');

  // Painel de Filtros Avançados
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterNome, setFilterNome] = useState('');
  const [filterCpf, setFilterCpf] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterGenero, setFilterGenero] = useState('');
  const [filterDataNascimento, setFilterDataNascimento] = useState('');
  const [filterTelefone, setFilterTelefone] = useState('');
  const [filterAtivo, setFilterAtivo] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS');

  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

  // Controle do Modal de Cadastro de Novo Cliente (RF0021)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('error');

  const initialFormState: NewCustomerInput = {
    name: '',
    email: '',
    cpf: '',
    gender: '',
    birthDate: '',
    phoneType: '',
    phoneDdd: '11',
    phoneNumber: '',
    senha: '',
    confirmacaoSenha: '',
    initialAddress: {
      label: 'Minha Casa',
      residenceType: '',
      streetType: '',
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
    }
  };

  const [clientForm, setClientForm] = useState<NewCustomerInput>(initialFormState);

  // Controle do Modal de Edição de Cliente (RF0022)
  interface ClientEditFormData {
    codigo: string;
    cpf: string;
    name: string;
    email: string;
    gender: string;
    birthDate: string;
    phoneType: string;
    phoneDdd: string;
    phoneNumber: string;
  }

  const initialEditState: ClientEditFormData = {
    codigo: '',
    cpf: '',
    name: '',
    email: '',
    gender: '',
    birthDate: '',
    phoneType: 'Celular',
    phoneDdd: '11',
    phoneNumber: ''
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<ClientEditFormData>(initialEditState);

  const handleOpenEditModal = (client: Customer) => {
    setEditFormData({
      codigo: client.id,
      cpf: client.cpf,
      name: client.name,
      email: client.email,
      gender: client.gender,
      birthDate: client.birthDate,
      phoneType: client.phoneType || 'Celular',
      phoneDdd: client.phoneDdd || '11',
      phoneNumber: client.phoneNumber || ''
    });
    setEditFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError(null);
    setIsEditSubmitting(true);

    try {
      const payload: ClienteUpdateRequestDto = {
        nome: editFormData.name.trim(),
        email: editFormData.email.trim(),
        genero: editFormData.gender,
        dataNascimento: convertDateBrToIso(editFormData.birthDate),
        telefone: {
          tipo: editFormData.phoneType,
          ddd: editFormData.phoneDdd.replace(/\D/g, ''),
          numero: editFormData.phoneNumber.replace(/\D/g, '')
        }
      };

      const res = await alterarCliente(editFormData.codigo, payload);
      if (!res.success) {
        const errorMsg = res.error || 'Não foi possível alterar os dados do cliente.';
        setEditFormError(errorMsg);
        setToastType('error');
        setToastMessage(errorMsg);
        return;
      }

      setIsEditModalOpen(false);
      setToastType('success');
      setToastMessage('Dados do cliente alterados com sucesso.');

      // Recarrega a consulta persistente de clientes para refletir imediatamente a alteração
      await carregarClientes();
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Carregamento de clientes persistidos a partir da API (RF0024 / RNF0011)
  const carregarClientes = useCallback(async (filtro?: ClienteFiltro) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await consultarClientes(filtro);
      if (res.success) {
        setClientsList(res.clientes.map(mapListItemDtoToCustomer));
      } else {
        setApiError(res.error || 'Não foi possível carregar a lista de clientes.');
      }
    } catch {
      setApiError('Falha ao conectar com o servidor para carregar clientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carregamento inicial ao montar o componente
  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  // Executa busca simples baseada no input livre e status
  const aplicarBuscaSimples = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const filtro: ClienteFiltro = {};
    const termo = search.trim();
    if (termo) {
      if (termo.includes('@')) {
        filtro.email = termo;
      } else if (termo.toUpperCase().startsWith('CLI-')) {
        filtro.codigo = termo;
      } else if (termo.replace(/\D/g, '').length >= 4 && !/[a-zA-Z]/.test(termo)) {
        filtro.cpf = termo;
      } else {
        filtro.nome = termo;
      }
    }
    if (statusFilter === 'ATIVO') filtro.ativo = true;
    if (statusFilter === 'INATIVO') filtro.ativo = false;

    carregarClientes(filtro);
  };

  // Executa busca com os campos dos filtros avançados combinados (AND)
  const aplicarFiltrosAvancados = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const filtro: ClienteFiltro = {};
    if (filterCodigo.trim()) filtro.codigo = filterCodigo.trim();
    if (filterNome.trim()) filtro.nome = filterNome.trim();
    if (filterCpf.trim()) filtro.cpf = filterCpf.trim();
    if (filterEmail.trim()) filtro.email = filterEmail.trim();
    if (filterGenero.trim()) filtro.genero = filterGenero.trim();
    if (filterDataNascimento.trim()) {
      filtro.dataNascimento = convertDateBrToIso(filterDataNascimento.trim());
    }
    if (filterTelefone.trim()) filtro.telefone = filterTelefone.trim();
    if (filterAtivo === 'ATIVO') filtro.ativo = true;
    if (filterAtivo === 'INATIVO') filtro.ativo = false;

    carregarClientes(filtro);
  };

  // Limpa todos os filtros e restaura a lista completa de clientes persistidos
  const limparFiltros = () => {
    setSearch('');
    setStatusFilter('TODOS');
    setFilterCodigo('');
    setFilterNome('');
    setFilterCpf('');
    setFilterEmail('');
    setFilterGenero('');
    setFilterDataNascimento('');
    setFilterTelefone('');
    setFilterAtivo('TODOS');
    carregarClientes({});
  };

  const getClientOrdersCount = (customerId: string) => {
    return orders.filter(o => o.customerId === customerId).length;
  };

  const clientOrders = selectedClient
    ? orders.filter(o => o.customerId === selectedClient.id)
    : [];

  const handleOpenAddModal = () => {
    setClientForm(initialFormState);
    setFormError(null);
    setToastMessage(null);
    setIsAddModalOpen(true);
  };

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setToastMessage(null);

    // Validação amigável prévia de UX: confirmação de senha coincide
    if (clientForm.senha !== clientForm.confirmacaoSenha) {
      const msg = 'A confirmação de senha não coincide com a senha digitada.';
      setFormError(msg);
      setToastType('error');
      setToastMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addCustomer(clientForm);
      if (!res.success) {
        const errorMsg = res.error || 'Não foi possível cadastrar o cliente. Verifique os campos destacados.';
        setFormError(errorMsg);
        setToastType('error');
        setToastMessage(errorMsg);
        return;
      }

      setIsAddModalOpen(false);
      setClientForm(initialFormState);
      setFormError(null);
      setToastType('success');
      setToastMessage('Cliente cadastrado com sucesso.');

      // Recarrega a consulta real da API para exibir imediatamente o cliente recém-persistido
      await carregarClientes();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Máscaras de digitação amigáveis
  const handleCpfChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 9) {
      masked = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
    } else if (raw.length > 6) {
      masked = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    } else if (raw.length > 3) {
      masked = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    }
    setClientForm(prev => ({ ...prev, cpf: masked }));
  };

  const handleZipChange = (val: string) => {
    setClientForm(prev => ({
      ...prev,
      initialAddress: { ...prev.initialAddress, zipCode: maskZipCode(val) }
    }));
  };

  const handleBirthDateChange = (val: string) => {
    setClientForm(prev => ({ ...prev, birthDate: maskBirthDate(val) }));
  };

  const handlePhoneNumChange = (val: string) => {
    setClientForm(prev => ({ ...prev, phoneNumber: maskPhoneNumber(val) }));
  };

  // Se houver cliente selecionado, exibe a visão detalhada inline (conforme protótipo)
  if (selectedClient) {
    return (
      <div className="admin-tab-content">
        <div className="detail-navigation">
          <button 
            type="button" 
            onClick={() => setSelectedClient(null)} 
            className="btn-back-link"
          >
            &larr; Voltar a Clientes
          </button>
        </div>

        <div className="admin-client-detail-header">
          <div className="client-avatar">
            {selectedClient.name.charAt(0).toUpperCase()}
          </div>
          <div className="client-name-status-block">
            <h2 className="client-detail-name">{selectedClient.name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`status-badge-inline ${selectedClient.status.toLowerCase()}`}>
                {selectedClient.status}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#777' }}>
                (ID: {selectedClient.id})
              </span>
            </div>
          </div>

          <div className="client-status-toggle-action">
            {selectedClient.status === 'ATIVO' ? (
              <button
                onClick={() => {
                  updateCustomerStatus(selectedClient.id, 'INATIVO');
                  setSelectedClient(prev => prev ? { ...prev, status: 'INATIVO' } : null);
                }}
                className="btn btn-secondary btn-small btn-danger-border"
                type="button"
              >
                Inativar Cadastro
              </button>
            ) : (
              <button
                onClick={() => {
                  updateCustomerStatus(selectedClient.id, 'ATIVO');
                  setSelectedClient(prev => prev ? { ...prev, status: 'ATIVO' } : null);
                }}
                className="btn btn-primary btn-small btn-success-bg"
                type="button"
              >
                Reativar Cadastro
              </button>
            )}
          </div>
        </div>

        <div className="admin-client-detail-grid">
          {/* Dados Pessoais */}
          <div className="detail-card-panel">
            <h4 className="panel-title">DADOS PESSOAIS</h4>
            <div className="panel-rows">
              <div className="panel-row">
                <span className="row-label">Código / ID</span>
                <span className="row-val">{selectedClient.id}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">CPF</span>
                <span className="row-val">{selectedClient.cpf}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">E-mail</span>
                <span className="row-val">{selectedClient.email}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Telefone</span>
                <span className="row-val">
                  {selectedClient.phoneDdd && selectedClient.phoneNumber 
                    ? `(${selectedClient.phoneDdd}) ${selectedClient.phoneNumber} (${selectedClient.phoneType || 'Celular'})` 
                    : `${selectedClient.phone} (${selectedClient.phoneType || 'Celular'})`}
                </span>
              </div>
              <div className="panel-row">
                <span className="row-label">Gênero</span>
                <span className="row-val">{selectedClient.gender}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Nascimento</span>
                <span className="row-val">{selectedClient.birthDate}</span>
              </div>
              <div className="panel-row">
                <span className="row-label">Ranking Numérico</span>
                <span className="row-val" style={{ color: 'var(--color-primary)' }}>★ {selectedClient.ranking ?? 1} (Pontuação base)</span>
              </div>
            </div>
          </div>

          {/* Endereços */}
          <div className="detail-card-panel">
            <h4 className="panel-title">ENDEREÇOS ({selectedClient.addresses.length})</h4>
            <div className="addresses-list">
              {selectedClient.addresses.map(addr => (
                <div key={addr.id} className="addr-block">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="addr-label">{addr.label}</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {addr.isDelivery && (
                        <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(67, 185, 86, 0.15)', color: 'var(--color-success)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-success)' }}>
                          Entrega
                        </span>
                      )}
                      {addr.isBilling && (
                        <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(0, 191, 255, 0.15)', color: '#00bfff', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #00bfff' }}>
                          Cobrança
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="addr-text">
                    {addr.streetType ? `${addr.streetType} ` : ''}{addr.street}, nº {addr.number} {addr.complement && `— ${addr.complement}`} ({addr.residenceType || 'Residencial'})
                  </span>
                  <span className="addr-text" style={{ color: '#aaa', fontSize: '0.8rem' }}>
                    {addr.neighborhood} — {addr.city}/{addr.state} — {addr.country || 'Brasil'}
                  </span>
                  <span className="addr-cep">CEP {addr.zipCode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pedidos do Cliente */}
        <div className="detail-card-panel orders-panel">
          <h4 className="panel-title">PEDIDOS DO CLIENTE ({clientOrders.length})</h4>
          <div className="client-orders-list">
            {clientOrders.length > 0 ? (
              clientOrders.map(order => (
                <div key={order.id} className="client-order-row">
                  <div className="order-row-left">
                    <span className="order-id">{order.id}</span>
                    <span className="order-date">{order.date}</span>
                  </div>
                  <div className="order-row-right">
                    <span className="order-total">
                      {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className={`order-status-tag ${order.status.replace(' ', '_').toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-items-txt">Nenhum pedido realizado.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      <div className="admin-header-row" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <h3 className="admin-tab-title">Gestão de Clientes</h3>
        
        <div className="admin-filters-row" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* Busca Simples */}
          <form onSubmit={aplicarBuscaSimples} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <div className="admin-search-box">
              <input
                type="text"
                placeholder="Buscar por nome, e-mail, CPF ou código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="admin-search-input"
                style={{ minWidth: '240px' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary btn-small"
              disabled={isLoading}
              title="Buscar clientes"
            >
              Buscar
            </button>
          </form>

          {/* Filtro de Situação Cadastral Simples */}
          <select
            value={statusFilter}
            onChange={e => {
              const novo = e.target.value as 'TODOS' | 'ATIVO' | 'INATIVO';
              setStatusFilter(novo);
              setFilterAtivo(novo);
              const filtro: ClienteFiltro = {};
              const termo = search.trim();
              if (termo) {
                if (termo.includes('@')) filtro.email = termo;
                else if (termo.toUpperCase().startsWith('CLI-')) filtro.codigo = termo;
                else if (termo.replace(/\D/g, '').length >= 4 && !/[a-zA-Z]/.test(termo)) filtro.cpf = termo;
                else filtro.nome = termo;
              }
              if (novo === 'ATIVO') filtro.ativo = true;
              if (novo === 'INATIVO') filtro.ativo = false;
              carregarClientes(filtro);
            }}
            className="admin-filter-select"
            aria-label="Filtrar clientes por situação cadastral"
          >
            <option value="TODOS">Status: Todos</option>
            <option value="ATIVO">Apenas Ativos</option>
            <option value="INATIVO">Apenas Inativos</option>
          </select>

          {/* Botão de Toggle Filtros Avançados */}
          <button
            type="button"
            onClick={() => setIsAdvancedFiltersOpen(prev => !prev)}
            className={`btn ${isAdvancedFiltersOpen ? 'btn-primary' : 'btn-secondary'} btn-small`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <span>Filtros Avançados</span>
            <span style={{ fontSize: '0.7rem' }}>{isAdvancedFiltersOpen ? '▲' : '▼'}</span>
          </button>

          {/* Botão de Cadastro de Novo Cliente (RF0021) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            + NOVO CLIENTE
          </button>
        </div>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS (RF0024 / RNF0011) */}
      {isAdvancedFiltersOpen && (
        <div className="admin-advanced-filters-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.3px' }}>
              Filtros Avançados de Clientes
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              Filtros individuais ou combinados
            </span>
          </div>

          <form onSubmit={aplicarFiltrosAvancados}>
            <div className="admin-advanced-filters-grid">
              {/* Código */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-code">Código</label>
                <input
                  id="filter-code"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="Ex: CLI-0001"
                  value={filterCodigo}
                  onChange={e => setFilterCodigo(e.target.value)}
                />
              </div>

              {/* Nome */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-name">Nome</label>
                <input
                  id="filter-name"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="Nome do cliente"
                  value={filterNome}
                  onChange={e => setFilterNome(e.target.value)}
                />
              </div>

              {/* CPF */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-cpf">CPF</label>
                <input
                  id="filter-cpf"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="Com ou sem máscara"
                  value={filterCpf}
                  onChange={e => setFilterCpf(e.target.value)}
                />
              </div>

              {/* E-mail */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-email">E-mail</label>
                <input
                  id="filter-email"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="cliente@email.com"
                  value={filterEmail}
                  onChange={e => setFilterEmail(e.target.value)}
                />
              </div>

              {/* Gênero */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-gender">Gênero</label>
                <select
                  id="filter-gender"
                  className="rw-select adv-filter-input"
                  value={filterGenero}
                  onChange={e => setFilterGenero(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Data de Nascimento */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-birth">Data de Nascimento</label>
                <input
                  id="filter-birth"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="dd/mm/aaaa"
                  value={filterDataNascimento}
                  onChange={e => setFilterDataNascimento(maskBirthDate(e.target.value))}
                  maxLength={10}
                />
              </div>

              {/* Telefone */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-phone">Telefone</label>
                <input
                  id="filter-phone"
                  type="text"
                  className="rw-input adv-filter-input"
                  placeholder="DDD + número ou número"
                  value={filterTelefone}
                  onChange={e => setFilterTelefone(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="rw-form-group" style={{ margin: 0 }}>
                <label className="adv-filter-label" htmlFor="filter-status">Situação Cadastral</label>
                <select
                  id="filter-status"
                  className="rw-select adv-filter-input"
                  value={filterAtivo}
                  onChange={e => setFilterAtivo(e.target.value as 'TODOS' | 'ATIVO' | 'INATIVO')}
                >
                  <option value="TODOS">Todos</option>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn btn-secondary btn-small"
                disabled={isLoading}
              >
                Limpar Filtros
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-small"
                disabled={isLoading}
              >
                {isLoading ? 'Filtrando...' : 'Aplicar Filtros'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABELA DE CLIENTES PERSISTIDOS (RF0024 / RNF0011) */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>CPF</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Pedidos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#aaa', padding: '2.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="rw-spinner" />
                    <span style={{ fontSize: '0.85rem' }}>Carregando clientes...</span>
                  </div>
                </td>
              </tr>
            ) : apiError ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#ff6b6b', padding: '2rem' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{apiError}</div>
                  <button
                    type="button"
                    onClick={() => carregarClientes()}
                    className="btn btn-secondary btn-small"
                  >
                    Tentar novamente
                  </button>
                </td>
              </tr>
            ) : clientsList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '2.5rem' }}>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                    Nenhum cliente encontrado com os filtros selecionados.
                  </p>
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="btn btn-secondary btn-small"
                  >
                    Limpar Filtros
                  </button>
                </td>
              </tr>
            ) : (
              clientsList.map(c => (
                <tr key={c.id}>
                  <td><span style={{ fontSize: '0.78rem', color: '#888' }}>{c.id}</span></td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.cpf}</td>
                  <td>{c.email}</td>
                  <td>
                    <span className={`status-badge ${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>{getClientOrdersCount(c.id)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={() => setSelectedClient(c)}
                        className="btn btn-secondary btn-small"
                        type="button"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="btn btn-primary btn-small"
                        type="button"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Cadastrar Novo Cliente */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setToastMessage(null);
        }}
        title="Cadastrar Novo Cliente"
        className="rw-client-modal"
      >
        <form onSubmit={handleSaveNewClient} className="rw-client-modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', margin: 0 }}>
          {/* Corpo com Rolagem Suave */}
          <div className="rw-client-form-scroll">
            {formError && (
              <div className="rw-form-error-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{formError}</span>
              </div>
            )}

            {/* SEÇÃO 1: DADOS PESSOAIS */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">1</span>
                <h4 className="rw-section-title">Dados Pessoais</h4>
              </div>

              <div className="rw-form-group">
                <label htmlFor="new-name">Nome Completo <span className="rw-req">*</span></label>
                <input
                  type="text"
                  id="new-name"
                  className="rw-input"
                  value={clientForm.name}
                  onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  required
                />
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-cpf">CPF <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-cpf"
                    className="rw-input"
                    value={clientForm.cpf}
                    onChange={e => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-birth">Data de Nascimento <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-birth"
                    className="rw-input"
                    value={clientForm.birthDate}
                    onChange={e => handleBirthDateChange(e.target.value)}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-gender">Gênero <span className="rw-req">*</span></label>
                  <select
                    id="new-gender"
                    className="rw-select"
                    value={clientForm.gender}
                    onChange={e => setClientForm(prev => ({ ...prev, gender: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CONTATO */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">2</span>
                <h4 className="rw-section-title">Contato</h4>
              </div>

              <div className="rw-form-group">
                <label htmlFor="new-email">E-mail <span className="rw-req">*</span></label>
                <input
                  type="email"
                  id="new-email"
                  className="rw-input"
                  value={clientForm.email}
                  onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  required
                />
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1-5">
                  <label htmlFor="new-phone-type">Tipo de Telefone <span className="rw-req">*</span></label>
                  <select
                    id="new-phone-type"
                    className="rw-select"
                    value={clientForm.phoneType}
                    onChange={e => setClientForm(prev => ({ ...prev, phoneType: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Celular">Celular</option>
                    <option value="Fixo">Fixo</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="rw-form-group" style={{ width: '90px', flex: '0 0 90px' }}>
                  <label htmlFor="new-phone-ddd">DDD <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-phone-ddd"
                    className="rw-input"
                    value={clientForm.phoneDdd}
                    onChange={e => setClientForm(prev => ({ ...prev, phoneDdd: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                    placeholder="11"
                    maxLength={2}
                    required
                  />
                </div>
                <div className="rw-form-group flex-2-5">
                  <label htmlFor="new-phone-num">Número do Telefone <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-phone-num"
                    className="rw-input"
                    value={clientForm.phoneNumber}
                    onChange={e => handlePhoneNumChange(e.target.value)}
                    placeholder="98765-4321"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: SEGURANÇA E SENHA DE ACESSO (RN0026, RNF0031, RNF0032) */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">3</span>
                <h4 className="rw-section-title">Segurança de Acesso</h4>
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-password">Senha de Acesso <span className="rw-req">*</span></label>
                  <input
                    type="password"
                    id="new-password"
                    className="rw-input"
                    value={clientForm.senha}
                    onChange={e => setClientForm(prev => ({ ...prev, senha: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', color: '#888' }}>
                    Mínimo 8 caracteres com letras maiúsculas, minúsculas e caractere especial (!, @, #, $, etc.).
                  </small>
                </div>
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-confirm-password">Confirmar Senha <span className="rw-req">*</span></label>
                  <input
                    type="password"
                    id="new-confirm-password"
                    className="rw-input"
                    value={clientForm.confirmacaoSenha}
                    onChange={e => setClientForm(prev => ({ ...prev, confirmacaoSenha: e.target.value }))}
                    placeholder="Repita a senha digitada"
                    required
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: ENDEREÇO PRINCIPAL (RN0021, RN0022, RN0023, RN0026) */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">4</span>
                <h4 className="rw-section-title">Endereço Principal</h4>
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-addr-label">Identificação do Endereço <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-addr-label"
                    className="rw-input"
                    value={clientForm.initialAddress.label}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, label: e.target.value }
                    }))}
                    placeholder="Ex: Minha Casa, Trabalho"
                    required
                  />
                </div>
                <div className="rw-form-group flex-1">
                  <label htmlFor="new-res-type">Tipo de Residência <span className="rw-req">*</span></label>
                  <select
                    id="new-res-type"
                    className="rw-select"
                    value={clientForm.initialAddress.residenceType}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, residenceType: e.target.value }
                    }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Casa">Casa</option>
                    <option value="Apartamento">Apartamento</option>
                    <option value="Sobrado">Sobrado</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group" style={{ flex: '1', maxWidth: '170px', minWidth: '130px' }}>
                  <label htmlFor="new-street-type">Tipo <span className="rw-req">*</span></label>
                  <select
                    id="new-street-type"
                    className="rw-select"
                    value={clientForm.initialAddress.streetType}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, streetType: e.target.value }
                    }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Rua">Rua</option>
                    <option value="Avenida">Avenida</option>
                    <option value="Alameda">Alameda</option>
                    <option value="Praça">Praça</option>
                    <option value="Travessa">Travessa</option>
                    <option value="Rodovia">Rodovia</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="rw-form-group flex-3">
                  <label htmlFor="new-street">Logradouro <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-street"
                    className="rw-input"
                    value={clientForm.initialAddress.street}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, street: e.target.value }
                    }))}
                    placeholder="Nome da rua / avenida"
                    required
                  />
                </div>
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group" style={{ flex: '1', maxWidth: '140px', minWidth: '100px' }}>
                  <label htmlFor="new-number">Número <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-number"
                    className="rw-input"
                    value={clientForm.initialAddress.number}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, number: e.target.value }
                    }))}
                    placeholder="123"
                    required
                  />
                </div>
                <div className="rw-form-group flex-3">
                  <label htmlFor="new-comp">Complemento</label>
                  <input
                    type="text"
                    id="new-comp"
                    className="rw-input"
                    value={clientForm.initialAddress.complement}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, complement: e.target.value }
                    }))}
                    placeholder="Apto, Bloco (opcional)"
                  />
                </div>
              </div>

              <div className="rw-form-group">
                <label htmlFor="new-neigh">Bairro <span className="rw-req">*</span></label>
                <input
                  type="text"
                  id="new-neigh"
                  className="rw-input"
                  value={clientForm.initialAddress.neighborhood}
                  onChange={e => setClientForm(prev => ({
                    ...prev,
                    initialAddress: { ...prev.initialAddress, neighborhood: e.target.value }
                  }))}
                  placeholder="Bairro"
                  required
                />
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1-5">
                  <label htmlFor="new-zip">CEP <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-zip"
                    className="rw-input"
                    value={clientForm.initialAddress.zipCode}
                    onChange={e => handleZipChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    required
                  />
                </div>
                <div className="rw-form-group flex-2-5">
                  <label htmlFor="new-city">Cidade <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-city"
                    className="rw-input"
                    value={clientForm.initialAddress.city}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, city: e.target.value }
                    }))}
                    placeholder="Cidade"
                    required
                  />
                </div>
                <div className="rw-form-group flex-2">
                  <label htmlFor="new-state">Estado <span className="rw-req">*</span></label>
                  <select
                    id="new-state"
                    className="rw-select"
                    value={clientForm.initialAddress.state}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, state: e.target.value }
                    }))}
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

              <div className="rw-form-group">
                <label htmlFor="new-country">País</label>
                <input
                  type="text"
                  id="new-country"
                  className="rw-input"
                  value="Brasil"
                  readOnly
                  autoComplete="off"
                  tabIndex={-1}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'default', color: '#ccc' }}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', color: '#888' }}>
                  Atendimento fixo em território nacional.
                </small>
              </div>

              <div className="rw-form-group">
                <label htmlFor="new-obs">Observações</label>
                <textarea
                  id="new-obs"
                  rows={3}
                  className="rw-textarea"
                  value={clientForm.initialAddress.observations}
                  onChange={e => setClientForm(prev => ({
                    ...prev,
                    initialAddress: { ...prev.initialAddress, observations: e.target.value }
                  }))}
                  placeholder="Instruções de entrega, pontos de referência... (opcional)"
                />
              </div>

              {/* Finalidades do Endereço Principal */}
              <div className="rw-purpose-box" style={{ padding: '0.85rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span className="rw-purpose-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#bbb' }}>
                  Finalidades deste endereço principal:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#eee', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                    ✓ Residencial
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(67, 185, 86, 0.15)', color: 'var(--color-success, #43b956)', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(67, 185, 86, 0.3)' }}>
                    ✓ Entrega
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(0, 191, 255, 0.15)', color: '#00bfff', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(0, 191, 255, 0.3)' }}>
                    ✓ Cobrança
                  </span>
                </div>
                <small style={{ display: 'block', marginTop: '0.45rem', fontSize: '0.73rem', color: '#888' }}>
                  No cadastro inicial, este endereço é configurado automaticamente como residencial, entrega e cobrança.
                </small>
              </div>
            </div>
          </div>

          {/* Rodapé Fixo */}
          <div className="rw-modal-footer">
            <button
              type="button"
              className="btn btn-secondary rw-btn-cancel"
              disabled={isSubmitting}
              onClick={() => {
                setIsAddModalOpen(false);
                setToastMessage(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary rw-btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'CADASTRANDO...' : 'CADASTRAR CLIENTE'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Alterar Cliente (RF0022) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditFormError(null);
        }}
        title="Editar Cliente"
        className="rw-client-modal"
      >
        <form onSubmit={handleSaveEditClient} className="rw-client-modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', margin: 0 }}>
          <div className="rw-client-form-scroll">
            {editFormError && (
              <div className="rw-form-error-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{editFormError}</span>
              </div>
            )}

            {/* SEÇÃO 1: IDENTIFICAÇÃO E DADOS BÁSICOS */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">1</span>
                <h4 className="rw-section-title">Identificação do Cliente</h4>
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1">
                  <label htmlFor="edit-code">Código do Cliente</label>
                  <input
                    type="text"
                    id="edit-code"
                    className="rw-input"
                    value={editFormData.codigo}
                    readOnly
                    autoComplete="off"
                    tabIndex={-1}
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'default', color: '#aaa' }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', color: '#888' }}>
                    Identificador único gerado no cadastro (somente leitura).
                  </small>
                </div>

                <div className="rw-form-group flex-1">
                  <label htmlFor="edit-cpf">CPF</label>
                  <input
                    type="text"
                    id="edit-cpf"
                    className="rw-input"
                    value={editFormData.cpf}
                    readOnly
                    autoComplete="off"
                    tabIndex={-1}
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'default', color: '#aaa' }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', color: '#888' }}>
                    Documento fixo do cliente (somente leitura).
                  </small>
                </div>
              </div>

              <div className="rw-form-group">
                <label htmlFor="edit-name">Nome Completo <span className="rw-req">*</span></label>
                <input
                  type="text"
                  id="edit-name"
                  className="rw-input"
                  value={editFormData.name}
                  onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  required
                />
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1">
                  <label htmlFor="edit-birth">Data de Nascimento <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="edit-birth"
                    className="rw-input"
                    value={editFormData.birthDate}
                    onChange={e => setEditFormData(prev => ({ ...prev, birthDate: maskBirthDate(e.target.value) }))}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="rw-form-group flex-1">
                  <label htmlFor="edit-gender">Gênero <span className="rw-req">*</span></label>
                  <select
                    id="edit-gender"
                    className="rw-select"
                    value={editFormData.gender}
                    onChange={e => setEditFormData(prev => ({ ...prev, gender: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CONTATO */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">2</span>
                <h4 className="rw-section-title">Contato</h4>
              </div>

              <div className="rw-form-group">
                <label htmlFor="edit-email">E-mail <span className="rw-req">*</span></label>
                <input
                  type="email"
                  id="edit-email"
                  className="rw-input"
                  value={editFormData.email}
                  onChange={e => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  required
                />
              </div>

              <div className="rw-form-row">
                <div className="rw-form-group flex-1-5">
                  <label htmlFor="edit-phone-type">Tipo de Telefone <span className="rw-req">*</span></label>
                  <select
                    id="edit-phone-type"
                    className="rw-select"
                    value={editFormData.phoneType}
                    onChange={e => setEditFormData(prev => ({ ...prev, phoneType: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Celular">Celular</option>
                    <option value="Fixo">Fixo</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="rw-form-group" style={{ width: '90px', flex: '0 0 90px' }}>
                  <label htmlFor="edit-phone-ddd">DDD <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="edit-phone-ddd"
                    className="rw-input"
                    value={editFormData.phoneDdd}
                    onChange={e => setEditFormData(prev => ({ ...prev, phoneDdd: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                    placeholder="11"
                    maxLength={2}
                    required
                  />
                </div>
                <div className="rw-form-group flex-2-5">
                  <label htmlFor="edit-phone-num">Número do Telefone <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="edit-phone-num"
                    className="rw-input"
                    value={editFormData.phoneNumber}
                    onChange={e => setEditFormData(prev => ({ ...prev, phoneNumber: maskPhoneNumber(e.target.value) }))}
                    placeholder="98765-4321"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé Fixo */}
          <div className="rw-modal-footer">
            <button
              type="button"
              className="btn btn-secondary rw-btn-cancel"
              disabled={isEditSubmitting}
              onClick={() => {
                setIsEditModalOpen(false);
                setEditFormError(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary rw-btn-submit" disabled={isEditSubmitting}>
              {isEditSubmitting ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast de Notificação Imediata */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
