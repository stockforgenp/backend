import * as admin from "firebase-admin";
import { env } from "./env";

let isFirebaseInitialized = false;
let isMockMode = false;

function initFirebase(): { adminApp: admin.app.App | null; mock: boolean } {
  try {
    // 1. Check if already initialized
    if (admin.apps.length > 0) {
      isFirebaseInitialized = true;
      return { adminApp: admin.apps[0]!, mock: false };
    }

    // 2. Initialize using explicit Firebase credentials
    if (
      env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY
    ) {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
      });
      isFirebaseInitialized = true;
      console.log(
        "✅ Firebase Admin initialized with FIREBASE_PROJECT_ID:",
        env.FIREBASE_PROJECT_ID,
      );
      return { adminApp: app, mock: false };
    }

    // 3. Fallback for local development/testing without keys
    console.warn(
      "⚠️ No Firebase credentials detected (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).",
    );
    console.warn(
      "⚠️ Running in Simulated/Local-Memory Firebase Mode. To use live Firebase, set the keys in your .env file.",
    );
    isMockMode = true;
    return { adminApp: null, mock: true };
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    console.warn("⚠️ Falling back to Simulated/Local-Memory Mode.");
    isMockMode = true;
    return { adminApp: null, mock: true };
  }
}

const { adminApp, mock } = initFirebase();

export { admin, adminApp, isFirebaseInitialized, isMockMode };

export const firebaseAuth =
  isFirebaseInitialized && adminApp ? admin.auth(adminApp) : null;
export const firestore =
  isFirebaseInitialized && adminApp ? admin.firestore(adminApp) : null;

if (firestore) {
  firestore.settings({ ignoreUndefinedProperties: true });
}
