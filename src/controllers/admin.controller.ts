import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";

type AdminController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getStats: AdminController = async (req, res, next) => {
  const [
    usersCount,
    candidatesCount,
    positionsCount,
    vacanciesCount,
    activeVacancies,
    closedVacancies,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.candidate.count(),
    prisma.position.count(),
    prisma.vacancy.count(),
    prisma.vacancy.count({ where: { status: "ACTIVE" } }),
    prisma.vacancy.count({ where: { status: "CLOSED" } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      usersCount,
      candidatesCount,
      positionsCount,
      vacanciesCount,
      activeVacancies,
      closedVacancies,
    },
  });
};

export const getAllUsers: AdminController = async (req, res, next) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      error: "Forbidden: Insufficient privileges",
    });
    return;
  }

  // 2. PAGINATION: Protect the database from memory overload
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const skip = (page - 1) * limit;

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc", // Deterministic sorting is required for pagination
      },
    }),
    prisma.user.count(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      meta: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
  });
};

export const updateUserRole: AdminController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const { role } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      email: true,
      role: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      userUpdated: user,
    },
  });
};

export const deleteUser: AdminController = async (req, res, next) => {
  const id = req.params.id as unknown as number;

  const user = await prisma.user.delete({
    where: { id },
  });

  res.status(200).json({
    success: true,
    data: {
      deleteId: id,
    },
  });
};
