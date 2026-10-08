import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../utils/apiResponse";

export class SubscriptionController {
  /**
   * POST /api/v1/subscriptions/extend
   */
  static async extend(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await SubscriptionService.extendSubscription(req.body);
      sendSuccess(res, "Subscription extended successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/subscriptions/:clientId/status
   */
  static async getStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const clientId = req.params.clientId as string;
      const status = await SubscriptionService.getSubscriptionStatus(clientId);
      sendSuccess(res, "Subscription status retrieved successfully", status);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/subscriptions/:clientId/history
   */
  static async getHistory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const clientId = req.params.clientId as string;
      const history =
        await SubscriptionService.getSubscriptionHistory(clientId);
      sendSuccess(res, "Subscription history retrieved successfully", history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/subscriptions/cancel
   */
  static async cancel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { clientId, reason } = req.body;
      const result = await SubscriptionService.cancelSubscription(
        clientId,
        reason,
      );
      sendSuccess(res, "Subscription cancelled successfully", result);
    } catch (error) {
      next(error);
    }
  }
}
