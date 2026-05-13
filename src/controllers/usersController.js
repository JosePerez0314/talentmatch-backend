import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { sendResponseOr404 } from "../lib/responseHandler.ts";

export const createUser = async (req, res, next) => {
    try {
        const { email, password } = req.validated.body;

        const normalizedEmail = email.toLowerCase().trim();

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword
            }
        });

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            userId: newUser.id
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                error: "Email alredy exists"
            });
        }

        return next(error);
    }
}

export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.validated.body;

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
                error: "Invalid email or password"
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        return next(error);
    }
};