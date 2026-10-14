import { Router, Request, Response } from "express";
import clientRoutes from "./client.routes";
import subscriptionRoutes from "./subscription.routes";
import adminRoutes from "./admin.routes";
import inquiryRoutes from "./inquiry.routes";
import reviewRoutes from "./review.routes";
import { sendSuccess } from "../utils/apiResponse";

const router = Router();

// API Health Check
router.get("/health", (_req: Request, res: Response) => {
  sendSuccess(res, "StockForge Backend API is healthy", {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount modular sub-routers
router.use("/admin", adminRoutes);
router.use("/clients", clientRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/inquiries", inquiryRoutes);
router.use("/reviews", reviewRoutes);

export default router;
