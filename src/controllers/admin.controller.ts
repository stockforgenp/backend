import { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service";
import { sendSuccess } from "../utils/apiResponse";
import { revokeToken } from "../utils/token.util";

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
      const result = await AdminService.login(req.body);
      sendSuccess(res, "Super Admin authenticated successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/logout
   */
  static async logout(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]?.trim()
        : "";
      if (token) {
        await revokeToken(token, req.user?.uid);
      }
      sendSuccess(res, "Super Admin logged out successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/stats
   */
  static async getStats(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await AdminService.getOverviewStats();
      sendSuccess(res, "Admin overview stats retrieved successfully", stats);
    } catch (error) {
      next(error);
    }
  }
}
