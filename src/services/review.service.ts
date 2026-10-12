import { firestore } from "../config/firebase";
import {
  ReviewDocument,
  CreateReviewInput,
  UpdateReviewInput,
} from "../types";
import { ApiError } from "../utils/apiError";

export const REVIEWS_COLLECTION = "reviews";

export class ReviewService {
  private static cleanObject<T extends Record<string, any>>(obj: T): T {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Create a new review
   */
  static async createReview(input: CreateReviewInput): Promise<ReviewDocument> {
    const now = new Date().toISOString();
    const docRef = firestore.collection(REVIEWS_COLLECTION).doc();
    const id = docRef.id;

    const reviewDoc: ReviewDocument = {
      id,
      clientName: input.clientName.trim(),
      shopName: input.shopName?.trim(),
      location: input.location?.trim(),
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      reviewText: input.reviewText.trim(),
      clientId: input.clientId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(this.cleanObject(reviewDoc));
    return reviewDoc;
  }

  /**
   * Get review by ID
   */
  static async getReviewById(id: string): Promise<ReviewDocument> {
    const snap = await firestore.collection(REVIEWS_COLLECTION).doc(id).get();
    if (!snap.exists) {
      throw ApiError.notFound(`Review with ID '${id}' not found`);
    }
    return snap.data() as ReviewDocument;
  }

  /**
   * List reviews with optional filters and stats
   */
  static async listReviews(filter: {
    page?: number;
    limit?: number;
    rating?: number;
    search?: string;
    clientId?: string;
  } = {}): Promise<{
    reviews: ReviewDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: {
      total: number;
      averageRating: number;
      fiveStarCount: number;
    };
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 50;

    let query: FirebaseFirestore.Query = firestore.collection(REVIEWS_COLLECTION);
    if (filter.clientId) {
      query = query.where("clientId", "==", filter.clientId);
    }
    if (filter.rating) {
      query = query.where("rating", "==", filter.rating);
    }

    const snapshot = await query.get();
    let list = snapshot.docs.map((doc) => doc.data() as ReviewDocument);

    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.clientName.toLowerCase().includes(q) ||
          r.reviewText.toLowerCase().includes(q) ||
          (r.shopName && r.shopName.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q)),
      );
    }

    // Sort newest first
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    // Compute stats across all matching or overall
    const sumRatings = list.reduce((acc, r) => acc + (r.rating || 5), 0);
    const averageRating = total > 0 ? parseFloat((sumRatings / total).toFixed(1)) : 5.0;
    const fiveStarCount = list.filter((r) => r.rating >= 5).length;

    return {
      reviews: paginated,
      total,
      page,
      limit,
      totalPages,
      stats: {
        total,
        averageRating,
        fiveStarCount,
      },
    };
  }

  /**
   * Update review
   */
  static async updateReview(
    id: string,
    input: UpdateReviewInput,
  ): Promise<ReviewDocument> {
    const existing = await this.getReviewById(id);
    const now = new Date().toISOString();

    const updated: ReviewDocument = {
      ...existing,
      ...(input.clientName ? { clientName: input.clientName.trim() } : {}),
      ...(input.shopName !== undefined ? { shopName: input.shopName?.trim() } : {}),
      ...(input.location !== undefined ? { location: input.location?.trim() } : {}),
      ...(input.rating ? { rating: Math.min(5, Math.max(1, Math.round(input.rating))) } : {}),
      ...(input.reviewText ? { reviewText: input.reviewText.trim() } : {}),
      updatedAt: now,
    };

    await firestore
      .collection(REVIEWS_COLLECTION)
      .doc(id)
      .set(this.cleanObject(updated), { merge: true });

    return updated;
  }

  /**
   * Delete review
   */
  static async deleteReview(id: string): Promise<boolean> {
    await this.getReviewById(id); // Ensure exists
    await firestore.collection(REVIEWS_COLLECTION).doc(id).delete();
    return true;
  }
}

