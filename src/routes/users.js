import express from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt"
import { sendResponseOr404 } from "../lib/responseHandler.js"
import { catchAsync } from "../lib/catchAsync.js";

const router = express.Router();

// Sending the JSON to the Database

router.get('/', catchAsync(async (req, res, next) => {
    const allUsers = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            createdAt: true
        }
    })

    return sendResponseOr404(res, allUsers, "Users");
}));

router.post('/', catchAsync(async (req, res, next) => {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ error: "No data provided in the request body" });
    if (!payload.email || !payload.password) return res.status(400).json({ success: false, error: "Missing required fields: 'email' and 'password' are mandatory." });

    //bcrypt password
    const userTypedPassword = payload.password;
    const costFactor = 10;
    const safeHashedString = await bcrypt.hash(userTypedPassword, costFactor);


    const newUser = await prisma.user.create({
        data: {
            email: payload.email,
            password: safeHashedString
        }
    });

    console.log("Database write successful:", newUser);

    return res.status(201).json({
        message: 'Data received successfully',
        userId: newUser.id
    });
}));

router.post('/login', catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
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

    return sendResponseOr404(res, user_data, "User");
}));

export default router;