#!/bin/bash

echo "=== Checking Docker Services ==="
docker-compose ps

echo -e "\n=== Testing Backend Health ==="
curl -s http://localhost:3001/health || echo "Backend not responding"

echo -e "\n=== Testing Database Connection ==="
docker-compose exec -T postgres pg_isready -U postgres || echo "Database not ready"

echo -e "\n=== Backend Logs (last 20 lines) ==="
docker-compose logs --tail=20 backend

echo -e "\n=== Frontend Logs (last 20 lines) ==="
docker-compose logs --tail=20 frontend
