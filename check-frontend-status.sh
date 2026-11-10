#!/bin/bash

echo "=== Frontend Container Status Check ==="
echo ""

echo "1. Checking all containers..."
docker ps -a | grep -E "frontend|multitenant"

echo ""
echo "2. Checking if frontend container exists (stopped)..."
docker ps -a --filter "name=multitenant-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.ExitCode}}"

echo ""
echo "3. Checking frontend container logs (if exists)..."
if docker ps -a --format "{{.Names}}" | grep -q "multitenant-frontend"; then
    echo "=== Last 50 lines of logs ==="
    docker logs multitenant-frontend --tail=50 2>&1
else
    echo "Container doesn't exist yet"
fi

echo ""
echo "4. Checking docker-compose status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "5. Checking if frontend image exists..."
docker images | grep frontend

echo ""
echo "6. Attempting to start frontend..."
docker-compose -f docker-compose.prod.yml up -d frontend 2>&1

echo ""
echo "7. Waiting 5 seconds..."
sleep 5

echo ""
echo "8. Checking status again..."
docker-compose -f docker-compose.prod.yml ps frontend

echo ""
echo "9. Recent logs..."
docker-compose -f docker-compose.prod.yml logs --tail=30 frontend 2>&1

echo ""
echo "=== Status Check Complete ==="

