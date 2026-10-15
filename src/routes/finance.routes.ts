import { Router } from "express";
import { FinanceController } from "../controllers/finance.controller";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/auth.middleware";
import {
  createFinanceSchema,
  updateFinanceSchema,
  financeParamsSchema,
  listFinancesQuerySchema,
} from "../validations/finance.validation";

const router = Router();

// All finance routes require Super Admin or Admin access
router.use(authenticateToken, requireAdmin);

// Create new finance transaction (income or expense)
router.post(
  "/",
  validateBody(createFinanceSchema),
  FinanceController.create,
);

// Summary statistics
router.get("/stats", FinanceController.getSummary);
router.get("/summary", FinanceController.getSummary);

// List all finance transactions with filters & search
router.get(
  "/",
  validateQuery(listFinancesQuerySchema),
  FinanceController.list,
);

// View specific transaction by ID
router.get(
  "/:id",
  validateParams(financeParamsSchema),
  FinanceController.getById,
);

// Update transaction
router.patch(
  "/:id",
  validateParams(financeParamsSchema),
  validateBody(updateFinanceSchema),
  FinanceController.update,
);
router.put(
  "/:id",
  validateParams(financeParamsSchema),
  validateBody(updateFinanceSchema),
  FinanceController.update,
);

// Delete transaction
router.delete(
  "/:id",
  validateParams(financeParamsSchema),
  FinanceController.delete,
);

export default router;

