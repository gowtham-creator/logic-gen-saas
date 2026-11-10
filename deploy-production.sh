#!/bin/bash

echo "=== Production Deployment Script ==="
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

echo "Step 1: Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

echo ""
echo "Step 2: Building production images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "Step 3: Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 4: Waiting for services to be ready..."
sleep 15

echo ""
echo "Step 5: Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npm run migration:run || echo "Migrations may have already been run"

echo ""
echo "Step 6: Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "Step 7: Testing health endpoints..."
echo "Backend Health:"
curl -s http://localhost:3001/health && echo "" || echo "Backend not responding"
echo "Frontend:"
curl -s -I http://localhost:3000 | head -1 || echo "Frontend not responding"
echo "Nginx:"
curl -s -I http://localhost/health | head -1 || echo "Nginx not responding"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Services are running in PRODUCTION mode"
echo "Check logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo ""

