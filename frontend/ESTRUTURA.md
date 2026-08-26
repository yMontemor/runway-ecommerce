# Guia de Estrutura de Pastas e Código do Frontend (Runway E-commerce)

Este documento foi criado para ajudar nos seus estudos sobre o frontend da aplicação **Runway E-commerce**. O projeto é construído sobre a biblioteca **React**, utilizando **TypeScript**, **Vite** como empacotador de desenvolvimento rápido, e **React Router** para roteamento de página única (SPA).

---

## 📂 Visão Geral da Estrutura de Diretórios

Abaixo está o mapeamento completo do diretório do frontend:

```text
runway-ecommerce/frontend/
├── dist/                          # Build de produção otimizado (gerado pelo Vite)
├── node_modules/                  # Dependências de pacotes instaladas (npm/yarn)
├── public/                        # Arquivos estáticos servidos diretamente (ícones, imagens globais)
│   └── images/                    # Imagens dos calçados do catálogo e banners
├── src/                           # Código-fonte principal da aplicação
│   ├── assets/                    # Recursos estáticos importados no código (imagens, SVGs)
│   ├── components/                # Componentes React reutilizáveis e modulares
│   │   ├── Badge/                 # Componente de selo informativo ("Novo", "Promoção")
│   │   ├── Button/                # Componente de botão estilizado genérico
│   │   ├── Chatbot/               # Componente do assistente virtual interativo
│   │   ├── Header/                # Cabeçalho global de navegação e controle de cliente ativo
│   │   ├── Modal/                 # Componente de janela modal customizada
│   │   ├── OrderDetailsModal/     # Modal detalhado de pedidos (itens, status, cupons e parcelamento)
│   │   └── ProductCard/           # Cartão de exibição rápida de produtos no catálogo/home
│   ├── data/                      # Dados mockados estruturados (simulação do banco de dados)
│   │   ├── analytics.ts           # Dados históricos de vendas para gráficos administrativos
│   │   ├── coupons.ts             # Cupons de desconto promocionais e cupons de troca cadastrados
│   │   ├── customers.ts           # Cadastro de clientes com endereços e cartões de crédito
│   │   └── products.ts            # Catálogo completo de tênis de corrida com especificações técnicas
│   ├── pages/                     # Páginas da aplicação (telas mapeadas pelas rotas)
│   │   ├── Admin/                 # Painel do Administrador (Gestão de clientes, pedidos, trocas e gráficos)
│   │   ├── Cart/                  # Tela do carrinho de compras do cliente
│   │   ├── Catalog/               # Tela de listagem e filtragem avançada de produtos (tênis)
│   │   ├── Checkout/              # Fluxo de finalização de compra (endereço, multi-cartões, parcelamento, cupons)
│   │   ├── CustomerArea/          # Área do Cliente (Perfil, endereços, cartões cadastrados e histórico de pedidos)
│   │   ├── Home/                  # Página inicial com banners promocionais e destaques
│   │   └── ProductDetail/         # Tela de detalhes técnicos e seleção de tamanho do calçado
│   ├── store/                     # Gerenciamento de Estado Global da Aplicação
│   │   └── AppContext.tsx         # React Context API para simular as operações de backend
│   ├── styles/                    # Folhas de estilo compartilhadas
│   │   └── global.css             # Estilos de reset, variáveis CSS, cores e layout base
│   ├── types/                     # Declarações de Tipagem TypeScript
│   │   └── index.ts               # Interfaces estruturais de dados (Product, Customer, Order, etc.)
│   ├── utils/                     # Funções utilitárias e regras de negócio auxiliares
│   │   └── payment.ts             # Cálculo de parcelamento (até 6x sem juros), limites e formatação
│   ├── App.tsx                    # Componente raiz que configura rotas globais e Context Provider
│   └── main.tsx                   # Ponto de entrada do script para renderização no DOM do navegador
├── eslint.config.js               # Configurações de análise estática de código (ESLint)
├── index.html                     # Estrutura HTML principal da SPA
├── package.json                   # Scripts do projeto e lista de dependências
├── tsconfig.json                  # Configuração base do TypeScript
├── tsconfig.app.json              # Configurações TypeScript focadas na aplicação web
├── tsconfig.node.json             # Configurações TypeScript para ferramentas node (ex: Vite config)
└── vite.config.ts                 # Configurações de compilação do Vite
```

---

## 🛠️ Detalhes dos Arquivos de Configuração

- **`package.json`**: Contém os metadados da aplicação, os scripts de execução (ex: `npm run dev` para iniciar o servidor local e `npm run build` para compilar para produção) e as dependências (React, React Router DOM, Lucide Icons para ícones, etc.).
- **`vite.config.ts`**: Define as diretivas do empacotador Vite, como plugins (ex: `@vitejs/plugin-react`) e portas do servidor de desenvolvimento.
- **`tsconfig.json` & `tsconfig.app.json`**: Definem regras de compilação do TypeScript para garantir a segurança de tipos no código React e suporte a recursos modernos de JavaScript.
- **`index.html`**: A página HTML de entrada única. Contém uma `div` com ID `root`, onde a aplicação React é montada dinamicamente via JavaScript.

---

## 🧠 Arquivos Principais de Entrada (`src/`)

### 🔗 [`src/main.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/main.tsx)
- **Objetivo**: Inicializar a aplicação React. Ele busca a div `#root` no `index.html` e injeta o componente principal `<App />` envelopado no `<StrictMode>` (para ajudar a identificar efeitos colaterais indesejados durante o desenvolvimento). Também importa as regras CSS globais.

### 🔗 [`src/App.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/App.tsx)
- **Objetivo**: Atuar como o roteador central e provedor de contexto da aplicação.
- **Como funciona**:
  - Configura o `<AppProvider>` para que todos os componentes filhos tenham acesso ao estado global.
  - Define as rotas usando o `react-router-dom`:
    - `/` -> Página Inicial (`Home`)
    - `/catalogo` -> Listagem (`Catalog`)
    - `/produto/:id` -> Detalhes do Produto (`ProductDetail`)
    - `/carrinho` -> Carrinho (`Cart`)
    - `/checkout` -> Pagamento (`Checkout`)
    - `/cliente` -> Histórico e Perfil (`CustomerArea`)
    - `/admin` -> Painel Administrativo (`Admin`)
  - Contém o componente `<ScrollToTop />` que rola a página de volta ao topo de forma automática sempre que o usuário navega para uma nova URL.
  - Exibe o `<Chatbot />` flutuante em todas as telas.

--- 

## 💾 Camada de Dados e Modelagem (`src/types/` e `src/data/`)

### 🔗 [`src/types/index.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/types/index.ts)
- **Objetivo**: Centralizar as regras e interfaces de tipagem do TypeScript. Garante a integridade de dados e autocompleta atributos no editor.
- **Principais Tipos**:
  - `Product`: Define a estrutura de um calçado (nome, preço, drop, peso, categorias, tamanhos disponíveis, tecnologias).
  - `Customer`: Detalhes cadastrais do cliente (endereço, CPF, telefone, cartões).
  - `Address` e `CreditCard`: Estruturas de suporte a dados do cliente e checkout.
  - `Order`: Representa um pedido com status de entrega, cupons aplicados, múltiplos cartões com parcelas (`paymentMethods: { cardId, amount, installments? }[]`) e status de troca.
  - `Exchange`: Registro administrativo de solicitações de troca de produtos.

### 📂 Diretório `src/data/` (Simuladores de Banco de Dados)
- **[`products.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/data/products.ts)**: Catálogo estruturado de calçados de corrida (Nike, Adidas, Saucony, Olympikus, Asics, Salomon, etc.) com atributos técnicos de drop, peso, categorias e tecnologias.
- **[`customers.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/data/customers.ts)**: Lista inicial de clientes de teste pré-cadastrados (ex: Ana Carolina, Carlos Roberto, Maria Oliveira).
- **[`coupons.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/data/coupons.ts)**: Cupons de desconto promocionais e créditos de troca pré-configurados.
- **[`analytics.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/data/analytics.ts)**: Dados de simulação de vendas mensais segmentadas por tipo de tênis para preenchimento de gráficos do painel administrativo.

---

## ⚙️ Camada de Utilitários (`src/utils/`)

### 🔗 [`src/utils/payment.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/utils/payment.ts)
- **Objetivo**: Centralizar as regras de cálculo, validação e formatação de parcelamento de compras por cartão de crédito.
- **Regras Implementadas**:
  - **Parcelamento até 6x sem juros**: Decisão de negócio implementada no protótipo RunWay.
  - **Parcela mínima de R$ 10,00**: Determina dinamicamente a quantidade máxima de parcelas via `getMaxInstallments(amount)`.
  - **Exceção RN0035**: Quando o saldo residual pago no cartão após cupom for inferior a R$ 10,00, a transação fica restrita obrigatoriamente a **1x à vista**.
  - **`getInstallmentOptions(amount)`**: Gera a lista de opções prontas para o `<select>` de parcelas no checkout.
  - **`formatInstallmentsLabel(amount, installments)`**: Formata textos amigáveis de apresentação sem alterar o total financeiro oficial (`amount`).

---

## 🏪 Estado Global da Aplicação (`src/store/`)

### 🔗 [`src/store/AppContext.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/store/AppContext.tsx)
- **Objetivo**: Este é o **coração lógico** do frontend na ausência de uma API/Backend ativa. Ele gerencia o estado da aplicação em memória utilizando o React Context API e expõe dados e funções globais para todos os componentes.
- **Responsabilidades**:
  - **Usuário Ativo**: Guarda quem é o cliente logado no momento (`activeCustomer`) e permite alternar entre os perfis simulados para ver compras sob diferentes óticas.
  - **Carrinhos Independentes**: Mantém uma lista de itens no carrinho separada por ID de cliente (`cartsByCustomer`).
  - **Operações de Carrinho**: Funções como `addToCart`, `updateCartQuantity` e `removeFromCart`.
  - **Fluxo de Compra (`checkoutCart`)**: Processa a compra, valida a distribuição de pagamentos entre múltiplos cartões com suas respectivas parcelas, aplica cupons de desconto/troca (gerando novo cupom para saldo excedente se houver), grava o pedido `Order` e esvazia o carrinho.
  - **Cancelamento e Estorno (`cancelOrder`)**: Permite cancelar pedidos em aberto, gerando novo cupom de ressarcimento para trocas consumidas e registrando o estorno financeiro consolidado nos cartões de crédito.
  - **Gestão de Pedidos e Trocas**: Confirmar recebimento pelo cliente, solicitar troca de itens específicos com motivo, aprovar/negar trocas no painel administrativo e gerar cupons de reembolso de forma automatizada.
  - **Dados de Cadastro**: Funções completas para adicionar, editar e remover endereços e cartões de crédito dos usuários.

---

## 🧩 Componentes Reutilizáveis (`src/components/`)

Os componentes nesta pasta são pedaços de interface que não pertencem a apenas uma página, mas são utilizados em múltiplos locais do sistema.

### 🔗 [`Badge/Badge.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Badge/Badge.tsx)
- **Objetivo**: Renderizar um pequeno selo estilizado (ex: "Novo") que sinaliza novidades nos calçados.

### 🔗 [`Button/Button.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Button/Button.tsx)
- **Objetivo**: Um botão com estilizações customizáveis padronizadas no CSS global.

### 🔗 [`Header/Header.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Header/Header.tsx)
- **Objetivo**: Exibir a barra de navegação superior contendo o logotipo do e-commerce, links para o catálogo, carrinho com contador de itens, link para a Área do Cliente e Painel do Admin.
- **Destaque**: Contém um seletor visual que permite trocar instantaneamente o cliente ativo, facilitando testes de diferentes perfis cadastrados no sistema.

### 🔗 [`Modal/Modal.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Modal/Modal.tsx)
- **Objetivo**: Caixa de diálogo genérica sobreposta à tela com título, botão de fechamento e conteúdo customizável.

### 🔗 [`OrderDetailsModal/OrderDetailsModal.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/OrderDetailsModal/OrderDetailsModal.tsx)
- **Objetivo**: Modal centralizado e compartilhado para exibição minuciosa de qualquer pedido.
- **Recursos**: Apresenta lista de itens comprados, endereço de entrega selecionado, cupons aplicados, formas de pagamento com identificação de bandeira/final do cartão e **detalhamento das parcelas utilizadas** (ex: `3x de R$ 200,00 sem juros`), além do resumo financeiro completo. Utilizado tanto na **Área do Cliente** quanto no **Painel Admin**.

### 🔗 [`ProductCard/ProductCard.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/ProductCard/ProductCard.tsx)
- **Objetivo**: Exibir as informações básicas de um calçado em grades (como na Home e Catálogo).
- **Recursos**: Apresenta a imagem do calçado, marca, nome, peso, preço formatado, tags de categoria de forma condensada, listagem dos primeiros tamanhos disponíveis (ex: `38 39 40 +2`) e botões rápidos para visualizar detalhes ou adicionar direto ao carrinho.

### 📂 [`Chatbot/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Chatbot)
Este é um recurso robusto de atendimento simulado.
- **`Chatbot.tsx`**: Interface do usuário flutuante (ícone no canto inferior direito que se expande para uma janela de bate-papo com histórico de mensagens).
- **`chatbotEngine.ts`**: O mecanismo inteligente por trás das respostas. Trata-se de uma máquina de estados orientada a regras que:
  - Analisa o texto escrito pelo usuário (usando expressões regulares e tokenização).
  - Extrai intenções como: tamanho de calçado (ex: "calço 41"), faixa de preço máxima (ex: "até 800 reais"), e tipo de corrida (ex: "tênis para trilha" ou "para maratona").
  - Mantém o contexto de conversa ativo e faz perguntas automáticas caso informações essenciais estejam faltando para sugerir o calçado ideal.

---

## 🖥️ Páginas da Aplicação (`src/pages/`)

Cada subpasta nesta seção representa uma página inteira renderizada pelo roteador.

### 📂 [`Home/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Home)
- **Objetivo**: Página de entrada. Contém um banner principal com chamadas comerciais e uma seção exibindo calçados em destaque no catálogo.

### 📂 [`Catalog/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Catalog)
- **Objetivo**: O catálogo de compras com filtros avançados de busca.
- **Recursos**:
  - Barra de busca textual.
  - Filtro múltiplo por categoria (ex: Treino Diário, Longa Distância, Velocidade, Competição, Trail).
  - Filtro por marca (Nike, Adidas, Saucony, Olympikus, etc.).
  - Filtro por tamanho de calçado (exibe apenas modelos com estoque disponível na numeração escolhida).
  - Filtro por faixa de preço.
  - Ordenação por preço (crescente/decrescente) ou relevância.

### 📂 [`ProductDetail/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/ProductDetail)
- **Objetivo**: Apresentar os detalhes minuciosos de um calçado selecionado.
- **Recursos**: Exibe imagens em alta definição, especificações técnicas detalhadas (drop, peso, tecnologias de amortecimento) e uma grade interativa de tamanhos com validação de numeração obrigatória para compra ou adição ao carrinho.

### 📂 [`Cart/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Cart)
- **Objetivo**: Gerenciar a pré-compra.
- **Recursos**: Lista todos os tênis inseridos com seus respectivos tamanhos selecionados, subtotal individual, controle para aumentar/diminuir quantidades ou remover itens, e a somatória final de valores direcionando o usuário ao checkout.

### 📂 [`Checkout/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Checkout)
- **Objetivo**: Fluxo crítico de processamento e fechamento de pedidos em 4 etapas estruturadas:
  1. **Etapa 1 (Endereço)**: Seleção de endereço cadastrado, cadastro de novo endereço ou edição inline via modal.
  2. **Etapa 2 (Pagamento & Cupons)**:
     - Aplicação de cupons promocionais (% OFF) e cupons de troca (créditos de valor fixo).
     - Suporte a pagamento 100% por cupom de troca (dispensando cartões).
     - Divisão de pagamento entre múltiplos cartões de crédito simultâneos (com botões "Usar Restante" e "Distribuir Igualmente").
     - **Parcelamento por Cartão**: Seleção individual de parcelamento em até 6x sem juros (mínimo de R$ 10,00 por parcela), adaptado ao valor distribuído em cada cartão.
     - Validação estrita de regras de negócio (RN0034 de valor mínimo e RN0035 para resíduos após cupons).
  3. **Etapa 3 (Revisão)**: Exibição detalhada de itens, endereço e formas de pagamento com as parcelas escolhidas por cartão.
  4. **Etapa 4 (Confirmado)**: Tela de sucesso com código do pedido e resumo financeiro.

### 📂 [`CustomerArea/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/CustomerArea)
- **Objetivo**: Centralizar as ações do usuário logado.
- **Recursos**:
  - **Dados Pessoais**: Visualização e alteração de cadastro.
  - **Endereços e Cartões**: Formulários de gerenciamento de múltiplos cartões e endereços de entrega.
  - **Pedidos**: Linha do tempo dos pedidos com status (Aberto, Em Processamento, Entregue, Cancelado), botão para abrir o modal de detalhes completos (com parcelamento), confirmação de recebimento pessoal, cancelamento de pedidos e solicitação de troca por item.

### 📂 [`Admin/`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Admin)
- **Objetivo**: Painel de gerenciamento corporativo da loja.
- **Componentes Administrativos**:
  - **`AdminClients.tsx`**: Tabela com dados de todos os clientes, permitindo inativação e reativação.
  - **`AdminOrders.tsx`**: Acompanhamento e alteração de status dos pedidos dos clientes, com visualização de detalhes completos e parcelas no modal compartilhado.
  - **`AdminExchanges.tsx`**: Gestão completa do ciclo de troca (aprovação, recebimento de item devolvido e processamento com geração de cupom de reembolso).
  - **`AdminAnalytics.tsx`**: Gráficos e estatísticas de vendas acumuladas por período e categoria de calçados.

---

## 🎨 Estilização (`src/styles/`)

### 🔗 [`src/styles/global.css`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/styles/global.css)
- **Objetivo**: Centralizar o design system visual. Define as variáveis CSS (cores primárias neon, fundos escuros, bordas, fontes Outfit e Inter) e estilizações fundamentais.
- **Padrão Utilizado**: Cada página ou componente possui seu próprio arquivo `.css` local adjacente para regras de escopo local, facilitando a manutenção e a legibilidade dos elementos.

---

## 💡 Dicas de Estudo

Para compreender a fundo o funcionamento deste frontend, recomendamos seguir este fluxo de depuração visual e leitura de código:
1. **Entenda os Dados**: Abra [`src/types/index.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/types/index.ts) para entender as regras estruturais e o que cada objeto representa.
2. **Entenda o Estado**: Estude [`src/store/AppContext.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/store/AppContext.tsx). Veja como os dados mockados são carregados e quais funções atualizam o estado (como a adição ao carrinho, parcelamento e processamento de pagamentos).
3. **Entenda as Regras de Pagamento**: Inspecione [`src/utils/payment.ts`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/utils/payment.ts) para ver as funções de cálculo e limites de parcelas.
4. **Mapeie os Componentes**: Veja como o [`Header`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/Header/Header.tsx), os [`ProductCard`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/ProductCard/ProductCard.tsx) e o [`OrderDetailsModal`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/components/OrderDetailsModal/OrderDetailsModal.tsx) usam os dados globais obtidos via `useApp()`.
5. **Navegue pelas Rotas**: Verifique no arquivo [`App.tsx`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/App.tsx) como as páginas são roteadas e explore a página [`Checkout`](file:///c:/Users/Gabriel/OneDrive/Faculdade/5°%20Semestre%20-%2002-2026/LES/runway/runway-ecommerce/frontend/src/pages/Checkout/Checkout.tsx) para entender a complexidade de regras de cupom, divisão de pagamento e parcelamento individual por cartão.
