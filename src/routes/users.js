import express from "express";
import prisma from "../lib/prisma.js";

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

router.post('/', async (req, res) => {
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

export default router;