import { Router } from "express";
import { ReviewController } from "../controllers/review.controller";
import {
  authenticateToken,
  optionalAuthenticateToken,
  requireSuperAdmin,
} from "../middlewares/auth.middleware";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware";
import {
  createReviewSchema,
  updateReviewSchema,
  reviewParamsSchema,
  listReviewsQuerySchema,
} from "../validations/review.validation";

const router = Router();

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a new client review (Admin or Client)
 * @access  Optional Auth / Public / Super Admin
 */
router.post(
  "/",
  optionalAuthenticateToken,
  validateBody(createReviewSchema),
  ReviewController.createReview,
);

/**
 * @route   GET /api/v1/reviews
 * @desc    List all reviews with filtering and pagination
 * @access  Public or Protected
 */
router.get(
  "/",
  validateQuery(listReviewsQuerySchema),
  ReviewController.listReviews,
);

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Get review by ID
 * @access  Public or Protected
 */
router.get(
  "/:id",
  validateParams(reviewParamsSchema),
  ReviewController.getReviewById,
);

/**
 * @route   PATCH /api/v1/reviews/:id
 * @desc    Update review (Super Admin only)
 * @access  Private (Super Admin)
 */
router.patch(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  validateParams(reviewParamsSchema),
  validateBody(updateReviewSchema),
  ReviewController.updateReview,
);

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review (Super Admin only)
 * @access  Private (Super Admin)
 */
router.delete(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  validateParams(reviewParamsSchema),
  ReviewController.deleteReview,
);

export default router;

