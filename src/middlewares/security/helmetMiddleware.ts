import helmet from "helmet";

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

export default helmetMiddleware;
