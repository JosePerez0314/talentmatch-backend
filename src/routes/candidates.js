import express from "express";
import prisma from "../lib/prisma.js";
import upload from '../middlewares/multerConfig.js';

const router = express.Router();

// Sending the JSON to the Database

router.get('/', async (req, res) => {
    try {
        const allUsers = await prisma.user.findMany({
            include: {
                positions: true,
                candidates: true
            }
        })

        return res.status(200).json({ allUsers });
    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Failed to fetch Users" });
    }
})

router.post('/user', async (req, res) => {
    const payload = req.body;

    try {
        if (!payload) {
            res.status(400).json({ error: "Error to receive the data" });
            return
        }

        const newUser = await prisma.user.create({
            data: {
                email: payload.email,
                password: payload.password
            }
        });

        console.log("Database write succesful:", newUser);

        return res.status(201).json({
            message: 'Data receive successfully',
            userId: newUser.id
        });

    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }

});

router.post('/position', async (req, res) => {
    const payload = req.body; // JSON container aplied in index.js

    if (!payload) {
        res.status(400).json({ error: "Error to receive the data" });
        return;
    }

    try {
        const newPosition = await prisma.position.create({
            data: {
                role: payload.role,
                yearsOfExperience: payload.yearsOfExperience,
                technicalSkills: payload.technicalSkills,
                optionalTechnicalSkills: payload.optionalTechnicalSkills,
                softSkills: payload.softSkills,
                description: payload.description,
                education: payload.education,
                languages: payload.languages,
                userId: payload.userId
            }
        });

        console.log("Database write succesful:", newPosition.role);

        return res.status(201).json({ message: 'Data receive successfully' });

    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

router.post('/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded" })
    }

    return res.status(200).json({
        message: "PDF upload successfully to Cloudinary!",
        fileData: req.file
    });
});

export default router;