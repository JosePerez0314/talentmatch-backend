import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";

const departmentSelectProject = {
  id: true,
  userId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DepartmentController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getDepartments: DepartmentController = async (req, res, next) => {
  const allDepartments = await prisma.department.findMany({
    where: { userId: req.user!.id },
    select: {
      ...departmentSelectProject,
      _count: {
        select: { positions: true },
      },
    },
  });

  sendResponseOr404(res, allDepartments, "Departments");
};

export const sendDepartments: DepartmentController = async (req, res, next) => {
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

export const getOneDepartment: DepartmentController = async (
  req,
  res,
  next,
) => {
  const id = req.params.id as unknown as number;

  const department = await prisma.department.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
    select: {
      ...departmentSelectProject,
      _count: {
        select: { positions: true },
      },
    },
  });

  sendResponseOr404(res, department, "Department");
};

export const updateDepartment: DepartmentController = async (
  req,
  res,
  next,
) => {
  const id = req.params.id as unknown as number;
  const data: { title: string } = req.body;

  const department = await prisma.department.update({
    where: {
      id,
      userId: req.user!.id,
    },
    data,
  });

  sendResponseOr404(res, department, "Department");
};

export const deleteDepartment: DepartmentController = async (
  req,
  res,
  next,
) => {
  const id = req.params.id as unknown as number;

  const department = await prisma.department.delete({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  sendResponseOr404(res, department, "Department");
};
