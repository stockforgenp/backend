import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: any = undefined;

  // Handle ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }
  // Handle Firebase Auth error codes
  else if (
    err.code &&
    typeof err.code === "string" &&
    err.code.startsWith("auth/")
  ) {
    switch (err.code) {
      case "auth/email-already-exists":
        statusCode = 409;
        message = "The provided email is already registered";
        break;
      case "auth/user-not-found":
        statusCode = 404;
        message = "User account not found";
        break;
      case "auth/wrong-password":
      case "auth/invalid-credential":
        statusCode = 401;
        message = "Invalid email or password";
        break;
      case "auth/id-token-expired":
        statusCode = 401;
        message = "Authentication token has expired";
        break;
      case "auth/invalid-id-token":
        statusCode = 401;
        message = "Invalid authentication token";
        break;
      case "auth/phone-number-already-exists":
        statusCode = 409;
        message = "Phone number is already in use";
        break;
      case "auth/weak-password":
        statusCode = 400;
        message = "Password is too weak";
        break;
      default:
        statusCode = 400;
        message = err.message || "Firebase Authentication error";
    }
  }
  // Handle JSON Syntax Error in request body
  else if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as any).status === 400
  ) {
    statusCode = 400;
    message = "Invalid JSON in request body";
  }
  // Generic error
  else if (err.message) {
    message = err.message;
    if (typeof err.statusCode === "number") {
      statusCode = err.statusCode;
    }
  }

  // Log error in non-test environments
  if (env.NODE_ENV !== "test") {
    if (statusCode >= 500) {
      console.error("🔥 Server Error [500]:", err);
    } else {
      console.warn(`⚠️ Client Error [${statusCode}]:`, message);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors !== undefined && { errors }),
    ...(env.NODE_ENV === "development" && err.stack
      ? { stack: err.stack }
      : {}),
  });
}
