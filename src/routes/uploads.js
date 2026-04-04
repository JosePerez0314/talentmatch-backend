import express from "express";
import upload from '../middlewares/multerConfig.js';
import { catchAsync } from "../lib/catchAsync.js";

// Import parse with CommonJS

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const router = express.Router();

router.post('/', upload.array('pdfs', 100), catchAsync(async (req, res) => {
    const pdfFiles = req.files;

    // Validate if one or multiples PDFs files exists
    if (!pdfFiles || pdfFiles.length === 0) return res.status(400).json({ error: "No PDFs uploaded" });

    const processedCandidates = [];

    for (const pdfFile of pdfFiles) {
        console.log(`Processing file: ${pdfFile}`);

        try {
            // pass the memory buffer to pdf-parse
            const data = await pdf(pdfFile.buffer);
            const extractedText = data.text;

            if (extractedText.trim().length < 150) {
                throw new Error("Insufficient text. The PDF might be a scanned image (OCR required).");
            }

            console.log(`\n--- Extracted Text from ${pdfFile.originalname} ---`)
            console.log(extractedText.substring(0, 300));

            // [TODO 2]: Send that text to OpenAI (Prompt 1) to get the JSON match
            // [TODO 3]: Save the JSON to your Prisma database (Candidate & MatchResult)

            // processedCandidates.push(databaseResult); 
        } catch (error) {
            console.error(`Failed to parse PDF: ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "PDF upload successfully to Cloudinary!",
        fileData: pdfFiles
    });
}));

export default router;