/// <reference types="cypress" />

export interface ClientePrincipalInfo {
  codigo: string;
  id: number;
  nome: string;
  email: string;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Localiza dinamicamente o cliente principal do seed via API real (GET /api/clientes)
       * buscando pelo e-mail estável da Ana Carolina Silva (ana.silva@email.com).
       * Retorna o código gerado pela sequence (ex: CLI-1048) e o ID numérico correspondente.
       */
      obterClientePrincipal(email?: string): Chainable<ClientePrincipalInfo>;
    }
  }
}

Cypress.Commands.add('obterClientePrincipal', (email = 'ana.silva@email.com') => {
  const apiUrl = 'http://localhost:5035';
  
  return cy.request<any[]>('GET', `${apiUrl}/api/clientes`).then((response) => {
    expect(response.status).to.eq(200);
    const clientes = response.body;
    const cliente = clientes.find((c) => c.email?.toLowerCase() === email.toLowerCase());

    if (!cliente) {
      throw new Error(
        `Cliente do seed com e-mail "${email}" não foi encontrado no endpoint GET /api/clientes. ` +
        `Certifique-se de executar o seed antes dos testes.`
      );
    }

    const numericId = cliente.id ?? parseInt(cliente.codigo.replace(/\D/g, ''), 10);

    return {
      codigo: cliente.codigo as string,
      id: numericId,
      nome: cliente.nome as string,
      email: cliente.email as string
    };
  });
});
