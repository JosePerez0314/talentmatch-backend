import { ZodError } from "zod";

export const errorHandler = (err, req, res, next) => {

    console.error("[Global Error Logger]:", err.message || err);

    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: "Validation error",
            details: err.issues.map(e => ({
                field: e.path.join("."),
                message: e.message
            }))
        });
    }

    return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Internal server error"
    });
};