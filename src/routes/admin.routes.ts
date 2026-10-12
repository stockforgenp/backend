import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { loginClientSchema } from "../validations/client.validation";

const router = Router();

router.post("/login", validateBody(loginClientSchema), AdminController.login);
router.post("/logout", authenticateToken, AdminController.logout);
router.get("/stats", authenticateToken, requireAdmin, AdminController.getStats);

export default router;
