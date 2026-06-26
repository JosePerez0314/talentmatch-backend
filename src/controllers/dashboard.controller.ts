import prisma from "../lib/prisma.js";
import { Request, Response, NextFunction } from "express";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { StatusBreakdown, MonthlyActivity } from "../types/dashboard.types.js";
import {
  getAggregatedMonthlyActivity,
  getVacancyStatusBreakdown,
} from "../services/dashboard.service.js";

interface DashboardStatsResponse {
  total: {
    positionsCount: number;
    departmentsCount: number;
    candidatesCount: number;
    openVacanciesCount: number;
  };

  vacancyStatusBreakdown: StatusBreakdown[];
  monthlyActivity: MonthlyActivity[];
}

type DashboardController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const getSummary: DashboardController = async (req, res, next) => {
  const startTime = performance.now();

  const [
    positionCount,
    departmentsCount,
    candidatesCount,
    openVacanciesCount,
    vacancyStatusBreakdown,
    monthlyActivity,
  ] = await Promise.all([
    prisma.position.count({
      where: { userId: req.user!.id },
    }),
    prisma.department.count({
      where: { userId: req.user!.id },
    }),
    prisma.candidate.count({
      where: { userId: req.user!.id },
    }),
    prisma.vacancy.count({
      where: { userId: req.user!.id, status: "ACTIVE" },
    }),
    getVacancyStatusBreakdown(req),
    getAggregatedMonthlyActivity(req),
  ]);

  const executionTime = performance.now() - startTime;
  console.log(`Metrics fetched in ${executionTime.toFixed(2)}ms`);

  const responsePayload: DashboardStatsResponse = {
    total: {
      positionsCount: positionCount,
      departmentsCount: departmentsCount,
      candidatesCount: candidatesCount,
      openVacanciesCount: openVacanciesCount,
    },
    vacancyStatusBreakdown,
    monthlyActivity,
  };

  sendResponseOr404(res, responsePayload, "Dashboard Stats");
};
