import { z } from "zod";

export const inquiryTypeEnum = z.enum([
  "sales",
  "support",
  "demo",
  "billing",
  "partnership",
  "general",
]);

export const inquiryStatusEnum = z.enum([
  "pending",
  "in_progress",
  "resolved",
  "closed",
]);

export const createInquirySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  shopName: z.string().max(100).optional(),
  type: inquiryTypeEnum.optional().default("general"),
  subject: z
    .string()
    .min(3, "Subject must be at least 3 characters long")
    .max(200),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters long")
    .max(3000),
  source: z.string().max(50).optional().default("website"),
  clientId: z.string().optional(),
});

export const updateInquirySchema = z.object({
  status: inquiryStatusEnum.optional(),
  adminNotes: z.string().max(2000).optional(),
});

export const inquiryParamsSchema = z.object({
  id: z.string().min(1, "Inquiry ID is required"),
});

export const listInquiriesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
  status: inquiryStatusEnum.optional(),
  type: inquiryTypeEnum.optional(),
  search: z.string().optional(),
  clientId: z.string().optional(),
});
