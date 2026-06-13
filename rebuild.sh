#!/bin/bash
set -e

echo "⚠️ Performing full system rebuild..."

# 1. Take down all containers and networks
docker compose down

# 2. Rebuild the images and start everything fresh
docker compose up -d --build

# 3. Clean up dangling images to save space
docker image prune -f

echo "✅ Full rebuild complete. System is stable."