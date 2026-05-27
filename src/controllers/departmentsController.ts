import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";

const departmentSelectProject: object = {
  id: true,
  userId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
};

export const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const allDepartments = await prisma.department.findMany({
    where: { userId: req.user!.id },
    select: {
      ...departmentSelectProject,
    },
  });

  sendResponseOr404(res, allDepartments, "Departments");
};

export const sendDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const data: { title: string } = req.body;

  const newDepartment = await prisma.department.create({
    data: {
      ...data,
      userId: req.user!.id,
    },
  });

  console.log("New department created:", newDepartment);

  res.status(201).json({
    success: true,
    data: newDepartment,
  });
};

export const getOneDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);

  const department = await prisma.department.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  sendResponseOr404(res, department, "Department");
};

export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);
  const data: { title: string } = req.body;

  const deparment = await prisma.department.update({
    where: {
      id,
      userId: req.user!.id,
    },
    data,
  });

  sendResponseOr404(res, deparment, "Department");
};

export const deleteDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);

  const department = await prisma.department.delete({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  sendResponseOr404(res, department, "Department");
};
