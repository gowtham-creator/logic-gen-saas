#!/bin/bash
# Script to create Keycloak database

echo "Creating Keycloak database..."

docker-compose exec -T postgres psql -U postgres <<EOF
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
EOF

echo "Keycloak database created (or already exists)"

