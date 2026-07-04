import cors from "cors";

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});

export default corsMiddleware;
