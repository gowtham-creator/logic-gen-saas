FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build
RUN npm run build

# Production stage
FROM node:25-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]

