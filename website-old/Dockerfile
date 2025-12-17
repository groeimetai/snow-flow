# Snow-Flow Website - Production Docker Image
FROM nginx:alpine

# Install security updates and curl for healthcheck
RUN apk update && apk upgrade && apk add --no-cache curl

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy website files
COPY . /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for logs
RUN mkdir -p /var/log/nginx

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Expose port 80
EXPOSE 80

# Add metadata
LABEL maintainer="Snow-Flow Team" \
      description="Snow-Flow Enterprise Website v4.3.0" \
      version="4.3.0" \
      features="18 MCP Servers, 410+ Tools, Seat-Based Licensing, User Management, Enterprise Analytics"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]