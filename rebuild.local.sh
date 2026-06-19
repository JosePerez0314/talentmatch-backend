#!/bin/bash
set -e

echo "⚠️ Performing full system rebuild..."

# 1. Syncronized all changes

git pull origin main

# 2. Take down all containers and networks
docker compose -f docker-compose.local.yml down

# 3. Rebuild the images and start everything fresh
docker compose -f docker-compose.local.yml up -d --build

# 4. Clean up dangling images to save space
docker image prune -f

echo "✅ Full rebuild complete. System is stable."

docker compose -f docker-compose.local.yml ps