import express from 'express';
import users from "./routes/users.js"
import positions from "./routes/positions.js"
import uploads from "./routes/uploads.js"
import vacancies from "./routes/vacancies.js"

const app = express();
const port = 3000;

//Add JSON
app.use(express.json());

//Routes
app.use("/api/users/", users);
app.use("/api/positions/", positions);
app.use("/api/uploads/", uploads);
app.use("/api/vacancies/", vacancies);

app.listen(port, () => {
    console.log(`The server is running in http://localhost:${port}/api/users`);
});

app.use((err, req, res, next) => {
    console.error("[Global Error Logger]:", err.message || err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error during database operation";

    return res.status(statusCode).json({
        succes: false,
        error: message
    });
});