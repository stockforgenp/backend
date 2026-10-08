import { Router } from "express";
import { ClientController } from "../controllers/client.controller";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  registerClientSchema,
  loginClientSchema,
  updateClientSchema,
  clientParamsSchema,
  listClientsQuerySchema,
} from "../validations/client.validation";

const router = Router();

// Public Authentication Endpoints
router.post(
  "/register",
  validateBody(registerClientSchema),
  ClientController.register,
);
router.post("/login", validateBody(loginClientSchema), ClientController.login);

// Authenticated current client profile
router.get("/me", authenticateToken, ClientController.getMe);

// Client Management Endpoints
router.get("/", validateQuery(listClientsQuerySchema), ClientController.list);
router.get(
  "/:id",
  validateParams(clientParamsSchema),
  ClientController.getById,
);
router.patch(
  "/:id",
  validateParams(clientParamsSchema),
  validateBody(updateClientSchema),
  ClientController.update,
);
router.delete(
  "/:id",
  validateParams(clientParamsSchema),
  ClientController.delete,
);

export default router;
