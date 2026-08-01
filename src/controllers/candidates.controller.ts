import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Response, Request, NextFunction } from "express";

type CandidateController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getCandidates: CandidateController = async (req, res, next) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const where = { userId: req.user!.id };

  const [allCandidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
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
    }),
    prisma.candidate.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: allCandidates,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
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
