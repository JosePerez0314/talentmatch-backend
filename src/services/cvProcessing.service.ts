import prisma from "../lib/prisma.js";
import { generateCvHash } from "../utils/hash.util.js";
import type { Candidate } from "@prisma/client";

export interface CvExistenceResult {
  hash: string;
  existingCandidate: Candidate | null;
}

/**
 * Generates the SHA-256 hash of the CV buffer and checks (deduplication)
 * whether a candidate with that hash already exists **for this user**.
 * Creates nothing: it only evaluates existence and returns the hash so the
 * controller can decide whether to continue the pipeline.
 *
 * Scoped by userId because the hash-uniqueness is per-user, not global — two
 * different companies uploading the same PDF must never share a row.
 */
export const findExistingCandidateByCv = async (
  fileBuffer: Buffer,
  userId: number,
): Promise<CvExistenceResult> => {
  const hash = generateCvHash(fileBuffer);

  const existingCandidate = await prisma.candidate.findFirst({
    where: { hash, userId },
  });

  return { hash, existingCandidate };
};
