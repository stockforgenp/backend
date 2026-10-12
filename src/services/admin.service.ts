import { env } from "../config/env";
import {
  firebaseAuth,
  firestore,
  isFirebaseInitialized,
} from "../config/firebase";
import { AdminAuthResponse, AdminUser } from "../types";
import { ApiError } from "../utils/apiError";

const ADMIN_COLLECTION = "users";

export class AdminService {
  /**
   * Helper to exchange a Firebase custom token for a Firebase ID Token using Google Identity Toolkit
   */
  static async exchangeCustomTokenForIdToken(
    customToken: string,
  ): Promise<string> {
    if (!env.FIREBASE_WEB_API_KEY) {
      throw ApiError.internal(
        "FIREBASE_WEB_API_KEY is not configured on the server",
      );
    }

    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.FIREBASE_WEB_API_KEY}`;
    const res = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.idToken) {
      const errMessage =
        data?.error?.message ||
        "Failed to exchange custom token for Firebase ID token";
      throw ApiError.internal(`Firebase Identity Toolkit error: ${errMessage}`);
    }

    return data.idToken;
  }

  /**
   * Automatically initializes or verifies the Super Admin user in Firebase Auth and Firestore
   */
  static async seedSuperAdmin(): Promise<AdminUser> {
    if (!isFirebaseInitialized || !firebaseAuth) {
      throw new ApiError(
        500,
        "Firebase is not initialized. Cannot seed Super Admin.",
      );
    }

    const email = env.SUPER_ADMIN_EMAIL;
    const password = env.SUPER_ADMIN_PASSWORD;
    const phoneNumber = env.SUPER_ADMIN_PHONE_NUMBER;
    const name = env.SUPER_ADMIN_NAME;
    const now = new Date().toISOString();

    let adminUid = "";

    try {
      const existingUser = await firebaseAuth
        .getUserByEmail(email)
        .catch(() => null);
      if (existingUser) {
        adminUid = existingUser.uid;
        await firebaseAuth.updateUser(adminUid, {
          password,
          displayName: name,
        });
      } else {
        const userRecord = await firebaseAuth.createUser({
          email,
          password,
          phoneNumber,
          displayName: name,
        });
        adminUid = userRecord.uid;
      }

      // Assign 'super_admin' custom claim for role-based security
      await firebaseAuth.setCustomUserClaims(adminUid, {
        role: "super_admin",
        isAdmin: true,
      });

      if (firestore) {
        await firestore
          .collection(ADMIN_COLLECTION)
          .doc(adminUid)
          .set(
            {
              email,
              name,
              phoneNumber,
              role: "super_admin",
              createdAt: now,
              updatedAt: now,
            },
            { merge: true },
          )
          .catch((err: any) => {
            console.warn(
              "⚠️ Firestore write skipped during admin seed:",
              err.message,
            );
          });
      }

      console.log(
        `🛡️ Super Admin verified in Firebase Auth: ${email} (${adminUid})`,
      );
    } catch (fbErr: any) {
      console.warn("⚠️ Firebase Admin seed warning:", fbErr.message);
    }

    return {
      id: adminUid || "super_admin_root",
      email,
      name,
      phoneNumber,
      role: "super_admin",
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Super Admin Login - Returns authentic Firebase ID Token
   */
  static async loginSuperAdmin(input: {
    email: string;
    password: string;
  }): Promise<AdminAuthResponse> {
    if (!isFirebaseInitialized || !firebaseAuth) {
      throw ApiError.internal(
        "Firebase authentication is not configured on the server",
      );
    }

    const inputEmail = input.email.trim().toLowerCase();
    const configuredEmail = env.SUPER_ADMIN_EMAIL.trim().toLowerCase();

    // 1. If credentials match the master super admin in .env
    if (
      inputEmail === configuredEmail &&
      input.password === env.SUPER_ADMIN_PASSWORD
    ) {
      // Fetch or seed the Super Admin in Firebase Auth
      let user = await firebaseAuth
        .getUserByEmail(configuredEmail)
        .catch(() => null);
      if (!user) {
        await this.seedSuperAdmin();
        user = await firebaseAuth.getUserByEmail(configuredEmail);
      }

      // Ensure custom claims are up to date
      await firebaseAuth.setCustomUserClaims(user.uid, {
        role: "super_admin",
        isAdmin: true,
      });

      // Create a custom token containing super_admin claims and exchange for a Firebase ID token
      const customToken = await firebaseAuth.createCustomToken(user.uid, {
        role: "super_admin",
        isAdmin: true,
      });
      const idToken = await this.exchangeCustomTokenForIdToken(customToken);

      const adminUser: AdminUser = {
        id: user.uid,
        email: user.email || configuredEmail,
        name: user.displayName || env.SUPER_ADMIN_NAME,
        phoneNumber: user.phoneNumber || env.SUPER_ADMIN_PHONE_NUMBER,
        role: "super_admin",
        createdAt: user.metadata.creationTime,
        updatedAt: new Date().toISOString(),
      };

      return {
        token: idToken,
        tokenType: "Bearer",
        admin: adminUser,
      };
    }

    // 2. Otherwise verify via Firebase Auth Password REST endpoint
    if (!env.FIREBASE_WEB_API_KEY) {
      throw ApiError.unauthorized("Invalid super admin credentials");
    }

    try {
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`;
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          returnSecureToken: true,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw ApiError.unauthorized("Invalid super admin credentials");
      }

      const user = await firebaseAuth.getUser(data.localId);
      if (
        user.customClaims?.role !== "super_admin" &&
        user.customClaims?.role !== "admin"
      ) {
        throw ApiError.forbidden("Access restricted to super administrators");
      }

      const adminUser: AdminUser = {
        id: user.uid,
        email: user.email || input.email,
        name: user.displayName || env.SUPER_ADMIN_NAME,
        phoneNumber: user.phoneNumber || "",
        role:
          (user.customClaims?.role as "super_admin" | "admin") || "super_admin",
        createdAt: user.metadata.creationTime,
        updatedAt: new Date().toISOString(),
      };

      return {
        token: data.idToken,
        tokenType: "Bearer",
        admin: adminUser,
      };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw ApiError.unauthorized("Invalid super admin credentials");
    }
  }

  /**
   * Get Super Admin Profile
   */
  static async getAdminProfile(uid: string): Promise<AdminUser> {
    if (isFirebaseInitialized && firebaseAuth) {
      try {
        const user = await firebaseAuth.getUser(uid);
        return {
          id: user.uid,
          email: user.email || env.SUPER_ADMIN_EMAIL,
          phoneNumber: user.phoneNumber || env.SUPER_ADMIN_PHONE_NUMBER,
          name: user.displayName || env.SUPER_ADMIN_NAME,
          role:
            (user.customClaims?.role as "super_admin" | "admin") ||
            "super_admin",
          createdAt: user.metadata.creationTime,
          updatedAt: new Date().toISOString(),
        };
      } catch {
        // Fallback
      }
    }

    return {
      id: uid,
      email: env.SUPER_ADMIN_EMAIL,
      name: env.SUPER_ADMIN_NAME,
      phoneNumber: env.SUPER_ADMIN_PHONE_NUMBER,
      role: "super_admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregated platform overview stats across Clients, Inquiries, and Reviews
   */
  static async getOverviewStats() {
    // 1. Clients
    const clientsSnap = await firestore.collection("clients").get();
    const clients = clientsSnap.docs.map((doc) => doc.data() as any);

    const clientStats = {
      total: clients.length,
      active: 0,
      inactive: 0,
      trial: 0,
      expired: 0,
      cancelled: 0,
    };

    for (const c of clients) {
      if (c.isActive) clientStats.active++;
      else clientStats.inactive++;

      const subStatus = c.subscription?.status;
      if (subStatus === "trial") clientStats.trial++;
      else if (subStatus === "expired") clientStats.expired++;
      else if (subStatus === "cancelled") clientStats.cancelled++;
    }

    // Sort clients newest first
    clients.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const recentClients = clients.slice(0, 6);

    // 2. Inquiries
    const inquiriesSnap = await firestore.collection("inquiries").get();
    const inquiries = inquiriesSnap.docs.map((doc) => doc.data() as any);

    const inquiryStats = {
      total: inquiries.length,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };

    for (const inq of inquiries) {
      if (inq.status === "pending") inquiryStats.pending++;
      else if (inq.status === "in_progress") inquiryStats.in_progress++;
      else if (inq.status === "resolved") inquiryStats.resolved++;
      else if (inq.status === "closed") inquiryStats.closed++;
    }

    inquiries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const recentInquiries = inquiries.slice(0, 6);

    // 3. Reviews
    const reviewsSnap = await firestore.collection("reviews").get();
    const reviews = reviewsSnap.docs.map((doc) => doc.data() as any);

    const sumRatings = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const averageRating =
      reviews.length > 0
        ? parseFloat((sumRatings / reviews.length).toFixed(1))
        : 5.0;
    const fiveStarCount = reviews.filter((r) => r.rating >= 5).length;

    reviews.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const recentReviews = reviews.slice(0, 6);

    return {
      clients: clientStats,
      inquiries: inquiryStats,
      reviews: {
        total: reviews.length,
        averageRating,
        fiveStarCount,
      },
      recentClients,
      recentInquiries,
      recentReviews,
    };
  }
}
