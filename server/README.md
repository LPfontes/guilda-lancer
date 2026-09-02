# Omninet Hub API — Backend da Guilda LANCER TTRPG

API RESTful desenvolvida em **Node.js**, **Express**, **TypeScript** e **MongoDB** para o gerenciamento de guildas e campanhas *West Marches* do RPG de mesa **LANCER** (Massif Press).

O sistema inclui integração em tempo real com a nuvem do **COMP/CON v3**, motor de validação de regras oficiais do livro básico, hangar de pilotos por operador (1:N), matchmaking com pontuação de prioridade para missões, e autenticação com papéis via **Discord OAuth2**.

---

## Tecnologias e Bibliotecas

- **Linguagem & Runtime:** [Node.js](https://nodejs.org/) (ES Modules) com [TypeScript](https://www.typescriptlang.org/)
- **Framework Web:** [Express.js](https://expressjs.com/)
- **Banco de Dados:** [MongoDB](https://www.mongodb.com/) via [Mongoose ODM](https://mongoosejs.com/)
- **Autenticação:** [JSON Web Token (JWT)](https://jwt.io/) + Cookies `HttpOnly` + [Discord OAuth2 API](https://discord.com/developers/docs)
- **Integração Externa:** [COMP/CON v3 Cloud](https://compcon.app/) via AWS API Gateway & CloudFront S3
- **Validação:** [Zod](https://zod.dev/) & Mongoose Schemas
- **Testes Automatizados:** [Vitest](https://vitest.dev/) & [Supertest](https://github.com/ladjs/supertest)

---

## Estrutura de Diretórios

```text
server/
├── src/
│   ├── config/              # Variáveis de ambiente e configurações globais
│   │   └── env.ts
│   ├── database/            # Conexão com MongoDB e Modelos Mongoose
│   │   ├── connection.ts    # Gestão de conexão e reconexão
│   │   └── models/
│   │       ├── User.model.ts    # Operador (Discord ID, roles, hangar virtual)
│   │       ├── Pilot.model.ts   # Ficha LANCER completa (HASE, talentos, mechs)
│   │       └── Mission.model.ts # Operações, candidaturas e relatórios AAR
│   ├── middlewares/         # Middlewares de autenticação e RBAC
│   │   └── auth.middleware.ts
│   ├── controllers/         # Regras de negócio das requisições
│   │   ├── auth.controller.ts
│   │   ├── pilot.controller.ts
│   │   └── mission.controller.ts
│   ├── routes/              # Definição e agrupamento de rotas REST
│   │   ├── auth.routes.ts
│   │   ├── pilot.routes.ts
│   │   └── mission.routes.ts
│   ├── services/            # Serviços externos e regras do LANCER
│   │   └── compcon.service.ts # Client AWS COMP/CON v3 e parser de fichas
│   ├── app.ts               # Montagem do Express, CORS e rotas
│   ├── server.ts            # Inicialização do servidor e escuta HTTP
│   └── index.ts             # Entry point
├── tests/                   # Suítes de testes unitários e de integração
│   ├── auth.middleware.test.ts
│   ├── compcon.service.test.ts
│   ├── pilot.routes.test.ts
│   └── mission.routes.test.ts
├── tsconfig.json
└── package.json
```

---

## Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto (ou dentro da pasta `server/`) com as seguintes chaves:

```env
# Servidor
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Banco de Dados MongoDB
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/guilda-lancer?retryWrites=true&w=majority

# Segurança JWT
JWT_SECRET=super_secret_omninet_jwt_key_lancer

# Discord OAuth2 (https://discord.com/developers/applications)
DISCORD_CLIENT_ID=seu_client_id_aqui
DISCORD_CLIENT_SECRET=seu_client_secret_aqui
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/discord/callback
```

---

## Como Executar o Projeto

### 1. Instalar dependências
```bash
cd server
npm install
```

### 2. Modo de Desenvolvimento (Hot Reload)
```bash
npm run dev
```
O servidor estará acessível em `http://localhost:5000`.

### 3. Executar os Testes Automatizados
```bash
npm test
```
Para executar com monitoramento contínuo:
```bash
npm run test:watch
```

### 4. Build e Produção
```bash
npm run build
npm start
```

---

## Referência Completa da API

### 1. Autenticação e Sessão (/api/auth)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/auth/discord` | Público | Redireciona o usuário para login oficial no Discord. |
| `GET` | `/api/auth/discord/callback` | Público | Processa o retorno do Discord, cria/atualiza o usuário e emite JWT. |
| `POST` | `/api/auth/mock-login` | Dev | Login rápido de desenvolvimento para testar papéis (`ADMIN`, `GM`, `PILOT`). |
| `GET` | `/api/auth/me` | Autenticado | Retorna o operador logado, seu hangar de pilotos e o piloto ativo. |
| `POST` | `/api/auth/logout` | Autenticado | Limpa cookies de sessão e desconecta o terminal. |

---

### 2. Hangar e Fichas de Pilotos (/api/pilots)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/api/pilots` | Autenticado | Cria um piloto manualmente ou importa se enviar dados do COMP/CON. |
| `POST` | `/api/pilots/submit` | Autenticado | Submete ou atualiza ficha via **Share Code** ou **JSON exportado** do COMP/CON. |
| `POST` | `/api/pilots/import` | Autenticado | Alias direto para submissão COMP/CON. |
| `POST` | `/api/pilots/preview` | Público | Valida dados de ficha contra as regras do LANCER sem salvar no banco. |
| `GET` | `/api/pilots` | Autenticado | Listagem de pilotos com paginação e filtros (`status`, `min_ll`, `max_ll`, `search`). |
| `GET` | `/api/pilots/me` | Autenticado | Consulta todas as fichas do hangar do operador logado e seu piloto ativo. |
| `GET` | `/api/pilots/:id` | Autenticado | Detalhes da ficha e dossiê tático militar completo. |
| `PUT` | `/api/pilots/:id` | Dono/Admin | Atualização completa dos atributos da ficha (recalcula Grit e regras). |
| `PATCH`| `/api/pilots/:id` | Dono/Admin | Atualização parcial de campos específicos. |
| `POST` | `/api/pilots/:id/activate` | Dono | Define qual piloto do hangar está ativo para desdobramento em missões. |
| `POST` | `/api/pilots/:id/review` | Admin/GM | Avalia a ficha (`APPROVED` ou `REJECTED` com justificativa obrigatória). |
| `DELETE`| `/api/pilots/:id` | Dono/Admin | Remove uma ficha específica do hangar (bloqueado se estiver em missão). |
| `DELETE`| `/api/pilots/me` | Autenticado | Remove o piloto ativo do operador. |

---

### 3. Mural de Missões e Operações (/api/missions)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/missions` | Autenticado | Lista operações com filtros (`status`, `min_ll`, `max_ll`, `gm_id`, `search`). |
| `GET` | `/api/missions/:id` | Autenticado | Retorna detalhes da missão, briefing, regras opcionais e esquadrão inscrito. |
| `POST` | `/api/missions` | Admin/GM | Cria e agenda uma nova missão militar. |
| `PUT` | `/api/missions/:id` | Mestre/Admin | Atualização completa dos dados da missão. |
| `PATCH`| `/api/missions/:id` | Mestre/Admin | Atualização parcial da missão. |
| `DELETE`| `/api/missions/:id` | Mestre/Admin | Cancela e exclui a missão, desmobilizando os pilotos vinculados. |
| `POST` | `/api/missions/:id/apply` | Operador | Inscreve o piloto ativo na missão com cálculo de prioridade. |
| `DELETE`| `/api/missions/:id/apply` | Operador | Cancela a inscrição do piloto na missão. |
| `POST` | `/api/missions/:id/select-pilots` | Mestre/Admin | Escala o esquadrão (`SELECTED`, `WAITLIST`, `REJECTED`) respeitando vagas. |
| `POST` | `/api/missions/:id/start` | Mestre/Admin | Inicia a missão (`IN_PROGRESS`), bloqueando edições nas fichas dos selecionados. |
| `POST` | `/api/missions/:id/complete` | Mestre/Admin | Conclui a missão (`COMPLETED`), salva o relatório AAR e libera os pilotos. |

---

## Regras de Domínio e Validações Embutidas

1. **Relação 1 Usuário para N Pilotos (Hangar)**:
   - Um usuário pode possuir múltiplos personagens cadastrados.
   - **Integridade Relacional**: Hook `pre('save')` no Mongoose impede que qualquer piloto exista sem um operador válido no banco de dados.
   - **Cascata**: Ao deletar um usuário, todos os seus pilotos são removidos automaticamente.
2. **Resolução de Share Code do COMP/CON v3**:
   - Integração com a API Gateway oficial da Massif Press na AWS e download seguro de arquivos JSON via CloudFront S3.
   - Aceita códigos formatados com ou sem traços (ex: `C1NO-1KI6-K32A` ou `C1NO1KI6K32A`) e URLs do app.
3. **Resolução de Imagens e Tokens**:
   - Extrai automaticamente URLs do CloudFront para retrato do piloto (`cloud_portrait`), arte customizada de mechas e arte oficial de chassis (`frameData.image_url`).
4. **Motor de Regras do LANCER**:
   - **Determinação (Grit)**: $\lceil LL / 2 \rceil$.
   - **Atributos HASE**: Casco, Agilidade, Sistemas e Engenharia validados contra o teto de $LL \times 2$ (máx. 6 por atributo).
   - **Talentos**: Ranks acumulados validados contra o limite de $LL + 3$.
   - **Reavaliação Automática**: Modificações manuais de estatísticas de combate por jogadores comuns retornam a ficha para `PENDING_APPROVAL`.
5. **Algoritmo de Prioridade de Matchmaking**:
   - Pontuação calculada dinamicamente:
     $$\text{Score} = 100 - (\text{missões jogadas} \times 10) + \text{dias sem jogar}$$
     Prioriza jogadores com menos oportunidades recentes na guilda.
6. **Proteção de Missão Ativa**:
   - Pilotos mobilizados em operações `IN_PROGRESS` têm alteração e exclusão de ficha travadas até o encerramento da missão.

---

## Testes Automatizados

O backend possui suítes completas de testes com mocks isolados (sem depender de conexão externa durante os testes de CI):

```bash
npm test
```

```text
 ✓ tests/compcon.service.test.ts (6 tests)
 ✓ tests/pilot.routes.test.ts (12 tests)
 ✓ tests/mission.routes.test.ts (7 tests)

 Test Files  3 passed (3)
      Tests  25 passed (25)
```

---

## Licença

Este projeto é desenvolvido para a comunidade de RPG de mesa e fãs de **LANCER** (criado por *Massif Press*). Todo o conteúdo de regras do jogo segue a licença e termos de terceiros da Massif Press.
