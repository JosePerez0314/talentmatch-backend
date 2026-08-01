/**
 * BUG-002 backfill: create Application rows for candidates that have MatchResult
 * records but no Application row.
 *
 * Context: Application rows were introduced on 2026-07-13. Candidates uploaded
 * and evaluated before that date have MatchResult rows (linking candidateId to
 * vacancyId) but no corresponding Application row. The PATCH candidate-status
 * endpoint requires an Application row to exist, so those candidates return 404
 * when a recruiter tries to change their status.
 *
 * This script is safe to run multiple times — it uses createMany with
 * skipDuplicates so existing Application rows are never overwritten.
 *
 * Usage (run once against the target database):
 *   DATABASE_URL="..." npx tsx scripts/backfill-applications.ts
 */

import prisma from "../src/lib/prisma.js";

async function main() {
  // Find all (candidateId, vacancyId) pairs from MatchResult that have no
  // corresponding Application row.
  const orphaned = await prisma.$queryRaw<
    { candidateId: number; vacancyId: number }[]
  >`
    SELECT DISTINCT mr.candidateId, mr.vacancyId
    FROM MatchResult mr
    WHERE NOT EXISTS (
      SELECT 1 FROM Application a
      WHERE a.candidateId = mr.candidateId
        AND a.vacancyId   = mr.vacancyId
    )
  `;

  if (orphaned.length === 0) {
    console.log("No orphaned MatchResult rows found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${orphaned.length} pair(s) missing an Application row. Backfilling...`);

  const result = await prisma.application.createMany({
    data: orphaned.map(({ candidateId, vacancyId }) => ({
      candidateId,
      vacancyId,
      status: "PENDIENTE",
    })),
    skipDuplicates: true,
  });

  console.log(`Done. Created ${result.count} Application row(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
