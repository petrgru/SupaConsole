# Builder: node 20 (con OpenSSL para Prisma)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# OpenSSL para que Prisma detecte correctamente
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Instalar deps
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
# Código
COPY . .
# Generar Prisma client si aplica
RUN npx prisma generate || true
# Build Next en modo producción (sin afectar devDeps ya instaladas)
RUN NODE_ENV=production npm run build

# Runner with Node.js runtime + docker CLI + compose plugin + OpenSSL
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    RUNNING_IN_DOCKER=true

# Install Docker CLI and Compose plugin from Debian repos, plus git, procps (for free), util-linux (for nsenter)
RUN apt-get update && \
        apt-get install -y \
            curl \
            ca-certificates \
            git \
            procps \
            util-linux \
            docker.io && \
        mkdir -p /usr/lib/docker/cli-plugins && \
        curl -sSL https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 -o /usr/lib/docker/cli-plugins/docker-compose && \
        chmod +x /usr/lib/docker/cli-plugins/docker-compose && \
        apt-get clean && \
        rm -rf /var/lib/apt/lists/*

# Directorios persistentes
RUN mkdir -p /app/data /app/supabase-core /app/supabase-projects

# Artefactos del build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Script de arranque
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]