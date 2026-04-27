import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { sendResponseOr404 } from "../lib/responseHandler.js";

export const createUser = async (req, res, next) => {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ error: "No data provided in the request body" });
    if (!payload.email || !payload.password) return res.status(400).json({ success: false, error: "Missing required fields: 'email' and 'password' are mandatory." });

    //bcrypt password
    const userTypedPassword = payload.password;
    const costFactor = 10;
    const safeHashedString = await bcrypt.hash(userTypedPassword, costFactor);

    const emailNormalized = payload.email.toLowerCase().trim();

    const newUser = await prisma.user.create({
        data: {
            email: emailNormalized,
            password: safeHashedString
        }
    });

    console.log("Database write successful:", newUser);

    return res.status(201).json({
        message: 'Data received successfully',
        userId: newUser.id
    });
}

export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password are required"
            });
        }

        const emailNormalized = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: { email: emailNormalized },
            select: {
                id: true,
                email: true,
                password: true,
                role: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password"
            })
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        console.log("Searching email:", emailNormalized);

        return res.status(200).json({
            success: true,
            token
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
};