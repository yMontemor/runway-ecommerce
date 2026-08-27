import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/Modal/Modal';
import Toast from '../../../components/Toast/Toast';
import type { Customer, NewCustomerInput } from '../../../types';
import { maskBirthDate, maskPhoneNumber, maskZipCode } from '../../../utils/maskAndValidate';

export default function AdminClients() {
  const { customers, orders, updateCustomerStatus, addCustomer } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVO' | 'INATIVO'>('TODOS');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

  // Controle do Modal de Cadastro de Novo Cliente (RF0021)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const initialFormState: NewCustomerInput = {
    name: '',
    email: '',
    cpf: '',
    gender: 'Feminino',
    birthDate: '',
    phoneType: 'Celular',
    phoneDdd: '11',
    phoneNumber: '',
    initialAddress: {
      label: 'Minha Casa',
      residenceType: 'Casa',
      streetType: 'Rua',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      zipCode: '',
      city: '',
      state: 'SP',
      country: 'Brasil',
      observations: '',
      isDelivery: true,
      isBilling: true
    }
  };

  const [clientForm, setClientForm] = useState<NewCustomerInput>(initialFormState);

  // Filtragem combinada de clientes (Busca textual AND Filtro de Status) - RF0024
  const filteredClients = customers.filter(c => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      c.id.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.cpf.includes(term);

    const matchesStatus =
      statusFilter === 'TODOS' ? true : c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getClientOrdersCount = (customerId: string) => {
    return orders.filter(o => o.customerId === customerId).length;
  };

  const clientOrders = selectedClient
    ? orders.filter(o => o.customerId === selectedClient.id)
    : [];

  const handleOpenAddModal = () => {
    setClientForm(initialFormState);
    setFormError(null);
    setToastError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setToastError(null);

    const res = addCustomer(clientForm);
    if (!res.success) {
      const errorMsg = res.error || 'Não foi possível cadastrar o cliente. Verifique os campos destacados.';
      setFormError(errorMsg);
      setToastError(errorMsg);
      return;
    }

    setIsAddModalOpen(false);
    setClientForm(initialFormState);
    setToastError(null);
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
      <div className="admin-header-row">
        <h3 className="admin-tab-title">Gestão de Clientes</h3>
        
        <div className="admin-filters-row">
          {/* Campo de Busca Livre (Nome, CPF ou E-mail) */}
          <div className="admin-search-box">
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="admin-search-input"
            />
          </div>

          {/* Filtro por Status (RF0024) */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'TODOS' | 'ATIVO' | 'INATIVO')}
            className="admin-filter-select"
            aria-label="Filtrar clientes por status"
          >
            <option value="TODOS">Status: Todos</option>
            <option value="ATIVO">Apenas Ativos</option>
            <option value="INATIVO">Apenas Inativos</option>
          </select>

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
            {filteredClients.map(c => (
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
                  <button 
                    onClick={() => setSelectedClient(c)}
                    className="btn btn-secondary btn-small"
                    type="button"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Nenhum cliente encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Cadastrar Novo Cliente */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setToastError(null);
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

            {/* SEÇÃO 3: ENDEREÇO */}
            <div className="rw-form-section">
              <div className="rw-section-header">
                <span className="rw-section-badge">3</span>
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
                <div className="rw-form-group" style={{ width: '90px', flex: '0 0 90px' }}>
                  <label htmlFor="new-state">Estado <span className="rw-req">*</span></label>
                  <input
                    type="text"
                    id="new-state"
                    className="rw-input"
                    value={clientForm.initialAddress.state}
                    onChange={e => setClientForm(prev => ({
                      ...prev,
                      initialAddress: { ...prev.initialAddress, state: e.target.value.toUpperCase() }
                    }))}
                    placeholder="UF"
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div className="rw-form-group">
                <label htmlFor="new-country">País <span className="rw-req">*</span></label>
                <input
                  type="text"
                  id="new-country"
                  className="rw-input"
                  value={clientForm.initialAddress.country}
                  onChange={e => setClientForm(prev => ({
                    ...prev,
                    initialAddress: { ...prev.initialAddress, country: e.target.value }
                  }))}
                  placeholder="Brasil"
                  required
                />
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

              {/* Finalidades do Endereço */}
              <div className="rw-purpose-box">
                <span className="rw-purpose-label">Usar este endereço para:</span>
                <div className="rw-purpose-options">
                  <label className="rw-checkbox-label">
                    <input
                      type="checkbox"
                      checked={clientForm.initialAddress.isDelivery}
                      onChange={e => setClientForm(prev => ({
                        ...prev,
                        initialAddress: { ...prev.initialAddress, isDelivery: e.target.checked }
                      }))}
                    />
                    <span>Entrega</span>
                  </label>
                  <label className="rw-checkbox-label">
                    <input
                      type="checkbox"
                      checked={clientForm.initialAddress.isBilling}
                      onChange={e => setClientForm(prev => ({
                        ...prev,
                        initialAddress: { ...prev.initialAddress, isBilling: e.target.checked }
                      }))}
                    />
                    <span>Cobrança</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé Fixo */}
          <div className="rw-modal-footer">
            <button
              type="button"
              className="btn btn-secondary rw-btn-cancel"
              onClick={() => {
                setIsAddModalOpen(false);
                setToastError(null);
              }}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn btn-primary rw-btn-submit">
              CADASTRAR CLIENTE
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast de Notificação Imediata */}
      <Toast
        message={toastError}
        type="error"
        onClose={() => setToastError(null)}
      />
    </div>
  );
}
