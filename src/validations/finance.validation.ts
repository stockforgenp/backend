import { z } from "zod";

export const createFinanceSchema = z.object({
  type: z.enum(["income", "expense"], {
    errorMap: () => ({ message: "Type must be either 'income' or 'expense'" }),
  }),
  category: z.string().min(1, "Category is required").max(100),
  amount: z.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  paymentMethod: z.string().max(50).optional(),
  clientId: z.string().max(100).optional(),
  clientName: z.string().max(150).optional(),
  clientShopName: z.string().max(150).optional(),
  reference: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
});

export const updateFinanceSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  date: z.string().min(1).optional(),
  paymentMethod: z.string().max(50).optional(),
  clientId: z.string().max(100).nullable().optional(),
  clientName: z.string().max(150).nullable().optional(),
  clientShopName: z.string().max(150).nullable().optional(),
  reference: z.string().max(100).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const financeParamsSchema = z.object({
  id: z.string().min(1, "Transaction ID is required"),
});

export const listFinancesQuerySchema = z.object({
  type: z.enum(["income", "expense", "all"]).optional().default("all"),
  category: z.string().optional(),
  clientId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("100"),
});

