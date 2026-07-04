import { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import cloudinary from "../lib/cloudinaryConfig.js";

type CloudinaryFolder =
  | "talentmatch_candidates_resumes"
  | "talentmatch_positions";

/**
 * Sube un buffer PDF a Cloudinary vía upload_stream y resuelve con la secure_url.
 * Centraliza la lógica de subida para CVs y descripciones de posición.
 */
const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  originalName: string,
  userId: number,
  folder: CloudinaryFolder,
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${folder}/${userId}`,
        resource_type: "auto",
        public_id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${originalName.replace(/\.pdf$/i, "")}`,
        format: "pdf",
      },
      (
        error: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined,
      ) => {
        if (error || !result) {
          console.error("Cloudinary Stream Error:", error);
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(fileBuffer);
  });
};

export const uploadPdfToCloudinary = (
  fileBuffer: Buffer,
  originalName: string,
  userId: number,
): Promise<string> =>
  uploadBufferToCloudinary(
    fileBuffer,
    originalName,
    userId,
    "talentmatch_candidates_resumes",
  );

export const uploadPositionToCloudinary = (
  fileBuffer: Buffer,
  originalName: string,
  userId: number,
): Promise<string> =>
  uploadBufferToCloudinary(
    fileBuffer,
    originalName,
    userId,
    "talentmatch_positions",
  );
