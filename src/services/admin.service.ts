import { env } from "../config/env";
import {
  firebaseAuth,
  firestore,
  isFirebaseInitialized,
} from "../config/firebase";
import { AdminAuthResponse, AdminUser } from "../types";
import { ApiError } from "../utils/apiError";
import { signAuthToken } from "../utils/token.util";

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
   * Super Admin Login - Returns authentic Firebase ID Token
   */
  static async login(input: {
    email: string;
    password: string;
  }): Promise<AdminAuthResponse> {
    if (!isFirebaseInitialized || !firebaseAuth) {
      throw ApiError.internal(
        "Firebase authentication is not configured on the server",
      );
    }

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
      if (!user) {
        throw ApiError.unauthorized("Firebase user does not exist");
      }

      const role =
        user.customClaims?.role || (user.customClaims?.admin ? "admin" : null);
      const isRoleAdmin =
        role === "super_admin" ||
        role === "admin" ||
        user.customClaims?.admin === true;

      if (!isRoleAdmin) {
        throw ApiError.forbidden("Access restricted to administrators");
      }

      const adminUser: AdminUser = {
        id: user.uid,
        email: user.email || input.email,
        name: user.displayName || "Super Admin",
        phoneNumber: user.phoneNumber || "",
        role: role === "super_admin" ? "super_admin" : "admin",
        createdAt: user.metadata.creationTime,
        updatedAt: user.metadata.lastSignInTime || user.metadata.creationTime,
      };

      // Sign permanent authentication token without expiry date
      const permanentToken = signAuthToken({
        uid: user.uid,
        email: user.email || input.email,
        name: user.displayName || "Super Admin",
        role: role === "super_admin" ? "super_admin" : "admin",
        isAdmin: true,
        admin: true,
      });

      return {
        token: permanentToken,
        tokenType: "Bearer",
        admin: adminUser,
      };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw ApiError.unauthorized("Invalid super admin credentials");
    }
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
      const cStatus = c.status || "active";
      if (cStatus === "active") clientStats.active++;
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
