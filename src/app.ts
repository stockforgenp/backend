import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { notFoundHandler } from "./middlewares/notFound.middleware";
import { errorHandler } from "./middlewares/error.middleware";

const app: Application = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const allowedOrigins =
  env.CLIENT_CORS_ORIGIN === "*"
    ? "*"
    : env.CLIENT_CORS_ORIGIN.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Body Parsing Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP Request Logger
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
}

// Root welcome endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "StockForge API",
    version: "1.0.0",
    documentation: "/api/v1/health",
    status: "running",
  });
});

// Mount API routes
app.use("/api/v1", apiRoutes);
app.use("/api", apiRoutes);

// Catch 404
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
