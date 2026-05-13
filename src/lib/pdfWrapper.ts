// lib/pdfWrapper.cjs
import pdf from "pdf-parse";

export const extract = async (buffer: Buffer): Promise<string> => {
  const data = await pdf(buffer);
  return data.text;
};
