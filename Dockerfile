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

# Runner con docker CLI + compose plugin + OpenSSL
FROM debian:bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# Docker CLI + compose y OpenSSL para Prisma runtime
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg lsb-release jq openssl \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
    > /etc/apt/sources.list.d/docker.list \
 && apt-get update && apt-get install -y docker-ce-cli docker-compose-plugin \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Directorios persistentes
RUN mkdir -p /app/data /app/supabase-core /app/supabase-projects

# Artefactos del build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Script de arranque
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]