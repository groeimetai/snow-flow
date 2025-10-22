# Multi-stage build for Snow-Flow Enterprise License Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY tsconfig.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source code
COPY src ./src

# Build backend (TypeScript)
RUN npm run build:backend

# Copy frontend and build it
COPY frontend ./frontend
RUN cd frontend && npm ci && npm run build && cd ..

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built backend from builder
COPY --from=builder /app/dist ./dist

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create data directory for SQLite
RUN mkdir -p /app/data && \
    chown -R node:node /app

# Use non-root user
USER node

# Cloud Run expects port 8080
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
