import { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service";
import { sendSuccess } from "../utils/apiResponse";

export class AdminController {
  /**
   * POST /api/v1/admin/login
   */
  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await AdminService.loginSuperAdmin(req.body);
      sendSuccess(res, "Super Admin authenticated successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/me
   */
  static async getMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const uid = req.user?.uid || "super_admin_root";
      const admin = await AdminService.getAdminProfile(uid);
      sendSuccess(res, "Super Admin profile retrieved successfully", admin);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/seed
   */
  static async seed(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const admin = await AdminService.seedSuperAdmin();
      sendSuccess(res, "Super Admin seeded successfully", admin);
    } catch (error) {
      next(error);
    }
  }
}
