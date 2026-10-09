import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
} from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { loginClientSchema } from "../validations/client.validation";

const router = Router();

// Public Admin Login
router.post("/login", validateBody(loginClientSchema), AdminController.login);

// Protected Admin Endpoints
router.get("/me", authenticateToken, requireAdmin, AdminController.getMe);
router.post(
  "/seed",
  authenticateToken,
  requireSuperAdmin,
  AdminController.seed,
);

export default router;
