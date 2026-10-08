import { z } from "zod";

export const extendSubscriptionSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  durationDays: z
    .number()
    .int("Duration days must be an integer")
    .positive("Duration days must be greater than 0")
    .max(3650, "Duration days cannot exceed 3650 (10 years)"),
  plan: z.enum(["starter", "pro", "enterprise", "trial"]).optional(),
  amountPaid: z
    .number()
    .nonnegative("Amount paid cannot be negative")
    .optional(),
  currency: z.string().min(1).max(10).optional().default("USD"),
  paymentReference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const subscriptionParamsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
});

export const cancelSubscriptionSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  reason: z.string().max(500).optional(),
});
