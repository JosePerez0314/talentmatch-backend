import crypto from 'crypto';

export const generateCvHash = (parsedText) => {
    return crypto
        .createHash("sha256")
        .update(parsedText.trim())
        .digest("hex");
};