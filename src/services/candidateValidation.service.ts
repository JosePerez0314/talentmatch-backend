import { CandidateExtracted } from "../types/candidates.types.js";

/**
 * Raised when the AI-extracted profile carries no candidate data, i.e. the
 * uploaded PDF is not a CV. Thrown per file so the caller can stop processing
 * that single PDF while the rest of the batch keeps going.
 */
export class NotACvError extends Error {
  constructor(message = "Uploaded PDF is not a valid CV") {
    super(message);
    this.name = "NotACvError";
  }
}

/**
 * The extraction prompt returns an all-blank shape (empty strings/arrays,
 * yearsOfExperience 0, educationLevel "NONE") whenever the PDF is not actually
 * a resume. A profile is treated as empty only when EVERY meaningful field is
 * blank, so a real CV that happens to miss one field is never rejected.
 */
export const isEmptyCandidateProfile = (
  candidate: CandidateExtracted,
): boolean => {
  const noText =
    !candidate.fullName?.trim() &&
    !candidate.email?.trim() &&
    !candidate.role?.trim() &&
    !candidate.description?.trim() &&
    !candidate.educationArea?.trim();

  const noEducation =
    !candidate.educationLevel?.trim() ||
    candidate.educationLevel.trim().toUpperCase() === "NONE";

  const noExperience = !candidate.yearsOfExperience;

  const noSkills =
    (candidate.technicalSkills?.length ?? 0) === 0 &&
    (candidate.optionalTechnicalSkills?.length ?? 0) === 0 &&
    (candidate.softSkills?.length ?? 0) === 0 &&
    (candidate.languages?.length ?? 0) === 0;

  return noText && noEducation && noExperience && noSkills;
};

/**
 * Throws NotACvError when the extracted profile is empty, so the upload
 * pipeline can reject a non-CV PDF before spending a Cloudinary upload on it.
 */
export const assertCandidateIsCv = (candidate: CandidateExtracted): void => {
  if (isEmptyCandidateProfile(candidate)) {
    throw new NotACvError();
  }
};
