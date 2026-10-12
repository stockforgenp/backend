import { Router } from "express";
import { ClientController } from "../controllers/client.controller";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware";
import {
  authenticateToken,
  requireSuperAdmin,
  requireSelfOrSuperAdmin,
} from "../middlewares/auth.middleware";
import {
  registerClientSchema,
  loginClientSchema,
  updateClientSchema,
  clientParamsSchema,
  listClientsQuerySchema,
} from "../validations/client.validation";

const router = Router();

// ==========================================
// Authentication Routes
// ==========================================

// Public Client Login
router.post("/login", validateBody(loginClientSchema), ClientController.login);

// Authenticated Client Logout
router.post("/logout", authenticateToken, ClientController.logout);

// Current Authenticated Client Profile
router.get("/me", authenticateToken, ClientController.getMe);

// ==========================================
// Client Management Routes
// ==========================================

// Super Admin Only: Register new client
router.post(
  "/register",
  authenticateToken,
  requireSuperAdmin,
  validateBody(registerClientSchema),
  ClientController.register,
);

// Super Admin Only: List all clients with filters & pagination
router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  validateQuery(listClientsQuerySchema),
  ClientController.list,
);

// Super Admin or Owner: View client details by ID
router.get(
  "/:id",
  authenticateToken,
  requireSelfOrSuperAdmin("id"),
  validateParams(clientParamsSchema),
  ClientController.getById,
);

// Super Admin or Owner: Update client profile
router.patch(
  "/:id",
  authenticateToken,
  requireSelfOrSuperAdmin("id"),
  validateParams(clientParamsSchema),
  validateBody(updateClientSchema),
  ClientController.update,
);

// Super Admin Only: Delete client
router.delete(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  validateParams(clientParamsSchema),
  ClientController.delete,
);

export default router;
