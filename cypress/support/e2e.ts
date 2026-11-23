// cypress/support/e2e.ts
// Arquivo de suporte Cypress para a suíte E2E do RunWay
// Preserva tratamento padrão de exceções sem mascarar erros reais da aplicação.
import './commands';

before(() => {
  cy.request({
    url: 'http://localhost:5035/api/health',
    failOnStatusCode: false
  }).then((res) => {
    if (res.status !== 200) {
      throw new Error(`[BLOQUEIO DE SEGURANÇA CYPRESS] Backend inacessível em http://localhost:5035/api/health (Status: ${res.status}). Abortando testes.`);
    }
    if (res.body?.banco !== 'runway_test') {
      throw new Error(`[BLOQUEIO DE SEGURANÇA CYPRESS] Backend está conectado a "${res.body?.banco}". Os testes exigem conexão obrigatória com "runway_test". Abortando testes para evitar contaminação do banco principal.`);
    }
  });
});

