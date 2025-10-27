# Multi-stage build for Snow-Flow Enterprise MCP Server
# Builds only backend (no frontend needed)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Create data directory (if needed)
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
