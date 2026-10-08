import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware";
import {
  extendSubscriptionSchema,
  subscriptionParamsSchema,
  cancelSubscriptionSchema,
} from "../validations/subscription.validation";

const router = Router();

// Extend Subscription
router.post(
  "/extend",
  validateBody(extendSubscriptionSchema),
  SubscriptionController.extend,
);

// Get current subscription status
router.get(
  "/:clientId/status",
  validateParams(subscriptionParamsSchema),
  SubscriptionController.getStatus,
);

// Get subscription extension history
router.get(
  "/:clientId/history",
  validateParams(subscriptionParamsSchema),
  SubscriptionController.getHistory,
);

// Cancel subscription
router.post(
  "/cancel",
  validateBody(cancelSubscriptionSchema),
  SubscriptionController.cancel,
);

export default router;
