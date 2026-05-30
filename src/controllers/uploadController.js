import { extract } from "../lib/pdfWrapper.ts";
import { saveCandidateToDatabase } from "../services/candidateService.js";
import { uploadPdfToCloudinary } from "../services/cloudinaryService.js";
import { extractCandidateData } from "../prompts/extractCvPrompt.js"
import { matchCandidateToVacancies } from "../services/matchingService.js";
import prisma from "../lib/prisma.js";
import { processCandidateCv } from "../services/cvProcessingService.js";

export const processResumes = async (req, res) => {
    const pdfFiles = req.files;
    const userId = req.user.id;

    if (!pdfFiles || pdfFiles.length === 0) {
        return res.status(400).json({ error: "No PDFs uploaded" });
    }

    console.log(`files exists ${pdfFiles.length}`)

    const processedCandidates = [];

    for (const pdfFile of pdfFiles) {
        try {
            const extractedText = await extract(pdfFile.buffer);
            console.log(`Extracted text from ${pdfFile.originalname}:`, extractedText.substring(0, 200)); // Log the first 200 characters

            if (extractedText.trim().length < 500) {
                throw new Error("Insufficient text in PDF");
            }

            const { candidate, cacheHit } = await processCandidateCv(
                extractedText,
                userId
            );

            if (candidate.fullName === "" && candidate.email === "no-email@talentmatch.com" && candidate.role === "") {
                return res.status(400).json({
                    success: false,
                    error: `AI failed to extract meaningful data from the CV. Please ensure the CV is in a standard format and contains clear information. ${pdfFile.originalname} may not be processed correctly.`,
                });
            }

            if (!candidate?.fullName) {
                throw new Error("Invalid AI candidate structure");
            }

            const cloudinaryUrl = await uploadPdfToCloudinary(
                pdfFile.buffer,
                pdfFile.originalname,
                userId
            );

            if (!cacheHit) {
                await prisma.candidate.update({
                    where: { id: candidate.id },
                    data: { fileUrl: cloudinaryUrl }
                });
            }

            processedCandidates.push(candidate);

            await matchCandidateToVacancies(prisma, candidate, userId);

        } catch (error) {
            console.error(`Failed to process ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "CV extraction complete",
        fileData: processedCandidates
    });
};