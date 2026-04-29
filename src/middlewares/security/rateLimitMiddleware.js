import rateLimit from "express-rate-limit";

const rateLimitMiddleware = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max request per window
    standardHeaders: true,
    legacyHeaders: false
});

export default rateLimitMiddleware;