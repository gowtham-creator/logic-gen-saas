#!/bin/bash

echo "=== Fixing Frontend Build Issue ==="
echo ""

echo "Step 1: Stopping containers..."
docker-compose -f docker-compose.prod.yml down

echo ""
echo "Step 2: Removing old frontend image..."
docker rmi log-gen-core20-frontend 2>/dev/null || echo "Image not found (will rebuild)"

echo ""
echo "Step 3: Building frontend with verbose output..."
docker-compose -f docker-compose.prod.yml build --no-cache --progress=plain frontend 2>&1 | tee frontend-build.log

echo ""
echo "Step 4: Checking if build was successful..."
if grep -q "ERROR\|error\|failed" frontend-build.log; then
    echo "⚠ Build may have errors - check frontend-build.log"
else
    echo "✓ Build appears successful"
fi

echo ""
echo "Step 5: Testing the built image..."
docker run --rm --entrypoint sh log-gen-core20-frontend -c "ls -la /app/.next 2>&1 | head -20"

echo ""
echo "Step 6: Starting frontend container..."
docker-compose -f docker-compose.prod.yml up -d frontend

echo ""
echo "Step 7: Waiting for container to start..."
sleep 10

echo ""
echo "Step 8: Checking frontend logs..."
docker-compose -f docker-compose.prod.yml logs --tail=30 frontend

echo ""
echo "Step 9: Checking if .next directory exists in running container..."
docker exec multitenant-frontend ls -la /app/.next 2>&1 | head -20 || echo "Container not running or .next not found"

echo ""
echo "=== Fix Complete ==="
echo "Check frontend-build.log for detailed build output"
echo "Check logs with: docker-compose -f docker-compose.prod.yml logs -f frontend"

