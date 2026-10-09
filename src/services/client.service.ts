import crypto from "crypto";
import {
  ClientDocument,
  RegisterClientInput,
  LoginClientInput,
  UpdateClientInput,
  ClientAuthResponse,
  ClientSubscription,
} from "../types";
import {
  admin,
  firebaseAuth,
  firestore,
  isFirebaseInitialized,
} from "../config/firebase";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { addDays, isDateExpired, getRemainingDays } from "../utils/dateUtils";
import { mockStorage } from "./mockStorage.service";
import { AdminService } from "./admin.service";

const FIRESTORE_COLLECTION = "clients";

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
   * Helper to generate Firebase ID token for a client
   */
  private static async generateAuthToken(
    client: ClientDocument,
  ): Promise<string> {
    if (!isFirebaseInitialized || !firebaseAuth) {
      throw ApiError.internal(
        "Firebase authentication is not initialized on the server",
      );
    }

    // Create a custom token containing role and plan claims
    const customToken = await firebaseAuth.createCustomToken(client.id, {
      role: "client",
      plan: client.subscription.plan,
    });

    // Exchange custom token for an official Firebase ID token
    return await AdminService.exchangeCustomTokenForIdToken(customToken);
  }

  /**
   * Register a new client
   */
  static async registerClient(
    input: RegisterClientInput,
  ): Promise<ClientAuthResponse> {
    const trialDays = input.trialDays || env.DEFAULT_TRIAL_DAYS;
    const now = new Date();
    const expiryDate = addDays(now, trialDays);
    const plan = input.plan || "trial";

    const initialSubscription: ClientSubscription = {
      plan,
      status: plan === "trial" ? "trial" : "active",
      startDate: now.toISOString(),
      durationDays: trialDays,
      expiryDate: expiryDate.toISOString(),
      autoRenew: false,
      history: [
        {
          id: `hist_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          extendedAt: now.toISOString(),
          durationDays: trialDays,
          previousExpiryDate: now.toISOString(),
          newExpiryDate: expiryDate.toISOString(),
          plan,
          notes: "Initial account registration & trial allocation",
          extendedBy: "system",
        },
      ],
    };

    let uid = "";

    // 1. Firebase Mode
    if (isFirebaseInitialized && firebaseAuth && firestore) {
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
          isActive: true,
          subscription: initialSubscription,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        // Save to Firestore (with local fallback if Firestore is not available)
        try {
          await firestore
            .collection(FIRESTORE_COLLECTION)
            .doc(uid)
            .set(this.cleanObject(clientDoc));
        } catch (dbErr: any) {
          console.warn('⚠️ Firestore write issue, saving client locally:', dbErr.message);
          await mockStorage.createClient(clientDoc, input.password);
        }

        const token = await this.generateAuthToken(clientDoc);

        return {
          token,
          tokenType: "Bearer",
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

    // 2. Mock Mode (Dev / Test without Firebase credentials)
    const existing = await mockStorage.getClientByEmail(input.email);
    if (existing) {
      throw ApiError.conflict(
        `A client with email ${input.email} already exists`,
      );
    }

    uid = `mock_usr_${crypto.randomUUID()}`;
    const clientDoc: ClientDocument = {
      id: uid,
      email: input.email.toLowerCase(),
      name: input.name,
      phone: input.phone,
      shopName: input.shopName,
      shopType: input.shopType,
      address: input.address,
      currencySymbol: input.currencySymbol || "$",
      isActive: true,
      subscription: initialSubscription,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await mockStorage.createClient(clientDoc, input.password);
    const token = await this.generateAuthToken(clientDoc);

    return {
      token,
      tokenType: "Bearer",
      client: clientDoc,
      subscriptionStatus: {
        status: clientDoc.subscription.status,
        plan: clientDoc.subscription.plan,
        expiryDate: clientDoc.subscription.expiryDate,
        daysRemaining: getRemainingDays(clientDoc.subscription.expiryDate),
        isExpired: isDateExpired(clientDoc.subscription.expiryDate),
      },
    };
  }

  /**
   * Login client with email and password
   */
  static async loginClient(
    input: LoginClientInput,
  ): Promise<ClientAuthResponse> {
    let client: ClientDocument | null = null;
    let customTokenOrIdToken = "";

    // 1. Firebase Mode
    if (isFirebaseInitialized && firebaseAuth && firestore) {
      // Check if Firebase Web API Key is configured to authenticate password
      if (env.FIREBASE_WEB_API_KEY) {
        const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`;
        const response = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: input.email,
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
            throw ApiError.unauthorized("Invalid email or password");
          }
          throw ApiError.badRequest(errorMessage || "Authentication failed");
        }

        const uid = data.localId;
        customTokenOrIdToken = data.idToken;

        // Fetch client document from Firestore (or fallback to local mock store)
        try {
          const docSnap = await firestore
            .collection(FIRESTORE_COLLECTION)
            .doc(uid)
            .get();
          if (docSnap.exists) {
            client = docSnap.data() as ClientDocument;
          }
        } catch (dbErr: any) {
          if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
            client = await mockStorage.getClientById(uid);
          } else {
            throw dbErr;
          }
        }

        if (!client) {
          client = await mockStorage.getClientById(uid);
        }
        if (!client) {
          throw ApiError.notFound("Client profile not found in database");
        }
      } else {
        // When Firebase Web API Key is not set, lookup by email in Firebase Auth
        try {
          const userRecord = await firebaseAuth.getUserByEmail(input.email);
          try {
            const docSnap = await firestore
              .collection(FIRESTORE_COLLECTION)
              .doc(userRecord.uid)
              .get();
            if (docSnap.exists) {
              client = docSnap.data() as ClientDocument;
            }
          } catch (dbErr: any) {
            if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
              client = await mockStorage.getClientById(userRecord.uid);
            } else {
              throw dbErr;
            }
          }

          if (!client) {
            client = await mockStorage.getClientById(userRecord.uid);
          }
          if (!client) {
            throw ApiError.notFound("Client profile not found in database");
          }
          const customToken = await firebaseAuth.createCustomToken(
            userRecord.uid,
            { role: "client", plan: client.subscription.plan },
          );
          customTokenOrIdToken =
            await AdminService.exchangeCustomTokenForIdToken(customToken);
        } catch (err: any) {
          if (err.code === "auth/user-not-found") {
            throw ApiError.unauthorized("Invalid email or password");
          }
          throw err;
        }
      }
    } else {
      // 2. Mock Mode
      client = await mockStorage.verifyPassword(input.email, input.password);
      if (!client) {
        throw ApiError.unauthorized("Invalid email or password");
      }
    }

    if (!client.isActive) {
      throw ApiError.forbidden(
        "Client account has been deactivated. Please contact support.",
      );
    }

    // Evaluate subscription expiry
    const evaluatedSubscription = this.evaluateSubscription(
      client.subscription,
    );
    if (evaluatedSubscription.status !== client.subscription.status) {
      client.subscription = evaluatedSubscription;
      client.updatedAt = new Date().toISOString();

      // Persist status change
      if (isFirebaseInitialized && firestore) {
        await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
          "subscription.status": evaluatedSubscription.status,
          updatedAt: client.updatedAt,
        });
      } else {
        await mockStorage.updateClient(client.id, client);
      }
    }

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
    let client: ClientDocument | null = null;

    if (isFirebaseInitialized && firestore) {
      try {
        const docSnap = await firestore
          .collection(FIRESTORE_COLLECTION)
          .doc(id)
          .get();
        if (docSnap.exists) {
          client = docSnap.data() as ClientDocument;
        }
      } catch (dbErr: any) {
        if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
          client = await mockStorage.getClientById(id);
        } else {
          throw dbErr;
        }
      }
    }

    if (!client) {
      client = await mockStorage.getClientById(id);
    }
    if (!client) {
      throw ApiError.notFound(`Client with ID ${id} not found`);
    }

    // Check expiry
    const evaluated = this.evaluateSubscription(client.subscription);
    if (evaluated.status !== client.subscription.status) {
      client.subscription = evaluated;
      client.updatedAt = new Date().toISOString();
      if (isFirebaseInitialized && firestore) {
        try {
          await firestore.collection(FIRESTORE_COLLECTION).doc(id).update({
            "subscription.status": evaluated.status,
            updatedAt: client.updatedAt,
          });
        } catch {
          await mockStorage.updateClient(id, client);
        }
      } else {
        await mockStorage.updateClient(id, client);
      }
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

    const updates: Partial<ClientDocument> = this.cleanObject({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.shopName !== undefined && { shopName: input.shopName }),
      ...(input.shopType !== undefined && { shopType: input.shopType }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.currencySymbol !== undefined && {
        currencySymbol: input.currencySymbol,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: now,
    });

    if (isFirebaseInitialized && firestore) {
      try {
        await firestore.collection(FIRESTORE_COLLECTION).doc(id).update(updates);
      } catch (dbErr: any) {
        await mockStorage.updateClient(id, updates);
      }

      // Update Firebase Auth display details if relevant
      if (firebaseAuth && (input.name || input.phone)) {
        try {
          await firebaseAuth.updateUser(id, {
            ...(input.name ? { displayName: input.name } : {}),
            ...(input.phone ? { phoneNumber: input.phone } : {}),
          });
        } catch (fbErr) {
          console.warn("Failed to sync auth display info:", fbErr);
        }
      }
    } else {
      await mockStorage.updateClient(id, updates);
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
    const limit = query.limit || 20;

    if (isFirebaseInitialized && firestore) {
      try {
        let queryRef: admin.firestore.Query =
          firestore.collection(FIRESTORE_COLLECTION);

        if (query.status) {
          queryRef = queryRef.where("subscription.status", "==", query.status);
        }
        if (query.plan) {
          queryRef = queryRef.where("subscription.plan", "==", query.plan);
        }

        const snapshot = await queryRef.get();
        let allDocs = snapshot.docs.map(
          (doc: any) => doc.data() as ClientDocument,
        );

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
      } catch (dbErr: any) {
        if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
          const result = await mockStorage.listClients(query);
          return { ...result, page, limit };
        }
        throw dbErr;
      }
    }

    const result = await mockStorage.listClients(query);
    return { ...result, page, limit };
  }

  /**
   * Delete client
   */
  static async deleteClient(id: string): Promise<boolean> {
    await this.getClientById(id);

    if (isFirebaseInitialized && firestore && firebaseAuth) {
      await firestore.collection(FIRESTORE_COLLECTION).doc(id).delete();
      try {
        await firebaseAuth.deleteUser(id);
      } catch (err) {
        console.warn(`Failed to delete Firebase auth user ${id}:`, err);
      }
      return true;
    }

    return await mockStorage.deleteClient(id);
  }
}
