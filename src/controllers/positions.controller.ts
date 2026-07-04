import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";
import { EducationLevel, Prisma } from "@prisma/client";
import "multer";
import { z } from "zod";
import { extract } from "../lib/pdfWrapper.js";
import { autoCompletePosition } from "../prompts/autoCompletePosition.prompt.js";
import { uploadPositionToCloudinary } from "../services/cloudinary.service.js";
import { InputJsonValue } from "@prisma/client/runtime/library";
import {
  sendPositionSchema,
  updatePositionSchema,
} from "../validations/position.validation.js";

type SendPositionBody = z.infer<typeof sendPositionSchema>["body"];
type UpdatePositionBody = z.infer<typeof updatePositionSchema>["body"];

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

const positionDataObject = (data: SendPositionBody): PositionData => ({
  role: data.role,
  yearsOfExperience: data.yearsOfExperience,
  technicalSkills: data.technicalSkills,
  optionalTechnicalSkills: data.optionalTechnicalSkills ?? [],
  softSkills: data.softSkills,
  languages: data.languages ?? [],
  description: data.description,
  educationLevel: data.educationLevel as EducationLevel,
  educationArea: data.educationArea ?? "N/A",
  positionPdfUrl: null,
  departmentId: data.departmentId,
});

const buildPositionUpdateData = (
  data: UpdatePositionBody,
): Prisma.PositionUncheckedUpdateInput => {
  const update: Prisma.PositionUncheckedUpdateInput = {};

  if (data.role !== undefined) update.role = data.role;
  if (data.yearsOfExperience !== undefined)
    update.yearsOfExperience = data.yearsOfExperience;
  if (data.technicalSkills !== undefined)
    update.technicalSkills = data.technicalSkills;
  if (data.optionalTechnicalSkills !== undefined)
    update.optionalTechnicalSkills = data.optionalTechnicalSkills;
  if (data.softSkills !== undefined) update.softSkills = data.softSkills;
  if (data.languages !== undefined) update.languages = data.languages;
  if (data.description !== undefined) update.description = data.description;
  if (data.educationLevel !== undefined)
    update.educationLevel = data.educationLevel as EducationLevel;
  if (data.educationArea !== undefined)
    update.educationArea = data.educationArea;
  if (data.departmentId !== undefined) update.departmentId = data.departmentId;

  return update;
};

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
  const data = req.body as SendPositionBody;

  const department = await prisma.department.findFirst({
    where: { id: data.departmentId, userId: req.user!.id },
  });

  if (!department) {
    res.status(404).json({
      success: false,
      message: "Department not found",
    });
    return;
  }

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
  const data = req.body as UpdatePositionBody;

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
    data: buildPositionUpdateData(data),
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
