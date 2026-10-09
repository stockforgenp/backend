import * as admin from "firebase-admin";
import { env } from "./env";

let isFirebaseInitialized = false;

function initFirebase(): admin.app.App {
  // 1. Check if already initialized
  if (admin.apps.length > 0) {
    isFirebaseInitialized = true;
    return admin.apps[0]!;
  }

  // 2. Initialize using explicit Firebase credentials
  if (
    !env.FIREBASE_PROJECT_ID ||
    !env.FIREBASE_CLIENT_EMAIL ||
    !env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing mandatory Firebase credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be provided in .env",
    );
  }

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
  return app;
}

const adminApp = initFirebase();

export { admin, adminApp, isFirebaseInitialized };

export const firebaseAuth = admin.auth(adminApp);
export const firestore = admin.firestore(adminApp);

firestore.settings({ ignoreUndefinedProperties: true });
