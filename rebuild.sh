#!/bin/bash

echo "=== Stopping existing containers ==="
docker-compose down

echo -e "\n=== Rebuilding containers with latest changes ==="
docker-compose build --no-cache

echo -e "\n=== Starting all services ==="
docker-compose up -d

echo -e "\n=== Waiting for services to be ready ==="
sleep 10

echo -e "\n=== Running database migrations ==="
docker-compose exec -T backend npm run migration:run || echo "Migrations may have already been run"

echo -e "\n=== Seeding database ==="
docker-compose exec -T backend npm run seed || echo "Database may have already been seeded"

echo -e "\n=== Checking service status ==="
docker-compose ps

echo -e "\n=== Testing backend health ==="
sleep 2
curl -s http://localhost:3001/health && echo "" || echo "Backend not ready yet"

echo -e "\n=== Done! ==="
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Login: admin@example.com / admin123"
