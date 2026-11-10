FROM nginx:alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories
RUN mkdir -p /var/log/nginx /var/cache/nginx

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

