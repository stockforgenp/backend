import {
  InquiryDocument,
  CreateInquiryInput,
  UpdateInquiryInput,
  ListInquiriesFilter,
} from "../types";
import { firestore } from "../config/firebase";
import { ApiError } from "../utils/apiError";

const INQUIRIES_COLLECTION = "inquiries";

export class InquiryService {
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
   * Submit a new inquiry
   */
  static async createInquiry(
    input: CreateInquiryInput,
  ): Promise<InquiryDocument> {
    const now = new Date().toISOString();
    const docRef = firestore.collection(INQUIRIES_COLLECTION).doc();
    const id = docRef.id;

    const inquiryDoc: InquiryDocument = {
      id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim(),
      shopName: input.shopName?.trim(),
      storeType: input.storeType?.trim(),
      type: input.type || "general",
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: "pending",
      clientId: input.clientId,
      source: input.source || "website",
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(this.cleanObject(inquiryDoc));
    return inquiryDoc;
  }

  /**
   * Get inquiry by ID
   */
  static async getInquiryById(id: string): Promise<InquiryDocument> {
    const snap = await firestore.collection(INQUIRIES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      throw ApiError.notFound(`Inquiry with ID '${id}' not found`);
    }

    return snap.data() as InquiryDocument;
  }

  /**
   * Update inquiry (e.g. status transition, admin notes)
   */
  static async updateInquiry(
    id: string,
    input: UpdateInquiryInput,
  ): Promise<InquiryDocument> {
    const existing = await this.getInquiryById(id);
    const now = new Date().toISOString();

    const updated: InquiryDocument = {
      ...existing,
      ...(input.status ? { status: input.status } : {}),
      ...(input.adminNotes !== undefined
        ? { adminNotes: input.adminNotes }
        : {}),
      ...(input.status === "resolved" && !existing.resolvedAt
        ? { resolvedAt: now }
        : {}),
      updatedAt: now,
    };

    await firestore
      .collection(INQUIRIES_COLLECTION)
      .doc(id)
      .set(this.cleanObject(updated), { merge: true });

    return updated;
  }

  /**
   * Delete an inquiry
   */
  static async deleteInquiry(id: string): Promise<boolean> {
    await this.getInquiryById(id); // Ensures it exists first
    await firestore.collection(INQUIRIES_COLLECTION).doc(id).delete();
    return true;
  }

  /**
   * List inquiries with filtering, search, and pagination
   */
  static async listInquiries(filter: ListInquiriesFilter = {}): Promise<{
    inquiries: InquiryDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 100;

    let query: FirebaseFirestore.Query = firestore.collection(
      INQUIRIES_COLLECTION,
    );

    if (filter.status) {
      query = query.where("status", "==", filter.status);
    }
    if (filter.type) {
      query = query.where("type", "==", filter.type);
    }
    if (filter.clientId) {
      query = query.where("clientId", "==", filter.clientId);
    }

    const snapshot = await query.get();
    let list = snapshot.docs.map((doc) => doc.data() as InquiryDocument);

    if (filter.search) {
      const search = filter.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          i.email.toLowerCase().includes(search) ||
          i.subject.toLowerCase().includes(search) ||
          (i.shopName && i.shopName.toLowerCase().includes(search)),
      );
    }

    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    return {
      inquiries: paginated,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
