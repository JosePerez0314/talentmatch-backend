#!/bin/bash
# Halt execution immediately if any command fails
set -e

echo "➡️ Pulling latest code..."
git pull origin main

echo "➡️ Building and starting containers..."
# Assuming your file is named docker-compose.yml
docker compose up -d --build

echo "➡️ Cleaning up dangling images to prevent disk exhaustion..."
docker image prune -f

echo "➡️ Running database migrations..."
docker compose exec -T api npx prisma migrate deploy

echo "✅ Deployment complete. Tailing logs..."
docker compose logs --tail=50 api