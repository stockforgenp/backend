import crypto from "crypto";
import {
  ClientDocument,
  RegisterClientInput,
  LoginClientInput,
  UpdateClientInput,
  ClientAuthResponse,
  RegisterClientResponse,
  ClientSubscription,
} from "../types";
import { admin, firebaseAuth, firestore } from "../config/firebase";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { addDays, isDateExpired, getRemainingDays } from "../utils/dateUtils";
import { AdminService } from "./admin.service";
import { signAuthToken } from "../utils/token.util";

export const FIRESTORE_COLLECTION = "clients";
export const SUBSCRIPTION_HISTORY_COLLECTION = "subscription_history";

export class ClientService {
  /**
   * Helper to evaluate and sync subscription status
   */
  private static evaluateSubscription(
    sub: ClientSubscription,
  ): ClientSubscription {
    const expired = isDateExpired(sub.expiryDate);
    if (expired && sub.status !== "expired" && sub.status !== "cancelled") {
      return {
        ...sub,
        status: "expired",
      };
    }
    return sub;
  }

  static cleanObject<T extends Record<string, any>>(obj: T): T {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Helper to generate non-expiring authentication token for a client
   */
  private static async generateAuthToken(
    client: ClientDocument,
  ): Promise<string> {
    return signAuthToken({
      uid: client.id,
      email: client.email,
      name: client.name,
      role: "client",
      isAdmin: false,
      businessName: client.shopName,
      plan: client.subscription.plan,
    });
  }

  /**
   * Register a new client
   */
  static async registerClient(
    input: RegisterClientInput,
  ): Promise<RegisterClientResponse> {
    const plan = input.plan || "trial";
    const durationDays =
      input.durationDays ||
      input.trialDays ||
      (plan === "trial" ? env.DEFAULT_TRIAL_DAYS : 30);
    const now = new Date();
    const expiryDate = addDays(now, durationDays);

    const initialSubscription: ClientSubscription = {
      plan,
      status: plan === "trial" ? "trial" : "active",
      startDate: now.toISOString(),
      durationDays,
      expiryDate: expiryDate.toISOString(),
      autoRenew: false,
    };

    let uid = "";

    try {
      // Create user in Firebase Authentication
      const userRecord = await firebaseAuth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        ...(input.phone ? { phoneNumber: input.phone } : {}),
      });

      uid = userRecord.uid;

      // Set custom user claims for role & plan
      await firebaseAuth.setCustomUserClaims(uid, {
        role: "client",
        plan,
      });

      const clientDoc: ClientDocument = {
        id: uid,
        email: input.email.toLowerCase(),
        name: input.name,
        phone: input.phone,
        shopName: input.shopName,
        shopType: input.shopType,
        address: input.address,
        currencySymbol: input.currencySymbol || "$",
        status: input.status || "active",
        subscription: initialSubscription,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Save client profile to Firestore
      await firestore
        .collection(FIRESTORE_COLLECTION)
        .doc(uid)
        .set(this.cleanObject(clientDoc));

      // Save initial subscription history record to separate collection
      const initialHistoryRecord = {
        id: `sub_hist_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        clientId: uid,
        type: plan === "trial" ? "trial_creation" : "plan_creation",
        extendedAt: now.toISOString(),
        durationDays,
        previousExpiryDate: now.toISOString(),
        newExpiryDate: expiryDate.toISOString(),
        plan,
        notes:
          plan === "trial"
            ? `Initial account registration & trial allocation (${durationDays} days)`
            : `Initial account registration on ${plan} plan (${durationDays} days)`,
        extendedBy: "system",
        createdAt: now.toISOString(),
      };

      await firestore
        .collection(SUBSCRIPTION_HISTORY_COLLECTION)
        .doc(initialHistoryRecord.id)
        .set(this.cleanObject(initialHistoryRecord));

      return {
        client: clientDoc,
        subscriptionStatus: {
          status: clientDoc.subscription.status,
          plan: clientDoc.subscription.plan,
          expiryDate: clientDoc.subscription.expiryDate,
          daysRemaining: getRemainingDays(clientDoc.subscription.expiryDate),
          isExpired: isDateExpired(clientDoc.subscription.expiryDate),
        },
      };
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        throw ApiError.conflict(
          `A client with email ${input.email} already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Login client with email and password
   */
  static async loginClient(
    input: LoginClientInput,
  ): Promise<ClientAuthResponse> {
    if (!env.FIREBASE_WEB_API_KEY) {
      throw ApiError.internal(
        "FIREBASE_WEB_API_KEY is not configured on the server",
      );
    }

    let emailToAuth = input.email.trim();

    // If input is a phone number (does not contain @), look up corresponding client email from Firestore
    if (!emailToAuth.includes("@")) {
      const clientPhoneSnapshot = await firestore
        .collection(FIRESTORE_COLLECTION)
        .where("phone", "==", emailToAuth)
        .limit(1)
        .get();

      if (clientPhoneSnapshot.empty) {
        throw ApiError.unauthorized("Invalid email, phone number, or password");
      }

      const clientData = clientPhoneSnapshot.docs[0].data() as ClientDocument;
      emailToAuth = clientData.email;
    }

    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`;
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailToAuth,
        password: input.password,
        returnSecureToken: true,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      const errorMessage = data?.error?.message;
      if (
        errorMessage === "EMAIL_NOT_FOUND" ||
        errorMessage === "INVALID_PASSWORD" ||
        errorMessage === "INVALID_LOGIN_CREDENTIALS"
      ) {
        throw ApiError.unauthorized("Invalid email, phone number, or password");
      }
      throw ApiError.badRequest(errorMessage || "Authentication failed");
    }

    const uid = data.localId;

    // Fetch client document from Firestore
    const docSnap = await firestore
      .collection(FIRESTORE_COLLECTION)
      .doc(uid)
      .get();

    if (!docSnap.exists) {
      throw ApiError.notFound("Client profile not found in database");
    }

    const client = docSnap.data() as ClientDocument;
    const clientStatus = client.status || "active";

    if (clientStatus === "banned") {
      throw ApiError.forbidden(
        "Client account has been banned due to policy violation. Please contact support.",
      );
    }

    if (clientStatus === "suspended") {
      throw ApiError.forbidden(
        "Client account is currently suspended. Please contact support or administration.",
      );
    }

    if (clientStatus === "inactive") {
      throw ApiError.forbidden(
        "Client account is inactive. Please contact support to activate your account.",
      );
    }

    // Evaluate subscription expiry
    const evaluatedSubscription = this.evaluateSubscription(
      client.subscription,
    );
    if (evaluatedSubscription.status !== client.subscription.status) {
      client.subscription = evaluatedSubscription;
      client.updatedAt = new Date().toISOString();

      await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
        "subscription.status": evaluatedSubscription.status,
        updatedAt: client.updatedAt,
      });
    }

    // Generate Firebase ID token with custom claims
    const token = await this.generateAuthToken(client);

    return {
      token,
      tokenType: "Bearer",
      client,
      subscriptionStatus: {
        status: client.subscription.status,
        plan: client.subscription.plan,
        expiryDate: client.subscription.expiryDate,
        daysRemaining: getRemainingDays(client.subscription.expiryDate),
        isExpired: isDateExpired(client.subscription.expiryDate),
      },
    };
  }

  /**
   * Get client by ID
   */
  static async getClientById(id: string): Promise<ClientDocument> {
    const docSnap = await firestore
      .collection(FIRESTORE_COLLECTION)
      .doc(id)
      .get();

    if (!docSnap.exists) {
      throw ApiError.notFound(`Client with ID ${id} not found`);
    }

    const client = docSnap.data() as ClientDocument;

    // Check expiry
    const evaluated = this.evaluateSubscription(client.subscription);
    if (evaluated.status !== client.subscription.status) {
      client.subscription = evaluated;
      client.updatedAt = new Date().toISOString();
      await firestore.collection(FIRESTORE_COLLECTION).doc(id).update({
        "subscription.status": evaluated.status,
        updatedAt: client.updatedAt,
      });
    }

    return client;
  }

  /**
   * Update client details
   */
  static async updateClient(
    id: string,
    input: UpdateClientInput,
  ): Promise<ClientDocument> {
    const client = await this.getClientById(id);
    const now = new Date().toISOString();

    const targetStatus = input.status;

    const updates: Partial<ClientDocument> = this.cleanObject({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.shopName !== undefined && { shopName: input.shopName }),
      ...(input.shopType !== undefined && { shopType: input.shopType }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.currencySymbol !== undefined && {
        currencySymbol: input.currencySymbol,
      }),
      ...(targetStatus !== undefined && {
        status: targetStatus,
      }),
      updatedAt: now,
    });

    await firestore.collection(FIRESTORE_COLLECTION).doc(id).update(updates);

    // Update Firebase Auth display details if relevant
    if (input.name || input.phone) {
      try {
        await firebaseAuth.updateUser(id, {
          ...(input.name ? { displayName: input.name } : {}),
          ...(input.phone ? { phoneNumber: input.phone } : {}),
        });
      } catch (fbErr) {
        console.warn("Failed to sync auth display info:", fbErr);
      }
    }

    return { ...client, ...updates };
  }

  /**
   * List clients with filtering and pagination
   */
  static async listClients(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
  }): Promise<{
    clients: ClientDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 100;

    let queryRef: admin.firestore.Query =
      firestore.collection(FIRESTORE_COLLECTION);

    if (query.plan) {
      queryRef = queryRef.where("subscription.plan", "==", query.plan);
    }

    const snapshot = await queryRef.get();
    let allDocs = snapshot.docs.map((doc: any) => {
      const data = doc.data() as ClientDocument;
      return {
        ...data,
        status: data.status || "active",
      };
    });

    if (query.status) {
      const filterStatus = query.status.toLowerCase();
      allDocs = allDocs.filter((c: ClientDocument) => {
        const clientStatus = (c.status || "active").toLowerCase();
        const subStatus = (c.subscription?.status || "").toLowerCase();
        return clientStatus === filterStatus || subStatus === filterStatus;
      });
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      allDocs = allDocs.filter(
        (c: ClientDocument) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          (c.shopName && c.shopName.toLowerCase().includes(search)),
      );
    }

    const total = allDocs.length;
    const offset = (page - 1) * limit;
    const paginated = allDocs.slice(offset, offset + limit);

    return { clients: paginated, total, page, limit };
  }

  /**
   * Delete client
   */
  static async deleteClient(id: string): Promise<boolean> {
    await this.getClientById(id);

    // Delete client document
    await firestore.collection(FIRESTORE_COLLECTION).doc(id).delete();

    // Delete associated subscription history documents
    try {
      const historyDocs = await firestore
        .collection(SUBSCRIPTION_HISTORY_COLLECTION)
        .where("clientId", "==", id)
        .get();

      if (!historyDocs.empty) {
        const batch = firestore.batch();
        historyDocs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (histErr) {
      console.warn(
        `Failed to clean up subscription history for client ${id}:`,
        histErr,
      );
    }

    try {
      await firebaseAuth.deleteUser(id);
    } catch (err) {
      console.warn(`Failed to delete Firebase auth user ${id}:`, err);
    }
    return true;
  }
}
