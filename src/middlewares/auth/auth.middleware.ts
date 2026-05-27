import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface JwtPayload {
  userId: number;
  role: string;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    res.status(401).json({
      success: false,
      error: "Malformed Token",
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    if (!decoded.userId || !decoded.role) {
      res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
      return;
    }

    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Session expired",
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

export default authMiddleware;
