import express from "express";
import upload from '../middlewares/multerConfig.js';

const router = express.Router();

router.post('/', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded" })
    }

    return res.status(200).json({
        message: "PDF upload successfully to Cloudinary!",
        fileData: req.file
    });
});

export default router;