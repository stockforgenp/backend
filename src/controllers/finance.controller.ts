import { Request, Response, NextFunction } from "express";
import { FinanceService } from "../services/finance.service";
import { sendSuccess } from "../utils/apiResponse";

export class FinanceController {
  /**
   * POST /api/v1/finances
   */
  static async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const creatorUid = req.user?.uid;
      const transaction = await FinanceService.createTransaction(
        req.body,
        creatorUid,
      );
      sendSuccess(
        res,
        `${transaction.type === "income" ? "Income" : "Expense"} recorded successfully`,
        transaction,
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/finances
   */
  static async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await FinanceService.listTransactions(req.query as any);
      sendSuccess(res, "Finance transactions retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/finances/stats or /summary
   */
  static async getSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filter = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        clientId: req.query.clientId as string | undefined,
      };
      const stats = await FinanceService.getSummaryStats(filter);
      sendSuccess(res, "Finance summary retrieved successfully", stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/finances/:id
   */
  static async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const transaction = await FinanceService.getTransactionById(id);
      sendSuccess(
        res,
        "Finance transaction retrieved successfully",
        transaction,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH or PUT /api/v1/finances/:id
   */
  static async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = await FinanceService.updateTransaction(id, req.body);
      sendSuccess(res, "Finance transaction updated successfully", updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/finances/:id
   */
  static async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      await FinanceService.deleteTransaction(id);
      sendSuccess(res, "Finance transaction deleted successfully", { id });
    } catch (error) {
      next(error);
    }
  }
}
