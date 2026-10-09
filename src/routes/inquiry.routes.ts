import { Router } from "express";
import { InquiryController } from "../controllers/inquiry.controller";
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
  createInquirySchema,
  updateInquirySchema,
  inquiryParamsSchema,
  listInquiriesQuerySchema,
} from "../validations/inquiry.validation";

const router = Router();

/**
 * @route   POST /api/v1/inquiries
 * @desc    Submit a new inquiry (Public or Authenticated Client)
 * @access  Public / Optional Auth
 */
router.post(
  "/",
  optionalAuthenticateToken,
  validateBody(createInquirySchema),
  InquiryController.createInquiry,
);

/**
 * @route   GET /api/v1/inquiries
 * @desc    List all inquiries with filters and pagination
 * @access  Private (Super Admin)
 */
router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  validateQuery(listInquiriesQuerySchema),
  InquiryController.listInquiries,
);

/**
 * @route   GET /api/v1/inquiries/my
 * @desc    List inquiries submitted by the current authenticated client
 * @access  Private (Authenticated Client)
 */
router.get(
  "/my",
  authenticateToken,
  validateQuery(listInquiriesQuerySchema),
  InquiryController.getMyInquiries,
);

/**
 * @route   GET /api/v1/inquiries/:id
 * @desc    Get inquiry details by ID
 * @access  Private (Super Admin or Inquiry Owner)
 */
router.get(
  "/:id",
  authenticateToken,
  validateParams(inquiryParamsSchema),
  InquiryController.getInquiryById,
);

/**
 * @route   PATCH /api/v1/inquiries/:id
 * @desc    Update inquiry status or add admin notes
 * @access  Private (Super Admin)
 */
router.patch(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  validateParams(inquiryParamsSchema),
  validateBody(updateInquirySchema),
  InquiryController.updateInquiry,
);

/**
 * @route   DELETE /api/v1/inquiries/:id
 * @desc    Delete an inquiry
 * @access  Private (Super Admin)
 */
router.delete(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  validateParams(inquiryParamsSchema),
  InquiryController.deleteInquiry,
);

export default router;

