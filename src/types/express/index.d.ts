import { Express } from "express";

declare module "express-serve-static-core" {
  export interface Request {
    validated?: unknown;
  }
}
