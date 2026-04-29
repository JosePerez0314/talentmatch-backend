import pdfWrapper from "../lib/pdfWrapper.cjs";
import { saveCandidateToDatabase } from "../services/candidateService.js";
import { uploadPdfToCloudinary } from "../services/cloudinaryService.js";
import { extractCandidateData } from "../prompts/extractCvPrompt.js"
import { matchCandidateToAllVacancies } from "../services/matchingService.js";
import prisma from "../lib/prisma.js";
import { processCandidateCv } from "../services/cvProcessingService.js";

export const processResumes = async (req, res) => {
    const pdfFiles = req.files;
    const userId = req.user.id;

    if (!pdfFiles || pdfFiles.length === 0) {
        return res.status(400).json({ error: "No PDFs uploaded" });
    }

    const processedCandidates = [];

    for (const pdfFile of pdfFiles) {
        try {
            const data = await pdfWrapper.extract(pdfFile.buffer);
            const extractedText = data.text;

            if (extractedText.trim().length < 500) {
                throw new Error("Insufficient text in PDF");
            }

            const { candidate, cacheHit } = await processCandidateCv(
                extractedText,
                userId
            );

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

            await matchCandidateToAllVacancies(prisma, userId, candidate);

        } catch (error) {
            console.error(`Failed to process ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "CV extraction complete",
        fileData: processedCandidates
    });
};