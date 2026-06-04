import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { Request, Response, NextFunction } from "express";
import { VacancyStatus } from "@prisma/client";

interface VacancyData {
  title: string;
  availableSlots: number;
  startDate: Date;
  endDate: Date;
  status: VacancyStatus;
  departmentId: number;
  positionId: number;
}

const vacanciesDataObject = (data: any): VacancyData => ({
  title: data.title,
  availableSlots: data.availableSlots,
  startDate: data.startDate,
  endDate: data.endDate,
  status: data.status as VacancyStatus,
  departmentId: data.departmentId,
  positionId: data.positionId,
});

const vacanciesSelectObject = {
  id: true,
  title: true,
  avaibleSlots: true,
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
      __count: {
        candidates: true,
      },
      candidates: true,
    },
  });

  console.log("USER:", req.user);
  sendResponseOr404(res, allVacancies, "Vacancies");
};

export const sendVacancies: VacancyController = async (req, res, next) => {
  const data = req.body;

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

  const allMatchResults = await prisma.matchResult.findMany({
    where: {
      vacancyId: id,
      vacancy: {
        userId: req.user!.id,
      },
    },
    orderBy: {
      matchScore: "desc",
    },
    take: 10,
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
        },
      },
    },
  });

  sendResponseOr404(res, allMatchResults, "Match Results");
};

export const changeStatus: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const { status } = req.body;

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
    data: { status },
  });

  sendResponseOr404(res, updated, "Vacancy Status");
};

export const updateVacancy: VacancyController = async (req, res, next) => {
  const id = req.params.id as unknown as number;
  const data = req.body;

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
    data: {
      ...vacanciesDataObject(data),
    },
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
