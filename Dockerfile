# Stage 1: Builder
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# 1. Copy configurations and install production modules
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate

# 2. Copy the compiled code from the builder stage
COPY --from=builder /app/dist ./dist

# 3. SECURITY: Transfer ownership of the /app directory from 'root' to 'node'
RUN chown -R node:node /app

# 4. SECURITY: Drop root privileges. All following commands run as 'node'
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]