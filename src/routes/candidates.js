import express from "express";
import prisma from "../lib/prisma.js";
import upload from '../middlewares/multerConfig.js';
import { error } from "node:console";

const router = express.Router();

// Giving the JSON to Front End
router.get("/", async (req, res) => {
    try {
        // Selecting all the object
        const allCandidates = await prisma.user.findMany({
            include: {
                jobRequirement: true,
                candidate: true,
            }
        });

        return res.status(200).json(allCandidates);
    } catch (error) {
        console.error("Database error", error)
        return res.status(500).json({ error: "Failed to fetch candidates" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const idSearch = parseInt(req.params.id);
        const allcandidate = await prisma.user.findMany({
            include: {
                jobRequirement: true,
                candidate: true
            }
        });

        if (isNaN(idSearch)) {
            res.status(400).json({ error: "We just accept number values" });
            return;
        }

        const idCandidates = allcandidate.find(c => c.id === idSearch)
        return idCandidates ? res.json((idCandidates)) : res.status(404).json({ error: "Candidate not found" });
    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Failed to fetch ID candidate" });
    }
});

// Sending the JSON to the Database

router.post('/evaluate', async (req, res) => {
    const payload = req.body; // JSON container aplied in index.js

    if (!payload) {
        res.status(400).json({ error: "Error to receive the data" });
        return;
    }

    try {
        const newUser = await prisma.user.create({
            data: {
                email: payload.email,
                password: payload.password,

                jobRequirement: {
                    create: {
                        role: payload.role,
                        yearsOfExperience: payload.yearsOfExperience,
                        technicalSkills: payload.technicalSkills,
                        optionalTechnicalSkills: payload.optionalTechnicalSkills,
                        softSkills: payload.softSkills,
                        description: payload.description,
                        education: payload.education,
                        languages: payload.languages
                    }
                },
            },

            include: { jobRequirement: true }
        });

        console.log("Database write succesful:", newUser.email);

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