# Stage 1: Builder
FROM node:20-slim AS builder
# Install OpenSSL for Prisma engine compatibility
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# The Prisma client and docs are generated here while devDependencies exist
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-slim
# Install OpenSSL in the final runtime
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
ENV NODE_ENV=production

# 1. Install ONLY production modules
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts

# 2. Copy the compiled code from the builder stage
COPY --from=builder /app/dist ./dist
# 3. Copy the PRE-GENERATED Prisma client from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 4. SECURITY: Transfer ownership
RUN chown -R node:node /app

# 5. SECURITY: Drop root privileges
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]