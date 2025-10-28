# Use nginx alpine for lightweight static file serving
FROM nginx:alpine

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

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
