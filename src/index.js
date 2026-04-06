import express from 'express';
import cors from 'cors';
import users from "./routes/users.js";
import positions from "./routes/positions.js";
import uploads from "./routes/uploads.js";
import vacancies from "./routes/vacancies.js";
import candidates from "./routes/candidates.js";

const app = express();
const port = process.env.PORT || 3000;

// 1. SECURITY & CONFIGURATION (FIRST)
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// 2. PARSERS
app.use(express.json());

// 3. ROUTES
app.use("/api/users/", users);
app.use("/api/positions/", positions);
app.use("/api/uploads/", uploads);
app.use("/api/vacancies/", vacancies);
app.use("/api/candidates/", candidates);

// 4. ERROR LOGGING (LAST MIDDLEWARE)
app.use((err, req, res, next) => {
    console.error("[Global Error Logger]:", err.message || err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error during database operation";

    return res.status(statusCode).json({
        success: false,
        error: message
    });
});

// 5. SERVER LISTEN (ABSOLUTE BOTTOM)
app.listen(port, () => {
    console.log(`The server is running on http://localhost:${port}/api/users`);
});