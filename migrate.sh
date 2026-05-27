#!/bin/bash
# Local dev migration script for TalentMatch AI
# Usage: ./migrate.sh "migration_name"
# Example: ./migrate.sh "add_skills_table"

set -e

echo "=== TalentMatch Local Migration ==="

# ----- Step 1: Validate migration name was provided -----
if [ -z "$1" ]; then
  echo "!!! ERROR: Provide a migration name"
  echo "    Usage: ./migrate.sh \"migration_name\""
  exit 1
fi

# ----- Step 2: Run Prisma migration against local Docker DB -----
echo ">>> Running prisma migrate dev..."
npx prisma migrate dev --name "$1"

# ----- Step 3: Stage migration files for commit -----
echo ">>> Staging migration files..."
git add prisma/migrations/
git add prisma/schema.prisma

echo ""
echo ">>> Done! Migration '$1' created and staged."
echo ">>> Review staged files with: git status"
echo ">>> Then commit with: git commit -m 'your message'"