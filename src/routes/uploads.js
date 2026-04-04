import express from "express";
import upload from '../middlewares/multerConfig.js';
import { catchAsync } from "../lib/catchAsync.js";
import { extractCandidateData } from "../services/openaiService.js"

import pdfWrapper from "../lib/pdfWrapper.cjs";

const router = express.Router();

router.post('/', upload.array('pdfs', 100), catchAsync(async (req, res) => {
    const pdfFiles = req.files;

    // Validate if one or multiples PDFs files exists
    if (!pdfFiles || pdfFiles.length === 0) return res.status(400).json({ error: "No PDFs uploaded" });

    const processedCandidates = [];

    for (const pdfFile of pdfFiles) {
        console.log(`Processing file: ${pdfFile.originalname}`);

        try {
            // pass the memory buffer to pdf-parse
            const data = await pdfWrapper.extract(pdfFile.buffer);
            const extractedText = data.text;

            if (extractedText.trim().length < 500) {
                throw new Error("Insufficient text. The PDF might be a scanned image (OCR required).");
            }

            console.log(`Sending ${pdfFile.originalname} to OpenAI for extraction...`);

            const aiCandidateJson = await extractCandidateData(extractedText);

            console.log(`\n--- Extracted Text from ${pdfFile.originalname} ---`)
            console.log(JSON.stringify(aiCandidateJson, null, 2));

            processedCandidates.push(aiCandidateJson);


            // [TODO 3]: Save the JSON to your Prisma database (Candidate & MatchResult)

        } catch (error) {
            console.error(`Failed to parse PDF: ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "CV extraction complete!",
        fileData: processedCandidates
    });
}));

export default router;