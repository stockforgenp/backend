import { Request, Response, NextFunction } from "express";
import { ReviewService } from "../services/review.service";
import { sendSuccess } from "../utils/apiResponse";

export class ReviewController {
  /**
   * POST /api/v1/reviews
   */
  static async createReview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // If submitted by an authenticated client, bind their clientId if not passed
      const clientId = req.user?.uid || req.body.clientId;
      const review = await ReviewService.createReview({
        ...req.body,
        clientId,
      });
      sendSuccess(res, "Review created successfully", review, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reviews
   */
  static async listReviews(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await ReviewService.listReviews(req.query as any);
      sendSuccess(res, "Reviews retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reviews/:id
   */
  static async getReviewById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const review = await ReviewService.getReviewById(id);
      sendSuccess(res, "Review retrieved successfully", review);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/reviews/:id
   */
  static async updateReview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = await ReviewService.updateReview(
        id,
        req.body,
      );
      sendSuccess(res, "Review updated successfully", updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/reviews/:id
   */
  static async deleteReview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      await ReviewService.deleteReview(id);
      sendSuccess(res, "Review deleted successfully", { id });
    } catch (error) {
      next(error);
    }
  }
}

