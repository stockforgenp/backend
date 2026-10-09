import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { firebaseAuth, isFirebaseInitialized } from "../config/firebase";

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
 * Middleware to authenticate Firebase ID token
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

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(ApiError.unauthorized("Authentication token is missing"));
  }

  if (!isFirebaseInitialized || !firebaseAuth) {
    return next(
      ApiError.internal("Firebase authentication is not initialized on the server"),
    );
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
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
    if (fbError.code === "auth/id-token-expired") {
      return next(
        ApiError.unauthorized("Session has expired. Please log in again."),
      );
    }
    if (fbError.code === "auth/id-token-revoked") {
      return next(
        ApiError.unauthorized("Session token has been revoked. Please log in again."),
      );
    }
    return next(
      ApiError.unauthorized(
        `Invalid Firebase ID token: ${fbError.message || "Verification failed"}`,
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

  const token = authHeader.split(" ")[1];
  if (!token) return next();

  if (!isFirebaseInitialized || !firebaseAuth) {
    return next();
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
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
  } catch {
    // Optional auth silently ignores invalid tokens
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
