import prisma from "../lib/prisma.js";
import { Request, Response, NextFunction } from "express";
import { sendResponseOr404 } from "../lib/responseHandler.js";

interface StatusBreakdown {
  status: "ACTIVE" | "CLOSED" | "CONTACTING";
  count: number;
  percentage: number;
}

interface MonthlyActivity {
  month: string;
  positionsCreated: number;
  cvUploads: number;
  vacanciesCreated: number;
}

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

// The function now accepts the Express 'req' object instead of a raw string
async function getAggregatedMonthlyActivity(
  req: Request,
): Promise<MonthlyActivity[]> {
  const startTime = performance.now();

  const rawResults = await prisma.$queryRaw<any[]>`
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m') as month,
      SUM(CASE WHEN eventType = 'position' THEN 1 ELSE 0 END) as positionsCreated,
      SUM(CASE WHEN eventType = 'cv' THEN 1 ELSE 0 END) as cvUploads,
      SUM(CASE WHEN eventType = 'vacancy' THEN 1 ELSE 0 END) as vacanciesCreated
    FROM (
      SELECT createdAt, 'position' as eventType FROM Position WHERE userId = ${req.user!.id}
      UNION ALL
      SELECT createdAt, 'cv' as eventType FROM Candidate WHERE userId = ${req.user!.id}
      UNION ALL
      SELECT createdAt, 'vacancy' as eventType FROM Vacancy WHERE userId = ${req.user!.id}
    ) as combined_events
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC;
  `;

  const executionTime = performance.now() - startTime;
  console.log(
    `Single aggregated query executed in ${executionTime.toFixed(2)}ms`,
  );

  return rawResults.map((row) => ({
    month: row.month,
    positionsCreated: Number(row.positionsCreated),
    cvUploads: Number(row.cvUploads),
    vacanciesCreated: Number(row.vacanciesCreated),
  }));
}
async function getVacancyStatusBreakdown(
  req: Request,
): Promise<StatusBreakdown[]> {
  const startTime = performance.now();

  // 1. Group by status and count the IDs
  // This translates to: SELECT status, COUNT(id) FROM Vacancy WHERE userId = ? GROUP BY status;
  const statusGroupings = await prisma.vacancy.groupBy({
    by: ["status"],
    where: { userId: req.user!.id },
    _count: {
      id: true,
    },
  });

  // 2. Calculate the total number of vacancies dynamically
  const totalVacancies = statusGroupings.reduce(
    (sum, group) => sum + group._count.id,
    0,
  );

  // 3. Define our baseline to guarantee the frontend always receives all 3 statuses
  const defaultStatuses: ("ACTIVE" | "CLOSED" | "CONTACTING")[] = [
    "ACTIVE",
    "CLOSED",
    "CONTACTING",
  ];

  // 4. Map the database results and calculate percentages
  const breakdown: StatusBreakdown[] = defaultStatuses.map((targetStatus) => {
    // Find if the database returned a count for this specific status
    const group = statusGroupings.find((g) => g.status === targetStatus);
    const count = group ? group._count.id : 0;

    // Safety check: Prevent NaN (Division by Zero) if the user has 0 total vacancies
    const percentage =
      totalVacancies > 0 ? Math.round((count / totalVacancies) * 100) : 0;

    return {
      status: targetStatus,
      count,
      percentage,
    };
  });

  const executionTime = performance.now() - startTime;
  console.log(`Status breakdown calculated in ${executionTime.toFixed(2)}ms`);

  return breakdown;
}

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
