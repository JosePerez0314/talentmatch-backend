// lib/pdfWrapper.cjs
import pdf from "pdf-parse";

// pdf-parse (pdf.js under the hood) intermittently throws transient parse
// errors — most commonly "bad XRef entry" — when many documents are parsed in
// the same process, even for perfectly valid PDFs (the exact same buffer can
// fail on one call and succeed on the next). Left unhandled, that silently
// drops a legitimate CV during a batch upload, so we retry a few times before
// giving up. A genuinely corrupt/encrypted PDF still fails every attempt and
// the final error is rethrown unchanged, preserving the caller's error path.
// Failures tend to come in short bursts (a few consecutive calls fail, then
// recover), so a handful of attempts clears even a tight in-process loop; the
// real flow spaces extractions out with the OpenAI await and rarely fails once.
const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 50;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const extract = async (buffer: Buffer): Promise<string> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await delay(RETRY_DELAY_MS);
    }
  }

  // Unreachable: the loop above always returns on success or throws on the
  // final attempt — this only satisfies the compiler's control-flow analysis.
  throw new Error("PDF extraction failed after retries");
};
