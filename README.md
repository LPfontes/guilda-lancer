# Guilda LANCER // Terminal Tático Omninet

Hub tático web para gerenciamento de campanhas *West Marches* do RPG de ficção científica **LANCER** (Massif Press). Integração direta com a nuvem oficial do **COMP/CON v3**, hangares multi-chassi, escalonamento automatizado de esquadrões e autenticação via Discord.

---

## Foco do Projeto

1. **Sincronização com COMP/CON v3**: Importação instantânea de fichas via Share Code de 12 dígitos ou payload JSON oficial da Massif Press.
2. **Hangar Tático & Multi-Chassi**:
   - Gestão de múltiplos pilotos por operador (1:N).
   - Suporte a múltiplos chassis de mecha por ficha com troca rápida de chassi ativo.
   - Telemetria de combate em tempo real (HP, Estrutura, Stress, Calor, Overcharge).
   - Fluxo de auditoria e homologação de fichas por GMs e Administradores.
3. **Quadro de Missões & Escalonamento Justo**:
   - Criação de briefings de missões táticas com restrições de License Level (LL).
   - Algoritmo de prioridade de escalamento baseado em inatividade temporal e assiduidade.
   - Confirmação de esquadrões e submissão de Relatórios Pós-Ação (*After Action Reports - AAR*).
4. **Autenticação Segura & Múltiplos Domínios**:
   - Discord OAuth2 com controle de acesso por cargos (*RBAC*: `PILOT`, `GM`, `ADMIN`).
   - Sessão segura por cookies `HttpOnly` com diagnóstico preventivo no navegador.
   - Suporte nativo a múltiplos frontends em simultâneo (ex: Vercel + Domínio Próprio).

---

## Stack Tecnológica

- **Frontend (`client/`)**: TypeScript, Vite, Vanilla CSS3 (Design System militar/industrial COMP/CON, zero CSS inline), Canvas 2D Telemetry e WebSockets.
- **Backend (`server/`)**: Node.js, Express, TypeScript, Mongoose ODM, JWT, Cookie-Parser e Vitest.
- **Banco de Dados**: MongoDB (Local ou Atlas).

---

## Configuração do Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto (o backend o carrega automaticamente):

```env
# Servidor HTTP & Ambiente
PORT=3001
NODE_ENV=development

# Frontend & Múltiplas Origens Permitidas (CORS / WebSockets / OAuth2)
CLIENT_URL="https://guilda.vttserver.com.br"
ALLOWED_ORIGINS="https://guilda.vttserver.com.br,https://guilda-lancer-kappa.vercel.app,http://localhost:3000"

# Banco de Dados MongoDB (Local ou Nuvem)
MONGODB_URI="mongodb://127.0.0.1:27017/guilda_lancer"
# MONGODB_URI="mongodb+srv://<USER>:<PASS>@<CLUSTER>.mongodb.net/guilda_lancer?retryWrites=true&w=majority"

# Chave JWT
JWT_SECRET="chave_super_segura_omninet"

# Discord Developer Portal (OAuth2)
DISCORD_CLIENT_ID="seu_client_id"
DISCORD_CLIENT_SECRET="seu_client_secret"
DISCORD_REDIRECT_URI="http://localhost:3001/api/auth/discord/callback"

# Mapeamento de Cargos do Servidor Discord
DISCORD_GUILD_ID="seu_guild_id"
ROLE_ID_ADMIN="id_cargo_admin"
ROLE_ID_GM="id_cargo_mestre"
ROLE_ID_PILOT="id_cargo_piloto"
```

---

## Como Executar

### Pré-requisitos
- Node.js 18+
- MongoDB rodando localmente (porta `27017`) ou cluster MongoDB Atlas

### 1. Execução em Desenvolvimento (Recomendado)

```bash
# Terminal 1 — Backend (Porta 3001)
cd server
npm install
npm run dev

# Terminal 2 — Frontend (Porta 3000)
cd client
npm install
npm run dev
```

Acesse a interface no navegador em **`http://localhost:3000`**.

### 2. Execução com Docker Compose

Para subir o stack completo com MongoDB local em container:

```bash
docker compose up -d
```

---

## Testes Automatizados

O backend conta com cobertura de testes unitários e de integração para regras de negócio, cálculo de prioridade e seleção de chassis:

```bash
cd server
npm test
```

---

## Principais Rotas da API REST

| Módulo | Método | Endpoint | Acesso | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `GET` | `/api/auth/discord/login` | Público | Inicia autorização OAuth2 com retorno dinâmico |
| **Auth** | `GET` | `/api/auth/discord/callback`| Público | Processa retorno do Discord e emite cookie HttpOnly |
| **Auth** | `GET` | `/api/auth/me` | Autenticado | Retorna usuário ativo, cargos e pilotos |
| **Pilotos** | `POST` | `/api/pilots/import/share-code` | Autenticado | Importa ficha por Share Code COMP/CON |
| **Pilotos** | `POST` | `/api/pilots/import/json` | Autenticado | Importa ficha por payload JSON bruto |
| **Pilotos** | `POST` | `/api/pilots/:id/activate` | Autenticado | Define o piloto ativo no hangar do operador |
| **Pilotos** | `POST` | `/api/pilots/:id/active-mech` | Autenticado | Alterna qual mecha está ativo na ficha do piloto |
| **Pilotos** | `POST` | `/api/pilots/:id/review` | GM / Admin | Homologa ou solicita ajustes na ficha |
| **Missões** | `GET` | `/api/missions` | Autenticado | Lista operações abertas e em andamento |
| **Missões** | `POST` | `/api/missions` | GM / Admin | Cria um novo contrato de missão |
| **Missões** | `POST` | `/api/missions/:id/apply` | Autenticado | Candidata piloto ativo com cálculo de prioridade |
| **Missões** | `POST` | `/api/missions/:id/start` | GM / Admin | Escala o esquadrão e inicia a operação |
| **Missões** | `POST` | `/api/missions/:id/complete` | GM / Admin | Conclui missão e registra Relatório Pós-Ação (AAR) |

---

## Diretrizes e Licença

- **Regra Estrita de Estilo**: Proibido CSS Inline (`style="..."`). Todos os estilos residem em `client/src/styles/` respeitando o design system industrial do COMP/CON.
- **LANCER RPG** é propriedade intelectual de **Massif Press**.
- Software livre desenvolvido para apoio comunitário à Guilda e mesas de jogo.
