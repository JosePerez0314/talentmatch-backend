import prisma from "../lib/prisma.js";
import { generateCvHash } from "../utils/hash.util.js";
import type { Candidate } from "@prisma/client";

export interface CvExistenceResult {
  hash: string;
  existingCandidate: Candidate | null;
}

/**
 * Generates the SHA-256 hash of the CV buffer and checks (deduplication)
 * whether a candidate with that hash already exists. Creates nothing: it only
 * evaluates existence and returns the hash so the controller can decide whether
 * to continue the pipeline.
 */
export const findExistingCandidateByCv = async (
  fileBuffer: Buffer,
): Promise<CvExistenceResult> => {
  const hash = generateCvHash(fileBuffer);

  const existingCandidate = await prisma.candidate.findUnique({
    where: { hash },
  });

  return { hash, existingCandidate };
};
