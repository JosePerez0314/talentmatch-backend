import pdfWrapper from "../lib/pdfWrapper.cjs";
import { saveCandidateToDatabase } from "../services/candidateService.js";
import { uploadPdfToCloudinary } from "../services/cloudinaryService.js";
import { extractCandidateData } from "../services/openaiService.js"

export const processResumes = async (req, res) => {
    const pdfFiles = req.files;

    const { userId, positionId } = req.body;

    // Validate if one or multiples PDFs files exists
    if (!pdfFiles || pdfFiles.length === 0) return res.status(400).json({ error: "No PDFs uploaded" });

    // parse the variables
    const parsedUserId = parseInt(userId, 10);
    const parsedPositionId = parseInt(positionId, 10);

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

            const cloudinaryUrl = await uploadPdfToCloudinary(pdfFile.buffer, pdfFile.originalname);
            console.log(`Cloudinary Upload sucess: ${cloudinaryUrl}`);

            aiCandidateJson.cvUrl = cloudinaryUrl;

            const savedCadidate = await saveCandidateToDatabase(
                aiCandidateJson,
                cloudinaryUrl,
                parsedUserId,
                parsedPositionId
            );

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