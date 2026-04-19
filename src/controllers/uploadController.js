import pdfWrapper from "../lib/pdfWrapper.cjs";
import { saveCandidateToDatabase } from "../services/candidateService.js";
import { uploadPdfToCloudinary } from "../services/cloudinaryService.js";
import { extractCandidateData } from "../prompts/extractCvPrompt.js"
import { matchCandidateToAllVacancies } from "../services/matchingService.js";
import prisma from "../lib/prisma.js";

export const processResumes = async (req, res) => {
    const pdfFiles = req.files;

    const { positionId } = req.body;

    const userId = req.user.id;

    // Validate if one or multiples PDFs files exists
    if (!pdfFiles || pdfFiles.length === 0) return res.status(400).json({ error: "No PDFs uploaded" });
    if (!userId) return res.status(400).json({ error: "userId is strictly required" });

    // parse the variables
    const parsedUserId = parseInt(userId, 10);
    const parsedPositionId = positionId ? parseInt(positionId, 10) : null;

    if (isNaN(parsedUserId)) return res.status(400).json({ error: "userId must be a valid number" });
    if (positionId && isNaN(parsedPositionId)) return res.status(400).json({ error: "positionId must be a valid number" });
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

            aiCandidateJson.cvUrl = cloudinaryUrl;

            const savedCadidate = await saveCandidateToDatabase(
                aiCandidateJson,
                cloudinaryUrl,
                parsedUserId,
                parsedPositionId
            );

            await matchCandidateToAllVacancies(prisma, userId, savedCadidate)

            const cloudinaryUrl = await uploadPdfToCloudinary(pdfFile.buffer, pdfFile.originalname);
            console.log(`Cloudinary Upload sucess: ${cloudinaryUrl}`);

            // Push the database record result into the array, not just the raw JSON
            processedCandidates.push(savedCadidate);
        } catch (error) {
            console.error(`Failed to parse PDF: ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "CV extraction complete!",
        fileData: processedCandidates
    });
};