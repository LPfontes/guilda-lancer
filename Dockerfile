# ==========================================
# 1. BUILD STAGE: Frontend (Vite + TypeScript)
# ==========================================
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ==========================================
# 2. BUILD STAGE: Backend (Node.js + TypeScript)
# ==========================================
FROM node:20-alpine AS server-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ==========================================
# 3. PRODUCTION RUNNER: Imagem Otimizada Alpine
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Instala apenas as dependências de produção do servidor
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# Copia o código compilado do backend
COPY --from=server-builder /app/server/dist ./server/dist

# Copia a aplicação frontend compilada para a pasta pública servida pelo Express
COPY --from=client-builder /app/client/dist ./server/public

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
