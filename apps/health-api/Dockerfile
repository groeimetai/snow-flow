# Snow-Flow Health API Docker Image
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files from root (build context is repo root)
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (use npm install for dynamic version resolution)
# This will install the latest @groeimetai/snow-code version specified in package.json
RUN npm install --production=false

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only (use npm install for dynamic version resolution)
COPY package*.json ./
RUN npm install --production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Health check - Cloud Run uses PORT environment variable (default 8080)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8080') + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run as non-root user
USER node

# Expose port (Cloud Run will override with PORT env var)
EXPOSE 8080

# Start the API
CMD ["node", "dist/api/simple-health-api.js"]
