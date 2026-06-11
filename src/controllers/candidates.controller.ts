import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Response, Request, NextFunction } from "express";

type CandidateController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getCandidates: CandidateController = async (req, res, next) => {
  const allCandidates = await prisma.candidate.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      fileUrl: true,
      role: true,
      yearsOfExperience: true,
      technicalSkills: true,
      softSkills: true,
      description: true,
      educationLevel: true,
      educationArea: true,
      languages: true,
      rawApiPayload: true,
      createdAt: true,
    },
  });

  sendResponseOr404(res, allCandidates, "Candidates");
};

export const getOneCandidate: CandidateController = async (req, res, next) => {
  const id = req.params.id as unknown as number;

  const getCandidate = await prisma.candidate.findUnique({
    where: {
      id,
      userId: req.user!.id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      fileUrl: true,
      role: true,
      yearsOfExperience: true,
      technicalSkills: true,
      softSkills: true,
      description: true,
      educationLevel: true,
      educationArea: true,
      languages: true,
      rawApiPayload: true,
      createdAt: true,
    },
  });

  sendResponseOr404(res, getCandidate, "Candidate");
};
