#!/bin/bash

echo "=== Starting Production Services ==="
echo ""

echo "Step 1: Checking if images exist..."
if ! docker images | grep -q "log-gen-core20-frontend"; then
    echo "❌ Frontend image not found. Building..."
    cd frontend
    docker build -t log-gen-core20-frontend -f Dockerfile . || {
        echo "Frontend build failed!"
        exit 1
    }
    cd ..
else
    echo "✓ Frontend image exists"
fi

if ! docker images | grep -q "log-gen-core20-backend"; then
    echo "❌ Backend image not found. Building..."
    cd backend
    docker build -t log-gen-core20-backend -f Dockerfile . || {
        echo "Backend build failed!"
        exit 1
    }
    cd ..
else
    echo "✓ Backend image exists"
fi

echo ""
echo "Step 2: Listing available images..."
docker images | grep -E "log-gen-core20|postgres|redis|nginx"

echo ""
echo "Step 3: Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 4: Waiting for services to initialize..."
sleep 10

echo ""
echo "Step 5: Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "Step 6: Checking which containers are actually running..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Step 7: Checking logs for any errors..."
echo "=== Backend ==="
docker-compose -f docker-compose.prod.yml logs --tail=10 backend 2>&1

echo ""
echo "=== Frontend ==="
docker-compose -f docker-compose.prod.yml logs --tail=10 frontend 2>&1

echo ""
echo "=== Postgres ==="
docker-compose -f docker-compose.prod.yml logs --tail=5 postgres 2>&1

echo ""
echo "=== Redis ==="
docker-compose -f docker-compose.prod.yml logs --tail=5 redis 2>&1

echo ""
echo "=== Nginx ==="
docker-compose -f docker-compose.prod.yml logs --tail=5 nginx 2>&1

echo ""
echo "=== Start Complete ==="
echo ""
echo "If containers aren't running, check logs above for errors"
echo "View all logs: docker-compose -f docker-compose.prod.yml logs"
echo "View specific service: docker-compose -f docker-compose.prod.yml logs frontend"

