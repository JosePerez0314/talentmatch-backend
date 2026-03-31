import express from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt"
import { sendResponseOr404 } from "../lib/responseHandler.js"

const router = express.Router();

// Sending the JSON to the Database

router.get('/', async (req, res, next) => {
    try {
        const allUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                createdAt: true
            }
        })

        return sendResponseOr404(res, allUsers, "Users");
    } catch (error) {
        next(error);
    }
})

router.post('/', async (req, res, next) => {
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
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
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
        next(error);
    }
});

export default router;