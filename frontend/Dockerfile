FROM node:26-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code
COPY . .

# Build - ensure it completes successfully
# Explicitly use webpack to avoid Turbopack issues with Next.js 16
# Next.js 16 defaults to Turbopack, but we have webpack config
# Force webpack by setting env var and using --webpack flag
# Disable telemetry
# Clean cache before build to save space
RUN rm -rf /app/.next/cache 2>/dev/null || true
RUN NEXT_TELEMETRY_DISABLED=1 NEXT_PRIVATE_SKIP_TURBOPACK=1 NEXT_PRIVATE_WEBPACK=1 npm run build || (echo "Build failed!" && exit 1)
# Clean webpack cache after build to reduce image size
RUN rm -rf /app/.next/cache/webpack 2>/dev/null || true

# Verify build output exists
RUN test -d /app/.next && echo "Build successful - .next directory exists" || (echo "ERROR: .next directory not found after build!" && exit 1)
RUN test -f /app/.next/prerender-manifest.js && echo "prerender-manifest.js found" || echo "WARNING: prerender-manifest.js not found (may be normal for some Next.js versions)"

# Ensure public directory exists (create empty if it doesn't)
# Next.js apps may or may not have a public directory for static assets
RUN mkdir -p /app/public || true

# Production stage
FROM node:26-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy built files - ensure .next directory is complete
# Use --chown to ensure proper permissions
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/next.config.js ./
COPY --from=builder --chown=node:node /app/package.json ./

# Copy public directory (will be empty if it doesn't exist in source)
# We created it in builder stage, so this will always succeed
COPY --from=builder --chown=node:node /app/public ./public

# Verify .next directory exists
RUN test -d /app/.next && echo "✓ .next directory copied successfully" || (echo "✗ ERROR: .next directory not found!" && exit 1)
RUN ls -la /app/.next/ | head -10 || echo "Could not list .next contents"

EXPOSE 3000

CMD ["npm", "start"]

