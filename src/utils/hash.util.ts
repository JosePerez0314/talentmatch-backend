import crypto from "crypto";

export const generateCvHash = (input: string | Buffer): string => {
  const data = typeof input === "string" ? input.trim() : input;
  return crypto.createHash("sha256").update(data).digest("hex");
};
