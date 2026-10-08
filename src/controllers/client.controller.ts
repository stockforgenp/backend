import { Request, Response, NextFunction } from "express";
import { ClientService } from "../services/client.service";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";

export class ClientController {
  /**
   * POST /api/v1/clients/register
   */
  static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await ClientService.registerClient(req.body);
      sendCreated(res, "Client registered successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/clients/login
   */
  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await ClientService.loginClient(req.body);
      sendSuccess(res, "Client logged in successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/clients/me
   */
  static async getMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user || !req.user.uid) {
        return next(ApiError.unauthorized("User identity not found in token"));
      }
      const client = await ClientService.getClientById(req.user.uid);
      sendSuccess(res, "Client profile retrieved successfully", client);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/clients/:id
   */
  static async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const client = await ClientService.getClientById(id);
      sendSuccess(res, "Client retrieved successfully", client);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/clients
   */
  static async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { page, limit, search, status, plan } = req.query as any;
      const result = await ClientService.listClients({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        status: status ? String(status) : undefined,
        plan: plan ? String(plan) : undefined,
      });

      sendSuccess(res, "Clients retrieved successfully", result.clients, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/clients/:id
   */
  static async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = await ClientService.updateClient(id, req.body);
      sendSuccess(res, "Client profile updated successfully", updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/clients/:id
   */
  static async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      await ClientService.deleteClient(id);
      sendSuccess(res, "Client deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}
