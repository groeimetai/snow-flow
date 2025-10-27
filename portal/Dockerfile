# Multi-stage build for Snow-Flow Enterprise Portal
# Builds both backend (Express) and frontend (React)
FROM node:20-alpine AS builder

WORKDIR /app

# Build backend
WORKDIR /app/backend
COPY backend/package*.json backend/tsconfig.json ./
RUN npm ci
COPY backend/src ./src
RUN npm run build

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built backend from builder
COPY --from=builder /app/backend/dist ./dist

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create data directory for SQLite (if needed)
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
