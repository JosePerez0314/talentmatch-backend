import express from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt"

const router = express.Router();

// Sending the JSON to the Database

router.get('/', async (req, res) => {
    try {
        const allUsers = await prisma.user.findMany({
            include: {
                positions: true,
                candidates: true,
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
        if (!payload || !payload.password) {
            res.status(400).json({ error: "Error to receive the data" });
            return
        }

        const userTypedPassword = payload.password;
        const costFactor = 10;
        const safeHashedString = await bcrypt.hash(userTypedPassword, costFactor);


        const newUser = await prisma.user.create({
            data: {
                email: payload.email,
                password: safeHashedString
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

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true
            }
        });

        if (!user) {
            return res.status(401).json({
                status: "failed",
                data: [],
                message: "Invalid email or password"
            })
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        )

        if (!isPasswordValid) {
            return res.status(401).json({
                status: "failed",
                data: [],
                message: "Invalid email or password"
            })
        }

        const { password: _, ...user_data } = user;

        return res.status(200).json({
            status: "success",
            data: [user_data],
            message: "You have successfully logged in."
        })

    } catch (error) {
        return res.status(500).json({
            status: "error",
            data: [],
            message: "Internal Server Error"
        });
    }
});

export default router;