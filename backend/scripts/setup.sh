#!/bin/bash

echo "Setting up Multi-Tenant SaaS Backend..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "Please update .env with your configuration"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Wait for database to be ready
echo "Waiting for database..."
sleep 5

# Run migrations
echo "Running migrations..."
npm run migration:run

# Seed database
echo "Seeding database..."
npm run seed

echo "Setup complete!"
echo "Default admin credentials:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo ""
echo "Start the server with: npm run dev"

