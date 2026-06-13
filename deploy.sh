#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Running migrations..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

echo "Done. Checking logs..."
docker compose -f docker-compose.prod.yml logs --tail=50 api