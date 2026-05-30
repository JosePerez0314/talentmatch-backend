import "dotenv/config";
import express from "express";

import admin from "./routes/admin.js";
import users from "./routes/users.js";
import positions from "./routes/positions.js";
import departments from "./routes/departments.js";
import uploads from "./routes/uploads.js";
import vacancies from "./routes/vacancies.js";
import candidates from "./routes/candidates.js";
import dashboard from "./routes/dashboard.js";

// SECURITY MIDDLEWARES
import corsMiddleware from "./middlewares/security/corsMiddleware.js";
import helmetMiddleware from "./middlewares/security/helmetMiddleware.js";
import rateLimitMiddleware from "./middlewares/security/rateLimitMiddleware.js";

// ERRORS MIDDLWARES
import { errorHandler } from "./middlewares/error/errorHandler.js";
import { notFoundMiddleware } from "./middlewares/error/notFoundMiddleware.js";

// AUTH
import authMiddleware from "./middlewares/auth/auth.middleware.js";

const app = express();
const port = process.env.PORT || 3000;

// SECURITY LAYER
app.use(corsMiddleware);
app.use(helmetMiddleware);
app.use(rateLimitMiddleware);

// BODY PARSER
app.use(express.json());

// LOGIN
app.use("/api/users", users);

// AUTH USE
app.use(authMiddleware);

// ROUTES
app.use("/api/admin", admin); // ADMIN ROUTE
app.use("/api/departments", departments);
app.use("/api/positions", positions);
app.use("/api/uploads", uploads);
app.use("/api/vacancies", vacancies);
app.use("/api/candidates", candidates);
app.use("/api/dashboard", dashboard);

// 404 handler
app.use(notFoundMiddleware);

// ERROR USE
app.use(errorHandler);

// SERVER LISTEN (ABSOLUTE BOTTOM)
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
