import { Request, Response, NextFunction } from "express";
import { InquiryService } from "../services/inquiry.service";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";

export class InquiryController {
  /**
   * Submit an inquiry (Public or Authenticated Client)
   */
  static async createInquiry(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const clientId = req.user?.uid || req.body.clientId;

      const inquiry = await InquiryService.createInquiry({
        ...req.body,
        clientId,
      });

      sendCreated(res, "Inquiry submitted successfully", inquiry);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all inquiries (Super Admin only)
   */
  static async listInquiries(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { status, type, search, clientId, page, limit } = req.query as any;

      const result = await InquiryService.listInquiries({
        status,
        type,
        search,
        clientId,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      sendSuccess(
        res,
        "Inquiries retrieved successfully",
        result.inquiries,
        200,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * List inquiries submitted by the current authenticated client
   */
  static async getMyInquiries(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const clientId = req.user!.uid;
      const { status, type, search, page, limit } = req.query as any;

      const result = await InquiryService.listInquiries({
        clientId,
        status,
        type,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      sendSuccess(
        res,
        "My inquiries retrieved successfully",
        result.inquiries,
        200,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get inquiry by ID
   */
  static async getInquiryById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const inquiry = await InquiryService.getInquiryById(id);

      // Access control: Super admin or owner
      const isSuperAdmin =
        req.user?.role === "super_admin" || req.user?.role === "admin";
      const isOwner = inquiry.clientId && req.user?.uid === inquiry.clientId;

      if (!isSuperAdmin && !isOwner) {
        throw ApiError.forbidden(
          "Access denied: You do not have permission to view this inquiry",
        );
      }

      sendSuccess(res, "Inquiry retrieved successfully", inquiry);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update inquiry status or admin notes (Super Admin only)
   */
  static async updateInquiry(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = await InquiryService.updateInquiry(id, req.body);

      sendSuccess(res, "Inquiry updated successfully", updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an inquiry (Super Admin only)
   */
  static async deleteInquiry(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      await InquiryService.deleteInquiry(id);

      sendSuccess(res, "Inquiry deleted successfully", null);
    } catch (error) {
      next(error);
    }
  }
}

