# Use nginx alpine for lightweight static file serving
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the HTML file to nginx html directory
COPY index.html /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for nginx temp files and set permissions
RUN mkdir -p /var/cache/nginx/client_temp && \
    chmod -R 777 /var/cache/nginx && \
    chmod -R 777 /tmp

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Add metadata
LABEL maintainer="Snow-Flow Team" \
      description="Snow-Flow Status Page v1.2.0" \
      version="1.2.0" \
      service="status-monitoring"

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
