import { z } from "zod";

export const createReviewSchema = z.object({
  clientName: z.string().min(2, "Client name must be at least 2 characters").max(100),
  shopName: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  reviewText: z.string().min(5, "Review text must be at least 5 characters").max(2000),
  clientId: z.string().optional(),
});

export const updateReviewSchema = z.object({
  clientName: z.string().min(2).max(100).optional(),
  shopName: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reviewText: z.string().min(5).max(2000).optional(),
});

export const reviewParamsSchema = z.object({
  id: z.string().min(1, "Review ID is required"),
});

export const listReviewsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("100"),
  rating: z.string().regex(/^[1-5]$/).transform(Number).optional(),
  search: z.string().optional(),
  clientId: z.string().optional(),
});

