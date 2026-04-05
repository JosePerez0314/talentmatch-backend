import cloudinary from '../lib/cloudinaryConfig.js'

export const uploadPdfToCloudinary = (fileBuffer, originalName) => {
    return new Promise((resolve, reject) => {
        // Handle the memory buffer directly
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'talentmatch_resumes',
                resource_type: 'auto',
                public_id: `${Date.now()}-${originalName.replace(/\.pdf$/i, '')}`,
                format: 'pdf'
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary Stream Error:", error);
                    return reject(new Error("Cloudinary upload failed"));
                }

                resolve(result.secure_url);
            }
        );

        uploadStream.end(fileBuffer);
    });
}