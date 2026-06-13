#!/bin/bash
# TalentMatch AI - Local Development Migration Script
# Usage: ./migrate.sh "migration_name"
# Example: ./migrate.sh "create_candidate_table"

# Stop execution if any command fails
set -e

echo "=== TalentMatch AI: Local Migration System ==="

# 1. Validate migration name argument
if [ -z "$1" ]; then
  echo "!!! ERROR: You must provide a migration name."
  echo "    Usage: ./migrate.sh \"migration_name\""
  exit 1
fi

# 2. Pre-flight Connectivity Check
# We check if port 3307 (our mapped host port) is open before attempting migration
echo ">>> Checking if database is reachable on port 3307..."
if ! nc -z localhost 3307; then
  echo "!!! ERROR: Database not reachable on port 3307."
  echo "    Ensure 'docker compose' is running."
  exit 1
fi

# 3. Run Prisma Migration
echo ">>> Running prisma migrate dev for: '$1'..."
npx prisma migrate dev --name "$1"

# 4. Sync Prisma Client
# This regenerates the TypeScript types immediately
echo ">>> Regenerating Prisma Client types..."
npx prisma generate

# 5. Stage migration files
echo ">>> Staging migration files..."
git add prisma/migrations/
git add prisma/schema.prisma

echo ""
echo "✅ Success!"
echo ">>> Migration '$1' created, generated, and staged."
echo ">>> Review: 'git status'"
echo ">>> Commit: 'git commit -m \"feat: $1\"'"