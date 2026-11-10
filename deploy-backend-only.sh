#!/bin/bash

echo "=== Backend Only Deployment Script ==="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env file with production configuration"
    exit 1
fi

# Check if NODE_ENV is set to production
if ! grep -q "NODE_ENV=production" .env; then
    echo "WARNING: NODE_ENV is not set to 'production' in .env file"
    echo "Setting NODE_ENV=production..."
    if grep -q "NODE_ENV=" .env; then
        sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env
    else
        echo "NODE_ENV=production" >> .env
    fi
fi

echo "Step 1: Building backend image..."
cd backend
docker build -t log-gen-core20-backend -f Dockerfile . || {
    echo "❌ Backend build failed!"
    exit 1
}
cd ..

echo ""
echo "Step 2: Verifying backend image was created..."
docker images | grep log-gen-core20-backend

echo ""
echo "Step 3: Stopping existing backend container..."
docker-compose -f docker-compose.prod.yml stop backend || true

echo ""
echo "Step 4: Removing old backend container..."
docker-compose -f docker-compose.prod.yml rm -f backend || true

echo ""
echo "Step 5: Starting backend service (using pre-built image)..."
docker-compose -f docker-compose.prod.yml up -d backend

echo ""
echo "Step 6: Waiting for backend to start..."
echo "Waiting 20 seconds for initial startup..."
sleep 20

echo ""
echo "Step 7: Checking backend service status..."
docker-compose -f docker-compose.prod.yml ps backend

echo ""
echo "Step 8: Checking backend health..."
echo "=== Backend Health Check ==="
for i in {1..5}; do
    if docker-compose -f docker-compose.prod.yml exec -T backend wget --quiet --tries=1 --spider http://localhost:3001/health 2>/dev/null; then
        echo "✅ Backend is healthy"
        break
    else
        if [ $i -eq 5 ]; then
            echo "⚠️  Backend health check failed after 5 attempts"
        else
            echo "   Attempt $i failed, retrying in 5 seconds..."
            sleep 5
        fi
    fi
done

echo ""
echo "Step 9: Recent backend logs..."
echo "=== Backend Logs (last 20 lines) ==="
docker-compose -f docker-compose.prod.yml logs --tail=20 backend

echo ""
echo "=== Backend Deployment Complete ==="
echo ""
echo "Backend service has been updated. Useful commands:"
echo "  docker-compose -f docker-compose.prod.yml ps backend     # Check status"
echo "  docker-compose -f docker-compose.prod.yml logs -f backend # Follow logs"
echo "  docker-compose -f docker-compose.prod.yml restart backend # Restart backend"
echo ""
echo "To run migrations (if needed):"
echo "  docker-compose -f docker-compose.prod.yml exec backend npm run migration:run"
echo ""

