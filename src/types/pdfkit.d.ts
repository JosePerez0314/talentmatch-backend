// Minimal ambient declaration for pdfkit — the package ships no types and
// @types/pdfkit is not installed. Only the surface used by the test PDF helper
// (src/tests/utils/pdf.util.ts) is declared here, keeping the code free of `any`.
declare module "pdfkit" {
  import { Readable } from "node:stream";

  class PDFDocument extends Readable {
    constructor(options?: Record<string, unknown>);
    text(text: string): this;
    end(): void;
  }

  export default PDFDocument;
}
