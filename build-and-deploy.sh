#!/bin/bash
set -e

echo "=== Build and Deploy Script for EC2 (Production) ==="
echo ""

# Check .env exists (required for production)
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Copy .env.example to .env and set production values (JWT_SECRET, ENCRYPTION_KEY, DMN_PIPELINE_API_URL, etc.)"
    exit 1
fi

# Check disk space first
echo "Step 0: Checking disk space..."
df -h
echo ""

# Clean up Docker resources to free space
echo "Step 0.5: Cleaning up Docker resources to free space..."
echo "  - Removing stopped containers..."
docker container prune -f 2>/dev/null || true

echo "  - Removing unused images (this may take a while)..."
docker image prune -a -f 2>/dev/null || true

echo "  - Removing unused volumes..."
docker volume prune -f 2>/dev/null || true

echo "  - Removing build cache..."
docker builder prune -a -f 2>/dev/null || true

echo ""
echo "Disk space after cleanup:"
df -h
echo ""

# Check available space
AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//' 2>/dev/null || echo "0")
if [ "$AVAILABLE_SPACE" -lt 2 ]; then
    echo "⚠️  WARNING: Less than 2GB available. Build may fail!"
    echo "   Consider running: ./cleanup-disk-space.sh"
    echo ""
fi

echo "Step 1: Building frontend image..."
cd frontend
docker build -t log-gen-core20-frontend -f Dockerfile . || {
    echo "❌ Frontend build failed!"
    exit 1
}
cd ..

echo ""
echo "Step 2: Building backend image..."
cd backend
docker build -t log-gen-core20-backend -f Dockerfile . || {
    echo "❌ Backend build failed!"
    exit 1
}
cd ..

echo ""
echo "Step 3: Building nginx image..."
cd nginx
docker build -t log-gen-core20-nginx -f Dockerfile . || {
    echo "❌ Nginx build failed!"
    exit 1
}
cd ..

echo ""
echo "Step 4: Verifying images were created..."
docker images | grep -E "log-gen-core20-frontend|log-gen-core20-backend|log-gen-core20-nginx"

echo ""
echo "Step 5: Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

echo ""
echo "Step 6: Starting services (using pre-built images)..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 7: Waiting for services to start..."
echo "Waiting 30 seconds for initial startup..."
sleep 30

echo ""
echo "Step 8: Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npm run migration:run:prod 2>/dev/null || {
    echo "⚠️  Migration run failed or already up-to-date (check logs if needed)"
}

echo ""
echo "Step 9: Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "Step 10: Checking service health..."
echo "=== Backend Health ==="
docker-compose -f docker-compose.prod.yml exec -T backend wget --quiet --tries=1 --spider http://localhost:3001/health 2>/dev/null && echo "✅ Backend is healthy" || echo "⚠️  Backend health check failed"

echo ""
echo "=== Frontend Health ==="
docker-compose -f docker-compose.prod.yml exec -T frontend wget --quiet --tries=1 --spider http://localhost:3000 2>/dev/null && echo "✅ Frontend is healthy" || echo "⚠️  Frontend health check failed"

echo ""
echo "Step 11: Recent logs..."
echo "=== Backend Logs (last 10 lines) ==="
docker-compose -f docker-compose.prod.yml logs --tail=10 backend

echo ""
echo "=== Frontend Logs (last 10 lines) ==="
docker-compose -f docker-compose.prod.yml logs --tail=10 frontend

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "This script handles:"
echo "  ✓ Docker cleanup (containers, images, volumes, build cache)"
echo "  ✓ Build of frontend, backend, nginx images"
echo "  ✓ Stop/start of all services (docker-compose.prod.yml)"
echo "  ✓ Database migrations (shared + tenant DBs: run migration:run:all:prod if you use multi-tenant DBs)"
echo ""
echo "You may still need to do manually:"
echo "  • Run migrations on all tenant DBs: docker-compose -f docker-compose.prod.yml exec backend npm run migration:run:all:prod"
echo "  • SSL/HTTPS: configure certs and nginx if not already done"
echo "  • Backups: ensure DB/volume backups are scheduled"
echo ""
echo "Useful commands:"
echo "  docker-compose -f docker-compose.prod.yml ps          # Check status"
echo "  docker-compose -f docker-compose.prod.yml logs -f     # Follow logs"
echo ""
echo "Access your services:"
echo "  Frontend: http://$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')"
echo "  API:      http://$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')/api"

