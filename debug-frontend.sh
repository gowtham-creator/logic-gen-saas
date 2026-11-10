#!/bin/bash

echo "=== Frontend Container Debug ==="
echo ""

echo "1. Checking if frontend container exists..."
docker ps -a | grep multitenant-frontend

echo ""
echo "2. Frontend container logs (last 50 lines):"
docker logs multitenant-frontend --tail=50 2>&1

echo ""
echo "3. Checking if container is running..."
docker inspect multitenant-frontend --format='{{.State.Status}}' 2>/dev/null || echo "Container not found"

echo ""
echo "4. Checking health status..."
docker inspect multitenant-frontend --format='{{json .State.Health}}' 2>/dev/null | python3 -m json.tool || echo "No health check data"

echo ""
echo "5. Testing if port 3000 is accessible from inside container..."
docker exec multitenant-frontend wget -q -O- http://localhost:3000 2>&1 | head -5 || echo "Cannot access port 3000"

echo ""
echo "6. Checking if Next.js process is running..."
docker exec multitenant-frontend ps aux | grep -E "node|next" || echo "No Next.js process found"

echo ""
echo "7. Checking if .next directory exists..."
docker exec multitenant-frontend ls -la /app/.next 2>&1 | head -10 || echo ".next directory not found"

echo ""
echo "8. Checking environment variables..."
docker exec multitenant-frontend env | grep -E "NODE_ENV|NEXT_PUBLIC" || echo "No environment variables found"

echo ""
echo "=== Debug Complete ==="

