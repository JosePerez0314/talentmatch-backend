import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,

  // Limit file size to 5MB
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"));
    }
  },
});

export default upload;
