# Snow-Flow Health API Docker Image
# Build context: repo root (.)
# Build with: docker build -f apps/health-api/Dockerfile .

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files from health-api app
COPY apps/health-api/package*.json ./
COPY apps/health-api/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY apps/health-api/src/ ./src/

# Build TypeScript
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY apps/health-api/package*.json ./
RUN npm install --production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data && chmod 777 /app/data

# Health check - Cloud Run uses PORT environment variable (default 8080)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8080') + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run as non-root user
USER node

# Expose port (Cloud Run will override with PORT env var)
EXPOSE 8080

# Start the API
CMD ["node", "dist/simple-health-api.js"]
