#!/bin/bash

echo "=== Frontend Diagnosis ==="
echo ""

echo "1. Checking if frontend image exists..."
docker images | grep -E "frontend|log-gen-core20-frontend" || echo "❌ Frontend image NOT FOUND"

echo ""
echo "2. Checking all images..."
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10

echo ""
echo "3. Checking docker-compose configuration..."
docker-compose -f docker-compose.prod.yml config --services | grep frontend || echo "Frontend service not in config"

echo ""
echo "4. Attempting to build frontend..."
docker-compose -f docker-compose.prod.yml build frontend 2>&1 | tail -30

echo ""
echo "5. Checking if build was successful..."
if docker images | grep -q "log-gen-core20-frontend"; then
    echo "✓ Image exists after build"
    docker images | grep "log-gen-core20-frontend"
else
    echo "❌ Image still doesn't exist - build may have failed"
fi

echo ""
echo "6. Trying to start frontend service..."
docker-compose -f docker-compose.prod.yml up -d frontend 2>&1

echo ""
echo "7. Waiting 3 seconds..."
sleep 3

echo ""
echo "8. Checking container status..."
docker-compose -f docker-compose.prod.yml ps frontend

echo ""
echo "9. Checking all containers..."
docker ps -a | grep -E "frontend|multitenant" || echo "No containers found"

echo ""
echo "10. If container exists, checking logs..."
if docker ps -a --format "{{.Names}}" | grep -q "multitenant-frontend"; then
    echo "=== Container Logs ==="
    docker logs multitenant-frontend --tail=30 2>&1
else
    echo "Container still doesn't exist"
fi

echo ""
echo "=== Diagnosis Complete ==="

