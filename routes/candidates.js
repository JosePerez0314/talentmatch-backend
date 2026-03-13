import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.post('/evaluate', async (req, res) => {
    const payload = req.body;

    if (!payload) {
        res.status(400).json({ error: "Error to receive the data" });
        return;
    }

    try {
        const newUser = await prisma.user.create({
            data: {
                email: "payload.email",
                password: "12345",
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