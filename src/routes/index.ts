import { Router, Request, Response } from "express";
import clientRoutes from "./client.routes";
import subscriptionRoutes from "./subscription.routes";
import { isFirebaseInitialized, isMockMode } from "../config/firebase";
import { sendSuccess } from "../utils/apiResponse";

const router = Router();

// API Health Check
router.get("/health", (_req: Request, res: Response) => {
  sendSuccess(res, "StockForge Backend API is healthy", {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    firebase: {
      connected: isFirebaseInitialized,
      mode: isMockMode ? "local_simulation" : "firebase_cloud",
    },
  });
});

// Mount modular sub-routers
router.use("/clients", clientRoutes);
router.use("/subscriptions", subscriptionRoutes);

export default router;
