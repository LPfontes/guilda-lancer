# Guilda LANCER — Terminal Tático Omninet

Sistema web completo para gerenciamento de guildas e campanhas *West Marches* do RPG de mesa de ficção científica **LANCER** (Massif Press).

A plataforma conecta operadores e mestres através do Discord, integra fichas de pilotos e mechs diretamente da nuvem oficial do **COMP/CON v3**, gerencia hangares individuais e automatiza o quadro de missões táticas com algoritmo de prioridade de escalamento.

---

## Visão Geral da Arquitetura

O projeto é estruturado em arquitetura modular full-stack em **TypeScript**:

```text
guilda-lancer/
├── client/                  # Frontend SPA (HTML5, CSS3 Moderno, TypeScript, Vite)
│   ├── src/
│   │   ├── components/      # Componentes visuais (TerminalBackground em Canvas 2D)
│   │   ├── services/        # Cliente HTTP de API com sessão por cookie HttpOnly
│   │   ├── styles/          # Design system (variables.css e global.css)
│   │   ├── types/           # Tipagens TypeScript compartilhadas
│   │   └── main.ts          # Inicialização da SPA e roteamento de visualizações
│   ├── index.html           # Ponto de entrada com scanlines CRT e canvas tático
│   ├── vite.config.ts       # Servidor Vite com proxy reverso /api -> porta 5000
│   └── package.json
│
├── server/                  # Backend REST API (Node.js, Express, TypeScript, Mongoose)
│   ├── src/
│   │   ├── config/          # Variáveis de ambiente com validação Zod
│   │   ├── controllers/     # Controladores de rotas (Auth, Pilot, Mission)
│   │   ├── database/        # Conexão MongoDB e Schemas Mongoose (User, Pilot, Mission)
│   │   ├── middlewares/     # Validação JWT HttpOnly e controle de acesso RBAC
│   │   ├── routes/          # Definições das rotas da API REST
│   │   ├── services/        # Integração AWS com API COMP/CON v3 e regras LANCER
│   │   ├── app.ts           # Configuração Express e CORS
│   │   ├── server.ts        # Inicialização do servidor HTTP
│   │   └── index.ts         # Bootstrap com conexão com banco de dados
│   ├── tests/               # 25 testes automatizados de integração com Vitest
│   └── package.json
│
├── .env                     # Variáveis de ambiente locais
└── README.md                # Documentação central do projeto
```

---

## Funcionalidades Principais

### 1. Autenticação e Gestão de Operadores (Discord OAuth2)
- Fluxo de login oficial do Discord OAuth2 com troca segura de tokens no backend.
- Sessão persistida via cookies seguros `HttpOnly` com assinatura JWT.
- Controle de acesso baseado em papéis (*RBAC*): `PILOT`, `GM` e `ADMIN`.
- Modo de desenvolvimento com autenticação mock para testes locais sem credenciais externas.

### 2. Integração Nativa com COMP/CON v3 Cloud
- **Importação por Share Code**: Resolução de códigos públicos de 12 caracteres diretamente nos gateways da Amazon AWS S3 / CloudFront da Massif Press.
- **Importação por JSON Bruto**: Suporte a upload ou payload direto do arquivo de exportação oficial do COMP/CON.
- **Extração Completa de Ficha**:
  - HASE (Hull, Agility, Systems, Engineering), Grit, Licenças e Talentos.
  - Chassi de mech ativo, loadouts montados, armamentos e sistemas.
  - Armazenamento de artes oficiais e retratos (`portrait` e `active_mech_image`).

### 3. Hangar Virtual de Pilotos (1:N)
- Cada operador pode possuir múltiplos pilotos cadastrados no banco de dados.
- Mecanismo de piloto ativo (`POST /api/pilots/:id/activate`) para operações e candidaturas.
- Sincronização e atualização de fichas com preservação de histórico.

### 4. Mural de Missões West Marches & Algoritmo de Prioridade
- Abertura de operações por Mestres (GM) e Administradores com requisitos de LL (License Level).
- Candidatura de pilotos ativos com cálculo automático de pontuação de prioridade:
  - Fator temporal (dias desde a última missão jogada).
  - Participação acumulada no ciclo de campanha.
- Confirmação de esquadrão escalado e publicação de relatórios pós-ação (*After Action Reports - AAR*).

### 5. Interface Tática Terminal Omninet
- Estética militar futurista com paleta oficial:
  - **Carmim Profundo (`#802932`)**: Ações primárias, botões operacionais e alertas críticos.
  - **Verde Menta Fosforescente (`#78C091`)**: Linhas de terminal, cursor em bloco (`█`), dados de telemetria e bordas ativas.
- Canvas 2D de alta performance com fluxo contínuo de logs da Omninet.
- Animação de rolagem vertical suave com subida contínua e fade-out superior ao cruzar a borda da janela.
- Efeito óptico de aberração cromática com projeção de cor para a frente nas transmissões paracausais e mensagens enigmáticas da entidade UNKNOWN.

---

## Pilha de Tecnologias

### Frontend (`client/`)
- **Linguagem:** TypeScript
- **Estilização:** CSS3 puro moderno (CSS Variables, Flexbox, Grid, keyframes, scanlines CRT)
- **Tipografia:** Orbitron (display sci-fi), JetBrains Mono (terminal) e Inter (corpo)
- **Build Tool:** Vite (com proxy reverso integrado na porta 3000)

### Backend (`server/`)
- **Runtime:** Node.js (ES Modules) com TypeScript
- **Framework:** Express.js
- **Banco de Dados:** MongoDB via Mongoose ODM
- **Validação:** Zod
- **Segurança:** Cookie-Parser, CORS, JWT
- **Testes:** Vitest e Supertest

---

## Configuração do Ambiente (.env)

Crie ou edite o arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Servidor HTTP
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Conexão MongoDB Atlas ou Local
MONGODB_URI=mongodb+srv://<USUARIO>:<SENHA>@<CLUSTER>.mongodb.net/guilda-lancer?retryWrites=true&w=majority

# Chave Secreta JWT
JWT_SECRET=super_secret_omninet_jwt_key_lancer

# Discord Developer Portal (OAuth2)
DISCORD_CLIENT_ID=seu_client_id_aqui
DISCORD_CLIENT_SECRET=seu_client_secret_aqui
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/discord/callback
```

---

## Instalação e Execução

### Pré-requisitos
- Node.js versão 18 ou superior.
- Instância do MongoDB (MongoDB Atlas ou serviço local).

### 1. Inicializar o Backend (Servidor)
```bash
cd server
npm install
npm run dev
```
O servidor iniciará em `http://localhost:5000` com hot-reload ativo via `tsx watch`.

### 2. Inicializar o Frontend (Cliente)
Em outro terminal:
```bash
cd client
npm install
npm run dev
```
A interface do terminal estará disponível no navegador em `http://localhost:3000`.

---

## Testes Automatizados

A suíte de testes de integração e validação cobre regras de negócio, autenticação e comunicação com a nuvem do COMP/CON:

```bash
cd server
npm test
```

Para executar os testes com relatório de cobertura de código:
```bash
cd server
npm run test:coverage
```

---

## Referência das Rotas da API

### Autenticação (`/api/auth`)
| Método | Endpoint | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/discord` | Público | Redireciona para o login do Discord OAuth2 |
| `GET` | `/api/auth/discord/callback` | Público | Callback de autorização do Discord e emissão de cookie JWT |
| `GET` | `/api/auth/me` | Autenticado | Retorna dados do operador, piloto ativo e lista do hangar |
| `POST` | `/api/auth/dev-login` | Dev | Autenticação mock para desenvolvimento local |
| `POST` | `/api/auth/logout` | Autenticado | Revoga a sessão e limpa o cookie HttpOnly |

### Hangar de Pilotos (`/api/pilots`)
| Método | Endpoint | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/pilots/import/share-code` | Autenticado | Importa piloto via Share Code de 12 dígitos do COMP/CON |
| `POST` | `/api/pilots/import/json` | Autenticado | Importa piloto via payload JSON bruto do COMP/CON |
| `GET` | `/api/pilots/my` | Autenticado | Lista todos os pilotos pertencentes ao operador logado |
| `GET` | `/api/pilots/:id` | Autenticado | Retorna detalhes completos da ficha de um piloto |
| `POST` | `/api/pilots/:id/activate` | Autenticado | Define o piloto como o chassi ativo do operador |
| `DELETE` | `/api/pilots/:id` | Autenticado | Remove um piloto do hangar do operador |

### Mural de Missões (`/api/missions`)
| Método | Endpoint | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/missions` | Autenticado | Lista missões operacionais abertas |
| `POST` | `/api/missions` | GM / Admin | Cria um novo contrato operacional de missão |
| `GET` | `/api/missions/:id` | Autenticado | Retorna briefing e lista de pilotos inscritos |
| `POST` | `/api/missions/:id/apply` | Autenticado | Inscreve o piloto ativo com pontuação de prioridade |
| `POST` | `/api/missions/:id/select-squad` | GM / Admin | Confirma o esquadrão escalado para a missão |
| `POST` | `/api/missions/:id/aar` | GM / Admin | Conclui a missão e registra o Relatório Pós-Ação (AAR) |

---

## Licenças e Direitos Autorais

- O jogo de RPG de mesa **LANCER** é propriedade intelectual de **Massif Press**.
- As fichas, layouts e regras são compatíveis com a ferramenta oficial **COMP/CON**.
- Este software é distribuído sob licença livre para fins comunitários e de mesas de jogo.
