import prisma from "../lib/prisma.js";
import plimit from "p-limit";
import { z } from "zod";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";
import { findExistingCandidateByCv } from "../services/cvProcessing.service.js";
import {
  EducationLevel,
  VacancyStatus,
  Candidate,
  Position,
  Prisma,
} from "@prisma/client";
import { extract } from "../lib/pdfWrapper.js";
import { uploadPdfToCloudinary } from "../services/cloudinary.service.js";
import { extractCandidateData } from "../prompts/extractCv.prompt.js";
import { matchEngine } from "../prompts/matchEngine.prompt.js";
import { calculateMatchScore } from "../utils/scoringEngine.js";
import {
  sendVacancySchema,
  updateVacancySchema,
  changeStatusSchema,
} from "../validations/vacancy.validation.js";

type SendVacancyBody = z.infer<typeof sendVacancySchema>["body"];
type UpdateVacancyBody = z.infer<typeof updateVacancySchema>["body"];
type ChangeStatusBody = z.infer<typeof changeStatusSchema>["body"];

interface VacancyData {
  title: string;
  availableSlots: number;
  startDate: Date;
  endDate: Date;
  status?: VacancyStatus;
  departmentId: number;
  positionId: number;
}

interface PositionEngineData {
  role: string;
  yearsOfExperience: number;
  technicalSkills: string[];
  optionalTechnicalSkills: string[];
  softSkills: string[];
  description: string;
  educationLevel: string;
  educationArea: string;
  languages: string[];
}

interface CandidateEngineData {
  fullName: string;
  email: string;
  role: string;
  yearsOfExperience: number;
  technicalSkills: string[];
  optionalTechnicalSkills: string[];
  softSkills: string[];
  description: string;
  educationLevel: string;
  educationArea: string;
  languages: string[];
}

const vacanciesDataObject = (data: SendVacancyBody): VacancyData => ({
  title: data.title,
  availableSlots: data.availableSlots,
  startDate: data.startDate,
  endDate: data.endDate,
  status: data.status as VacancyStatus | undefined,
  departmentId: data.departmentId,
  positionId: data.positionId,
});

const buildVacancyUpdateData = (
  data: UpdateVacancyBody,
): Prisma.VacancyUncheckedUpdateInput => {
  const update: Prisma.VacancyUncheckedUpdateInput = {};

  if (data.title !== undefined) update.title = data.title;
  if (data.availableSlots !== undefined)
    update.availableSlots = data.availableSlots;
  if (data.startDate !== undefined) update.startDate = data.startDate;
  if (data.endDate !== undefined) update.endDate = data.endDate;
  if (data.status !== undefined) update.status = data.status as VacancyStatus;
  if (data.departmentId !== undefined) update.departmentId = data.departmentId;
  if (data.positionId !== undefined) update.positionId = data.positionId;

  return update;
};

const vacanciesSelectObject = {
  id: true,
  title: true,
  availableSlots: true,
  startDate: true,
  status: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  departmentId: true,
  positionId: true,
} as const;

type VacancyController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

const positionEngineSelectObject = (
  position: Position,
): PositionEngineData => ({
  role: position.role,
  yearsOfExperience: position.yearsOfExperience,
  technicalSkills: position.technicalSkills as string[],
  optionalTechnicalSkills: position.optionalTechnicalSkills as string[],
  softSkills: position.softSkills as string[],
  description: position.description,
  educationLevel: position.educationLevel as EducationLevel,
  educationArea: position.educationArea,
  languages: position.languages as string[],
});

const candidateEngineSelectObject = (
  candidate: Candidate,
): CandidateEngineData => ({
  fullName: candidate.fullName,
  email: candidate.email,
  role: candidate.role,
  yearsOfExperience: candidate.yearsOfExperience,
  technicalSkills: candidate.technicalSkills as string[],
  optionalTechnicalSkills: candidate.optionalTechnicalSkills as string[],
  softSkills: candidate.softSkills as string[],
  description: candidate.description,
  educationLevel: candidate.educationLevel as EducationLevel,
  educationArea: candidate.educationArea,
  languages: candidate.languages as string[],
});

export const getAllVacancies = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const allVacancies = await prisma.vacancy.findMany({
    where: {
      userId: req.user!.id,
    },
    select: {
      ...vacanciesSelectObject,
      _count: {
        select: { candidates: true },
      },
      candidates: true,
    },
  });

  console.log("USER:", req.user);
  sendResponseOr404(res, allVacancies, "Vacancies");
};

export const sendVacancies: VacancyController = async (req, res, next) => {
  const data = req.body as SendVacancyBody;

  const department = await prisma.department.findUnique({
    where: {
      id: data.departmentId,
      userId: req.user!.id,
    },
    include: {
      positions: true,
    },
  });

  if (!department) {
    res.status(404).json({
      success: false,
      message: `Department not found or does not belong to this user`,
    });
    return;
  }

  if (department.positions.length === 0) {
    res.status(400).json({
      success: false,
      message: `Department has no positions`,
    });
    return;
  }

  const positionBelongsToDepartment = department.positions.some(
    (p) => p.id === data.positionId,
  );

  if (!positionBelongsToDepartment) {
    res.status(400).json({
      success: false,
      message: `Position does not belong to this department`,
    });
    return;
  }

  const newVacancy = await prisma.vacancy.create({
    data: {
      ...vacanciesDataObject(data),
      userId: req.user!.id,
    },
  });

  console.log("Database write sucessful:", newVacancy.id);

  res.status(201).json({
    success: true,
    data: newVacancy,
  });
};

export const uploadCandidate: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const pdfFiles = req.files as Express.Multer.File[] | undefined;

  if (!pdfFiles!) {
    res.status(400).json({
      success: false,
      message: "No PDF file uploaded",
    });
    return;
  }

  const limit = plimit(5); // Limit concurrent processing to 5

  const results = await Promise.all(
    pdfFiles!.map((pdfFile) =>
      limit(async () => {
        let hash: string | undefined;
        try {
          // Service: generate the buffer hash + check whether the candidate exists
          const { hash: cvHash, existingCandidate } =
            await findExistingCandidateByCv(pdfFile.buffer);
          hash = cvHash;

          // Dedup: if it already exists, stop here (no extract, OpenAI, or Cloudinary)
          if (existingCandidate) {
            return { success: true, data: existingCandidate };
          }

          const extractedData = await extract(pdfFile.buffer);
          console.log(`Successfully processed file ${pdfFile.originalname}`);

          if (extractedData.trim().length < 500) {
            throw new Error("Insufficient data extracted from PDF");
          }

          const candidateData = await extractCandidateData(extractedData);

          const cloudinaryUrl = await uploadPdfToCloudinary(
            pdfFile.buffer,
            pdfFile.originalname,
            req.user!.id,
          );

          const candidate = await prisma.candidate.create({
            data: {
              fullName: candidateData.fullName,
              email: candidateData.email,
              role: candidateData.role,
              yearsOfExperience: candidateData.yearsOfExperience,
              technicalSkills: candidateData.technicalSkills,
              optionalTechnicalSkills:
                candidateData.optionalTechnicalSkills || [],
              softSkills: candidateData.softSkills,
              description: candidateData.description,
              educationLevel: candidateData.educationLevel as EducationLevel,
              educationArea: candidateData.educationArea,
              languages: candidateData.languages,
              fileUrl: cloudinaryUrl,
              hash: hash,
              rawApiPayload: JSON.stringify(candidateData),
              vacancyId: id,
              userId: req.user!.id,
            },
          });

          return {
            success: true,
            data: candidate,
          };
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002" &&
            hash
          ) {
            const existing = await prisma.candidate.findUnique({
              where: { hash },
            });
            return { success: true, data: existing };
          }
          console.error(
            `Error processing file ${pdfFile.originalname}:`,
            error,
          );
          return {
            success: false,
            message: `Error processing file ${pdfFile.originalname}`,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };
        }
      }),
    ),
  );

  res.status(201).json({
    success: true,
    data: results,
  });
};

export const evaluateCandidates: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;

  const vacancy = await prisma.vacancy.findUnique({
    where: {
      id,
      userId: req.user!.id,
    },
    include: {
      candidates: {
        where: {
          matchResults: {
            none: {
              vacancyId: id,
            },
          },
        },
      },
      position: true,
    },
  });

  if (!vacancy) {
    res.status(404).json({ success: false, message: "Vacancy not found" });
    return;
  }

  if (vacancy.candidates.length === 0) {
    res
      .status(400)
      .json({ success: false, message: "No candidates to evaluate" });
    return;
  }

  const positionData = positionEngineSelectObject(vacancy.position!);

  const limit = plimit(5);

  const matchResults = await Promise.all(
    vacancy.candidates.map((candidate) =>
      limit(async () => {
        try {
          const normalizedCandidate = await matchEngine(
            positionData,
            candidateEngineSelectObject(candidate),
          );

          const match = calculateMatchScore(positionData, normalizedCandidate);

          const matchResult = await prisma.matchResult.create({
            data: {
              matchScore: match.totalScore,
              educationScore: Math.round(match.breakdown.education.score),
              experienceScore: Math.round(match.breakdown.experience.score),
              hardSkillsScore: Math.round(match.breakdown.technical.score),
              languagesScore: Math.round(match.breakdown.languages.score),
              roleScore: Math.round(match.breakdown.role.score),
              softSkillsScore: Math.round(match.breakdown.softSkills.score),
              normalizedCandidate: JSON.stringify(normalizedCandidate),
              redFlags: normalizedCandidate.aiAnalysis?.redFlags ?? null,
              summary: normalizedCandidate.aiAnalysis?.rawTextSummary ?? "",
              candidateId: candidate.id,
              vacancyId: id,
            },
          });

          return matchResult;
        } catch (error) {
          console.error(`Error evaluating candidate ${candidate.id}:`, error);
          return {
            success: false,
            message: `Error evaluating candidate ${candidate.id}`,
          };
        }
      }),
    ),
  );

  res.status(201).json({
    success: true,
    data: matchResults,
  });
};

export const getOneVacancy: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;

  const vacancy = await prisma.vacancy.findUnique({
    where: {
      id,
      userId: req.user!.id,
    },
    select: {
      ...vacanciesSelectObject,
    },
  });

  if (!vacancy) {
    res.status(404).json({
      success: false,
      message: "Vacancy not found or unauthorized",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: vacancy,
  });
};

export const getVacancyResults: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [allMatchResults, total] = await prisma.$transaction([
    prisma.matchResult.findMany({
      where: {
        vacancyId: id,
        vacancy: { userId: req.user!.id },
      },
      orderBy: { matchScore: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        matchScore: true,
        summary: true,
        redFlags: true,
        hardSkillsScore: true,
        experienceScore: true,
        roleScore: true,
        languagesScore: true,
        educationScore: true,
        softSkillsScore: true,
        normalizedCandidate: true,
        createdAt: true,
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            fileUrl: true,
            applications: {
              where: { vacancyId: id },
              select: { status: true },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.matchResult.count({
      where: {
        vacancyId: id,
        vacancy: { userId: req.user!.id },
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: allMatchResults,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const changeStatus: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const { status } = req.body as ChangeStatusBody;

  const vacancy = await prisma.vacancy.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!vacancy) {
    res.status(404).json({
      success: false,
      message: "Vacancy not found or unauthorized",
    });
    return;
  }

  const updated = await prisma.vacancy.update({
    where: { id },
    data: { status: status as VacancyStatus },
  });

  sendResponseOr404(res, updated, "Vacancy Status");
};

export const updateVacancy: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const data = req.body as UpdateVacancyBody;

  const vacancy = await prisma.vacancy.findUnique({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!vacancy) {
    res.status(404).json({
      success: false,
      message: "Vacancy not found or unauthorized",
    });
    return;
  }

  const updated = await prisma.vacancy.update({
    where: { id },
    data: buildVacancyUpdateData(data),
  });

  sendResponseOr404(res, updated, "Vacancy");
};

export const deleteVacancy: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;

  const vacancy = await prisma.vacancy.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!vacancy) {
    res.status(404).json({
      success: false,
      message: "Vacancy not found or unauthorized",
    });
    return;
  }

  await prisma.vacancy.delete({
    where: { id },
  });

  res.status(200).json({
    success: true,
    message: "Vacancy deleted successfully",
  });
};
