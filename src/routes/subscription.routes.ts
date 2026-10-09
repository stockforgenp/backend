import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware";
import {
  authenticateToken,
  requireSuperAdmin,
  requireSelfOrSuperAdmin,
} from "../middlewares/auth.middleware";
import {
  extendSubscriptionSchema,
  subscriptionParamsSchema,
  cancelSubscriptionSchema,
} from "../validations/subscription.validation";

const router = Router();

// ==========================================
// Subscription Alteration (Super Admin Only)
// ==========================================

// Super Admin Only: Extend / renew subscription
router.post(
  "/extend",
  authenticateToken,
  requireSuperAdmin,
  validateBody(extendSubscriptionSchema),
  SubscriptionController.extend,
);

// Super Admin Only: Cancel / suspend subscription
router.post(
  "/cancel",
  authenticateToken,
  requireSuperAdmin,
  validateBody(cancelSubscriptionSchema),
  SubscriptionController.cancel,
);

// ==========================================
// Subscription Queries (Super Admin or Owner)
// ==========================================

// Super Admin or Owner: Check subscription status
router.get(
  "/:clientId/status",
  authenticateToken,
  requireSelfOrSuperAdmin("clientId"),
  validateParams(subscriptionParamsSchema),
  SubscriptionController.getStatus,
);

// Super Admin or Owner: View subscription history records
router.get(
  "/:clientId/history",
  authenticateToken,
  requireSelfOrSuperAdmin("clientId"),
  validateParams(subscriptionParamsSchema),
  SubscriptionController.getHistory,
);

export default router;
