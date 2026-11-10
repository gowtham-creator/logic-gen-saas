#!/bin/bash

echo "=== Building All Images Directly (Bypassing docker-compose bug) ==="
echo ""

echo "Step 1: Building backend image..."
cd backend
docker build -t log-gen-core20-backend -f Dockerfile . || {
    echo "❌ Backend build failed!"
    exit 1
}
cd ..
echo "✓ Backend image built"

echo ""
echo "Step 2: Building frontend image..."
cd frontend
docker build -t log-gen-core20-frontend -f Dockerfile . || {
    echo "❌ Frontend build failed!"
    exit 1
}
cd ..
echo "✓ Frontend image built"

echo ""
echo "Step 3: Building nginx image..."
cd nginx
docker build -t log-gen-core20-nginx -f Dockerfile . || {
    echo "❌ Nginx build failed!"
    exit 1
}
cd ..
echo "✓ Nginx image built"

echo ""
echo "Step 4: Verifying all images..."
docker images | grep -E "log-gen-core20-backend|log-gen-core20-frontend|log-gen-core20-nginx"

echo ""
echo "=== All Images Built Successfully ==="
echo ""
echo "Now you can start services with:"
echo "  docker-compose -f docker-compose.prod.yml up -d"

