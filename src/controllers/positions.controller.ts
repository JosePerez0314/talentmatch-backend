import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";
import { EducationLevel } from "@prisma/client";

interface PositionData {
  role: string;
  yearsOfExperience: number;
  technicalSkills: string[];
  optionalTechnicalSkills: string[];
  softSkills: string[];
  languages: string[];
  description: string;
  educationLevel: EducationLevel;
  educationArea: string;
  positionPdfUrl: string | null;
  departmentId: number;
}

const positionSelectObject: object = {
  id: true,
  userId: true,
  departmentId: true,
  role: true,
  yearsOfExperience: true,
  technicalSkills: true,
  optionalTechnicalSkills: true,
  softSkills: true,
  description: true,
  educationLevel: true,
  educationArea: true,
  positionPdfUrl: true,
  createdAt: true,
  updatedAt: true,
};

const positionDataObject = (data: any): PositionData => ({
  role: data.role,
  yearsOfExperience: data.yearsOfExperience,
  technicalSkills: data.technicalSkills,
  optionalTechnicalSkills: data.optionalTechnicalSkills ?? [],
  softSkills: data.softSkills,
  languages: data.languages,
  description: data.description,
  educationLevel: data.educationLevel,
  educationArea: data.educationArea,
  positionPdfUrl: data.positionPdfUrl ?? null,
  departmentId: data.departmentId,
});

export const getPositions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const allPositions = await prisma.position.findMany({
    where: {
      userId: req.user!.id,
    },
    select: {
      ...positionSelectObject,
    },
  });

  sendResponseOr404(res, allPositions, "Positions");
};

export const sendPositions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const data = req.body;

  const newPosition = await prisma.position.create({
    data: {
      ...positionDataObject(data),
      userId: req.user!.id,
    },
  });

  console.log("Database write successful:", newPosition.role);

  res.status(201).json({
    success: true,
    data: newPosition,
  });
};

export const getOnePosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);

  const position = await prisma.position.findFirst({
    where: {
      id: id,
      userId: req.user!.id,
    },
    select: {
      ...positionSelectObject,
    },
  });

  sendResponseOr404(res, position, "Position");
};

export const updatePosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);
  const data = req.body;

  const position = await prisma.position.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!position) {
    res.status(404).json({
      success: false,
      message: "Position not found or unauthorized",
    });
    return;
  }

  const updated = await prisma.position.update({
    where: { id },
    data: { ...positionDataObject(data) },
  });

  res.status(200).json({
    success: true,
    data: updated,
  });
};

export const deletePosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id: number = parseInt(req.params.id as string, 10);

  const position = await prisma.position.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!position) {
    res.status(404).json({
      success: false,
      message: "Position not found or unauthorized",
    });
    return;
  }

  await prisma.position.delete({
    where: {
      id,
    },
  });

  res.status(200).json({
    success: true,
    message: "Position deleted successfully",
  });
};
