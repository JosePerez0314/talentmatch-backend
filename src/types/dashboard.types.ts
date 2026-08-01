import { VacancyStatus } from "@prisma/client";

export interface StatusBreakdown {
  status: VacancyStatus;
  count: number;
  percentage: number;
}

export interface MonthlyActivity {
  month: string;
  positionsCreated: number;
  cvUploads: number;
  vacanciesCreated: number;
}
