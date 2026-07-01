import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

const DEFAULT_DEPARTMENTS: string[] = [
  "Recursos Humanos (HR)",
  "Tecnología / TI",
  "Finanzas",
  "Marketing",
  "Ventas",
  "Operaciones",
  "Atención al Cliente",
  "Legal",
  "Servicio al Cliente",
  "Logística",
];

interface JwtPayload {
  userId: number;
  role: string;
}

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password }: { email: string; password: string } = req.body;

    const normalizedEmail: string = email.toLowerCase().trim();

    const hashedPassword: string = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    await prisma.department.createMany({
      data: DEFAULT_DEPARTMENTS.map((title) => ({
        title,
        userId: newUser.id,
      })),
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      userId: newUser.id,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        success: false,
        error: "Email alredy exists",
      });
      return;
    }

    next(error);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password }: { email: string; password: string } = req.body;

    const emailNormalized: string = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: emailNormalized },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    const isPasswordValid: boolean = await bcrypt.compare(
      password,
      user!.password,
    );

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    const token = jwt.sign(
      { userId: user!.id, role: user!.role } as JwtPayload,
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user!.id,
        email: user!.email,
        role: user!.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};
