import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { firebaseAuth, isFirebaseInitialized } from "../config/firebase";
import { verifyAuthToken, isTokenRevoked } from "../utils/token.util";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: "super_admin" | "admin" | "client" | string;
  isAdmin?: boolean;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to authenticate JWT authentication tokens (server permanent token or Firebase ID token)
 * Tokens do not expire over time unless explicitly revoked upon user logout.
 */
export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      ApiError.unauthorized(
        "Authentication token missing or invalid format (Bearer token expected)",
      ),
    );
  }

  const token = authHeader.split(" ")[1]?.trim();
  if (!token) {
    return next(ApiError.unauthorized("Authentication token is missing"));
  }

  // 1. Check if token was revoked (user logged out)
  if (await isTokenRevoked(token)) {
    return next(
      ApiError.unauthorized(
        "Session token has been revoked. Please log in again.",
      ),
    );
  }

  // 2. Verify server-issued permanent token (no expiry date)
  const serverPayload = verifyAuthToken(token);
  if (serverPayload) {
    if (await isTokenRevoked(token, serverPayload.uid, serverPayload.iat)) {
      return next(
        ApiError.unauthorized(
          "Session token has been revoked. Please log in again.",
        ),
      );
    }

    const role =
      serverPayload.role ||
      (serverPayload.isAdmin || serverPayload.admin
        ? "super_admin"
        : "client");

    req.user = {
      ...serverPayload,
      uid: serverPayload.uid,
      email: serverPayload.email,
      role,
      isAdmin: role === "super_admin" || role === "admin",
    };
    return next();
  }

  // 3. Fallback to Firebase ID Token
  if (!isFirebaseInitialized || !firebaseAuth) {
    return next(
      ApiError.internal(
        "Firebase authentication is not initialized on the server",
      ),
    );
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    if (await isTokenRevoked(token, decodedToken.uid, decodedToken.iat)) {
      return next(
        ApiError.unauthorized(
          "Session token has been revoked. Please log in again.",
        ),
      );
    }

    const role =
      decodedToken.role ||
      (decodedToken.admin || decodedToken.isAdmin
        ? "super_admin"
        : "client");

    req.user = {
      ...decodedToken,
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      isAdmin: role === "super_admin" || role === "admin",
    };
    return next();
  } catch (fbError: any) {
    // If Firebase ID token is expired according to Firebase's default 1-hour window,
    // honor user requirement that tokens do NOT expire unless explicitly logged out.
    if (fbError.code === "auth/id-token-expired") {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8"),
          );
          const uid = payload.user_id || payload.sub || payload.uid;
          if (uid) {
            if (await isTokenRevoked(token, uid, payload.iat)) {
              return next(
                ApiError.unauthorized(
                  "Session token has been revoked. Please log in again.",
                ),
              );
            }
            const fbUser = await firebaseAuth.getUser(uid);
            if (fbUser && !fbUser.disabled) {
              const role =
                fbUser.customClaims?.role ||
                (fbUser.customClaims?.admin
                  ? "super_admin"
                  : payload.role || "client");
              req.user = {
                ...payload,
                uid: fbUser.uid,
                email: fbUser.email,
                role,
                isAdmin: role === "super_admin" || role === "admin",
              };
              return next();
            }
          }
        }
      } catch {
        // Fall through to unauthorized
      }

      return next(
        ApiError.unauthorized("Session has expired. Please log in again."),
      );
    }

    if (fbError.code === "auth/id-token-revoked") {
      return next(
        ApiError.unauthorized(
          "Session token has been revoked. Please log in again.",
        ),
      );
    }

    return next(
      ApiError.unauthorized(
        `Invalid Authentication token: ${fbError.message || "Verification failed"}`,
      ),
    );
  }
}

/**
 * Optional authentication middleware: attaches user if token is valid, doesn't error if missing
 */
export async function optionalAuthenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1]?.trim();
  if (!token) return next();

  if (await isTokenRevoked(token)) {
    return next();
  }

  // 1. Check server-issued permanent token
  const serverPayload = verifyAuthToken(token);
  if (serverPayload) {
    if (await isTokenRevoked(token, serverPayload.uid, serverPayload.iat)) {
      return next();
    }
    const role =
      serverPayload.role ||
      (serverPayload.isAdmin || serverPayload.admin
        ? "super_admin"
        : "client");

    req.user = {
      ...serverPayload,
      uid: serverPayload.uid,
      email: serverPayload.email,
      role,
      isAdmin: role === "super_admin" || role === "admin",
    };
    return next();
  }

  // 2. Check Firebase ID Token
  if (!isFirebaseInitialized || !firebaseAuth) {
    return next();
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    if (await isTokenRevoked(token, decoded.uid, decoded.iat)) {
      return next();
    }

    const role =
      decoded.role ||
      (decoded.admin || decoded.isAdmin ? "super_admin" : "client");

    req.user = {
      ...decoded,
      uid: decoded.uid,
      email: decoded.email,
      role,
      isAdmin: role === "super_admin" || role === "admin",
    };
  } catch (err: any) {
    if (err?.code === "auth/id-token-expired") {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8"),
          );
          const uid = payload.user_id || payload.sub || payload.uid;
          if (uid && !(await isTokenRevoked(token, uid, payload.iat))) {
            const fbUser = await firebaseAuth.getUser(uid);
            if (fbUser && !fbUser.disabled) {
              const role =
                fbUser.customClaims?.role ||
                (fbUser.customClaims?.admin
                  ? "super_admin"
                  : payload.role || "client");
              req.user = {
                ...payload,
                uid: fbUser.uid,
                email: fbUser.email,
                role,
                isAdmin: role === "super_admin" || role === "admin",
              };
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }
  next();
}

/**
 * Middleware to restrict access to specific roles
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }
    const userRole = req.user.role || "";
    if (!roles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access denied. Requires one of the following roles: [${roles.join(", ")}]. Current role: '${userRole}'`,
        ),
      );
    }
    next();
  };
}

/**
 * Strict Super Admin check
 */
export const requireSuperAdmin = requireRole("super_admin");

/**
 * Admin check (Super Admin or Admin)
 */
export const requireAdmin = requireRole("super_admin", "admin");

/**
 * Allows access if user is Super Admin OR if the targeted resource belongs to the current user
 * @param paramKey The req.params key representing client/user id (default 'id')
 */
export function requireSelfOrSuperAdmin(paramKey: string = "id") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    const isSuperAdmin =
      req.user.role === "super_admin" || req.user.role === "admin";
    const resourceOwnerId = req.params[paramKey];
    const isSelf = resourceOwnerId && req.user.uid === resourceOwnerId;

    if (isSuperAdmin || isSelf) {
      return next();
    }

    return next(
      ApiError.forbidden(
        "Access denied: You do not have permission to access or modify this resource",
      ),
    );
  };
}
