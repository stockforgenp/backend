import dotenv from "dotenv";
import path from "path";

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function sanitizePrivateKey(key: string | undefined): string {
  if (!key) return "";
  let formatted = key.trim();
  // Strip surrounding quotes if present
  if (
    (formatted.startsWith('"') && formatted.endsWith('"')) ||
    (formatted.startsWith("'") && formatted.endsWith("'"))
  ) {
    formatted = formatted.slice(1, -1);
  }
  return formatted.replace(/\\n/g, "\n");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  CLIENT_CORS_ORIGIN: process.env.CLIENT_CORS_ORIGIN || "*",

  // Firebase Credentials
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID?.trim() || "",
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL?.trim() || "",
  FIREBASE_PRIVATE_KEY: sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY?.trim() || "",

  DEFAULT_TRIAL_DAYS: parseInt(process.env.DEFAULT_TRIAL_DAYS || "14", 10),
};
