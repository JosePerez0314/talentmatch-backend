export interface StatusBreakdown {
  status: "ACTIVE" | "CLOSED" | "CONTACTING";
  count: number;
  percentage: number;
}

export interface MonthlyActivity {
  month: string;
  positionsCreated: number;
  cvUploads: number;
  vacanciesCreated: number;
}
