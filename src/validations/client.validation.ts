import { z } from "zod";

export const registerClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().optional(),
  shopName: z.string().optional(),
  shopType: z.string().optional(),
  address: z.string().optional(),
  currencySymbol: z.string().optional(),
  plan: z
    .enum(["trial", "starter", "pro", "enterprise"])
    .optional()
    .default("trial"),
  trialDays: z.number().int().positive().max(3650).optional(),
  durationDays: z.number().int().positive().max(3650).optional(),
  status: z.enum(["active", "inactive", "suspended", "banned"]).optional(),
});

export const loginClientSchema = z.object({
  email: z.string().min(1, "Email or phone number is required"),
  password: z.string().min(1, "Password is required"),
});

export const updateClientSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  shopName: z.string().optional(),
  shopType: z.string().optional(),
  address: z.string().optional(),
  currencySymbol: z.string().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),
  status: z.enum(["active", "inactive", "suspended", "banned"]).optional(),
});

export const clientParamsSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
});

export const listClientsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("100"),
  search: z.string().optional(),
  status: z
    .enum([
      "active",
      "inactive",
      "suspended",
      "banned",
      "expired",
      "trial",
      "grace_period",
      "cancelled",
    ])
    .optional(),
  plan: z.string().optional(),
});
