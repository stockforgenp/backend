import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { firebaseAuth, isFirebaseInitialized } from "../config/firebase";
import { env } from "../config/env";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

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

  try {
    // 1. If Firebase Admin is available, try verifying Firebase ID token
    if (isFirebaseInitialized && firebaseAuth) {
      try {
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        req.user = {
          ...decodedToken,
          uid: decodedToken.uid,
          email: decodedToken.email,
          role: decodedToken.role || "client",
        };
        return next();
      } catch (fbError: any) {
        // If it was specifically a Firebase format error, try fallback JWT
        if (fbError.code === "auth/id-token-expired") {
          return next(
            ApiError.unauthorized("Session has expired. Please log in again."),
          );
        }
      }
    }

    // 2. Fallback to JWT verification (useful for local development, API tokens, or direct JWT sessions)
    try {
      const decodedJwt = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
      req.user = decodedJwt;
      return next();
    } catch (jwtError: any) {
      if (jwtError.name === "TokenExpiredError") {
        return next(
          ApiError.unauthorized("Token expired. Please log in again."),
        );
      }
      return next(ApiError.unauthorized("Invalid authentication token"));
    }
  } catch (error) {
    return next(error);
  }
}

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

  try {
    if (isFirebaseInitialized && firebaseAuth) {
      try {
        const decoded = await firebaseAuth.verifyIdToken(token);
        req.user = {
          ...decoded,
          uid: decoded.uid,
          email: decoded.email,
          role: decoded.role || "client",
        };
        return next();
      } catch {
        // Continue to JWT check
      }
    }

    const decodedJwt = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = decodedJwt;
  } catch {
    // Optional auth silently ignores invalid tokens
  }
  next();
}
