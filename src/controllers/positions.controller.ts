import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";
import { EducationLevel } from "@prisma/client";
import "multer";
import { extract } from "../lib/pdfWrapper.js";
import { autoCompletePosition } from "../prompts/autoCompletePosition.prompt.js";
import { uploadPositionToCloudinary } from "../services/cloudinaryService.js";
import { InputJsonValue } from "@prisma/client/runtime/library";

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

const positionSelectObject = {
  id: true,
  userId: true,
  departmentId: true,
  role: true,
  yearsOfExperience: true,
  technicalSkills: true,
  optionalTechnicalSkills: true,
  softSkills: true,
  languages: true,
  description: true,
  educationLevel: true,
  educationArea: true,
  createdAt: true,
} as const;

const positionDataObject = (data: any): PositionData => ({
  role: data.role,
  yearsOfExperience: data.yearsOfExperience,
  technicalSkills: data.technicalSkills,
  optionalTechnicalSkills: data.optionalTechnicalSkills ?? [],
  softSkills: data.softSkills,
  languages: data.languages,
  description: data.description,
  educationLevel: data.educationLevel as EducationLevel,
  educationArea: data.educationArea,
  positionPdfUrl: data.positionPdfUrl ?? null,
  departmentId: data.departmentId,
});

type PositionControllers = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getPositions: PositionControllers = async (req, res, next) => {
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

export const sendPositions: PositionControllers = async (req, res, next) => {
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

export const completePosition: PositionControllers = async (req, res, next) => {
  const pdfFile = req.file;

  if (!pdfFile) {
    res.status(400).json({
      success: false,
      message: "No PDF file uploaded",
    });
    return;
  }

  const extractPosition = await extract(pdfFile.buffer);
  console.log("Extracted text from PDF:", pdfFile.originalname);

  if (extractPosition.trim().length < 300) {
    res.status(400).json({
      success: false,
      message: "Extracted text from PDF is too short",
    });
    return;
  }

  const positionJsonData = await autoCompletePosition(extractPosition);
  console.log("Auto-completion process completed for:", pdfFile.originalname);

  const cloudinaryPositionUrl = await uploadPositionToCloudinary(
    pdfFile.buffer,
    pdfFile.originalname,
    req.user!.id,
  );
  console.log("PDF uploaded to Cloudinary for:", pdfFile.originalname);

  res.status(200).json({
    success: true,
    data: positionJsonData,
    cloudinaryPositionUrl,
    message: "Position data auto-completed and PDF uploaded successfully",
  });
};

export const duplicatePosition: PositionControllers = async (
  req,
  res,
  next,
) => {
  const id = req.params.id as unknown as number;

  const originalPosition = await prisma.position.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!originalPosition) {
    res.status(404).json({
      success: false,
      message: "Position not found or unauthorized",
    });
    return;
  }

  const { id: _, createdAt: __, ...data } = originalPosition;

  const duplicatedPosition = await prisma.position.create({
    data: {
      ...data,
      role: `${data.role} (Copy)`,
      technicalSkills: data.technicalSkills as InputJsonValue,
      optionalTechnicalSkills: data.optionalTechnicalSkills as InputJsonValue,
      softSkills: data.softSkills as InputJsonValue,
      languages: data.languages as InputJsonValue,
    },
  });

  res.status(201).json({
    success: true,
    data: duplicatedPosition,
  });
};

export const getOnePosition: PositionControllers = async (req, res, next) => {
  const id = req.params.id as unknown as number;

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

export const updatePosition: PositionControllers = async (req, res, next) => {
  const id = req.params.id as unknown as number;
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

export const deletePosition: PositionControllers = async (req, res, next) => {
  const id = req.params.id as unknown as number;

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
