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
            // Extract text
            // pass the memory buffer to pdf-parse
            const data = await pdfWrapper.extract(pdfFile.buffer);
            const extractedText = data.text;

            if (extractedText.trim().length < 500) {
                throw new Error("Insufficient text. The PDF might be a scanned image (OCR required).");
            }

            // 2. Extract RAW Candidate JSON (No position context yet)
            console.log(`Sending ${pdfFile.originalname} to OpenAI for extraction...`);
            const aiCandidateJson = await extractCandidateData(data.text);

            // HARD VALIDATION
            if (!aiCandidateJson || !aiCandidateJson.fullName) {
                throw new Error("AI extraction returned invalid structure");
            }

            // 3. Upload to Cloudinary (FIXED ORDER)
            const cloudinaryUrl = await uploadPdfToCloudinary(pdfFile.buffer, pdfFile.originalname);
            console.log(`Cloudinary Upload success: ${cloudinaryUrl}`);


            // 4. Attach URL to payload
            aiCandidateJson.cvUrl = cloudinaryUrl;

            // 5. Save the RAW candidate to the database
            const savedCadidate = await saveCandidateToDatabase(
                aiCandidateJson,
                cloudinaryUrl,
                parsedUserId,
                parsedPositionId
            );

            // Push the database record result into the array, not just the raw JSON
            processedCandidates.push(savedCadidate);

            // MathScore
            await matchCandidateToAllVacancies(prisma, userId, savedCadidate)

        } catch (error) {
            console.error(`Failed to parse PDF: ${pdfFile.originalname}`, error.message);
        }
    }

    return res.status(201).json({
        message: "CV extraction complete!",
        fileData: processedCandidates
    });
};