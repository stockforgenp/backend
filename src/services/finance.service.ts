import { firestore } from "../config/firebase";
import {
  FinanceTransactionDocument,
  CreateFinanceTransactionInput,
  UpdateFinanceTransactionInput,
  ListFinancesFilter,
  FinanceSummaryStats,
} from "../types";
import { ApiError } from "../utils/apiError";

export const FINANCES_COLLECTION = "finances";

export class FinanceService {
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
   * Helper to resolve client name and shop from client ID
   */
  private static async resolveClientDetails(clientId: string): Promise<{
    name?: string;
    shopName?: string;
  }> {
    try {
      const snap = await firestore.collection("clients").doc(clientId).get();
      if (snap.exists) {
        const data = snap.data() as any;
        return {
          name: data.name,
          shopName: data.shopName || data.company_name,
        };
      }
    } catch (e) {
      console.warn(`Could not resolve client details for ID ${clientId}:`, e);
    }
    return {};
  }

  /**
   * Create a new finance transaction (income or expense)
   */
  static async createTransaction(
    input: CreateFinanceTransactionInput,
    creatorUid?: string,
  ): Promise<FinanceTransactionDocument> {
    const now = new Date().toISOString();
    const docRef = firestore.collection(FINANCES_COLLECTION).doc();
    const id = docRef.id;

    let clientName = input.clientName?.trim();
    let clientShopName = input.clientShopName?.trim();

    if (input.clientId && (!clientName || !clientShopName)) {
      const clientInfo = await this.resolveClientDetails(input.clientId);
      if (!clientName && clientInfo.name) clientName = clientInfo.name;
      if (!clientShopName && clientInfo.shopName) clientShopName = clientInfo.shopName;
    }

    const doc: FinanceTransactionDocument = {
      id,
      type: input.type,
      category: input.category.trim(),
      amount: Math.round(Number(input.amount) * 100) / 100,
      date: input.date.trim(),
      paymentMethod: input.paymentMethod?.trim(),
      clientId: input.clientId?.trim() || undefined,
      clientName: clientName || undefined,
      clientShopName: clientShopName || undefined,
      reference: input.reference?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdBy: creatorUid || input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(this.cleanObject(doc));
    return doc;
  }

  /**
   * Retrieve single finance record by ID
   */
  static async getTransactionById(id: string): Promise<FinanceTransactionDocument> {
    const snap = await firestore.collection(FINANCES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      throw ApiError.notFound(`Finance record with ID '${id}' not found`);
    }
    return snap.data() as FinanceTransactionDocument;
  }

  /**
   * Update existing finance record
   */
  static async updateTransaction(
    id: string,
    input: UpdateFinanceTransactionInput,
  ): Promise<FinanceTransactionDocument> {
    const existing = await this.getTransactionById(id);

    let clientName = input.clientName !== undefined ? input.clientName?.trim() : existing.clientName;
    let clientShopName = input.clientShopName !== undefined ? input.clientShopName?.trim() : existing.clientShopName;
    const clientId = input.clientId !== undefined ? input.clientId?.trim() : existing.clientId;

    if (clientId && (!clientName || !clientShopName)) {
      const clientInfo = await this.resolveClientDetails(clientId);
      if (!clientName && clientInfo.name) clientName = clientInfo.name;
      if (!clientShopName && clientInfo.shopName) clientShopName = clientInfo.shopName;
    }

    const updatedDoc: FinanceTransactionDocument = {
      ...existing,
      type: input.type || existing.type,
      category: input.category !== undefined ? input.category.trim() : existing.category,
      amount: input.amount !== undefined ? Math.round(Number(input.amount) * 100) / 100 : existing.amount,
      date: input.date !== undefined ? input.date.trim() : existing.date,
      paymentMethod: input.paymentMethod !== undefined ? input.paymentMethod?.trim() || undefined : existing.paymentMethod,
      clientId: clientId || undefined,
      clientName: clientName || undefined,
      clientShopName: clientShopName || undefined,
      reference: input.reference !== undefined ? input.reference?.trim() || undefined : existing.reference,
      note: input.note !== undefined ? input.note?.trim() || undefined : existing.note,
      updatedAt: new Date().toISOString(),
    };

    await firestore.collection(FINANCES_COLLECTION).doc(id).set(this.cleanObject(updatedDoc));
    return updatedDoc;
  }

  /**
   * Delete finance record
   */
  static async deleteTransaction(id: string): Promise<void> {
    const docRef = firestore.collection(FINANCES_COLLECTION).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw ApiError.notFound(`Finance record with ID '${id}' not found`);
    }
    await docRef.delete();
  }

  /**
   * List finance records with filters and pagination
   */
  static async listTransactions(filter: ListFinancesFilter): Promise<{
    data: FinanceTransactionDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const snap = await firestore.collection(FINANCES_COLLECTION).get();
    let records = snap.docs.map((doc) => doc.data() as FinanceTransactionDocument);

    // Filter by type
    if (filter.type && filter.type !== "all") {
      records = records.filter((r) => r.type === filter.type);
    }

    // Filter by category
    if (filter.category && filter.category !== "all") {
      const catLower = filter.category.toLowerCase().trim();
      records = records.filter((r) => r.category.toLowerCase() === catLower);
    }

    // Filter by clientId
    if (filter.clientId && filter.clientId !== "all") {
      records = records.filter((r) => r.clientId === filter.clientId);
    }

    // Filter by date range
    if (filter.startDate) {
      records = records.filter((r) => r.date >= filter.startDate!);
    }
    if (filter.endDate) {
      records = records.filter((r) => r.date <= filter.endDate!);
    }

    // Search query
    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      records = records.filter((r) => {
        return (
          r.category.toLowerCase().includes(q) ||
          (r.clientName && r.clientName.toLowerCase().includes(q)) ||
          (r.clientShopName && r.clientShopName.toLowerCase().includes(q)) ||
          (r.reference && r.reference.toLowerCase().includes(q)) ||
          (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q)) ||
          (r.note && r.note.toLowerCase().includes(q)) ||
          String(r.amount).includes(q)
        );
      });
    }

    // Sort by transaction date descending, then createdAt descending
    records.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = records.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 100);
    const startIndex = (page - 1) * limit;
    const paginated = records.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
    };
  }

  /**
   * Aggregate statistics for income and expenses
   */
  static async getSummaryStats(filter?: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
  }): Promise<FinanceSummaryStats> {
    const snap = await firestore.collection(FINANCES_COLLECTION).get();
    let records = snap.docs.map((doc) => doc.data() as FinanceTransactionDocument);

    if (filter?.clientId && filter.clientId !== "all") {
      records = records.filter((r) => r.clientId === filter.clientId);
    }
    if (filter?.startDate) {
      records = records.filter((r) => r.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      records = records.filter((r) => r.date <= filter.endDate!);
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    for (const r of records) {
      const amt = Number(r.amount) || 0;
      if (r.type === "income") {
        totalIncome += amt;
        incomeCount++;
        incomeByCategory[r.category] = (incomeByCategory[r.category] || 0) + amt;
      } else if (r.type === "expense") {
        totalExpenses += amt;
        expenseCount++;
        expenseByCategory[r.category] = (expenseByCategory[r.category] || 0) + amt;
      }
    }

    // Sort newest transactions first
    records.sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const recentTransactions = records.slice(0, 10);

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round((totalIncome - totalExpenses) * 100) / 100,
      transactionCount: records.length,
      incomeCount,
      expenseCount,
      incomeByCategory,
      expenseByCategory,
      recentTransactions,
    };
  }
}

