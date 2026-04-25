import { generateCvHash } from "../utils/hash.util";
import prisma from "../lib/prisma.js"

export const processCandidateCv = async (parsedText) => {
    const cvHash = generateCvHash(parsedText);

    const existingProfile = await prisma.candidate.findUnique({
        where: { hash: cvHash }
    });

    if (existingProfile) {
        return existingProfile; // <500ms response
    }

    const normalizedData = await 
}