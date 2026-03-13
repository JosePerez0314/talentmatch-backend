import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

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

                candidate: {
                    create: {
                        fullName: payload.fullName,
                        role: payload.role,
                        email: payload.email, // Must be unique
                        fileUrl: payload.fileUrl,
                        technicalSkills: payload.technicalSkills,
                        softSkills: payload.softSkills,
                        personalProject: payload.personalProject,
                        phoneNumber: payload.phoneNumber, // Must be string
                        education: payload.education,
                        languages: payload.languages
                    }
                }
            },

        });

        console.log("Database write succesful:", newUser.email);

        return res.status(201).json({ message: 'Data receive successfully' });

    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" })
    }
});

export default router;