import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { env } from './env';

let isFirebaseInitialized = false;
let isMockMode = false;

function initFirebase(): { adminApp: admin.app.App | null; mock: boolean } {
  try {
    // 1. Check if already initialized
    if (admin.apps.length > 0) {
      isFirebaseInitialized = true;
      return { adminApp: admin.apps[0]!, mock: false };
    }

    // 2. Check for Service Account File Path
    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const resolvedPath = path.isAbsolute(env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);

      if (fs.existsSync(resolvedPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        isFirebaseInitialized = true;
        console.log('✅ Firebase Admin initialized using Service Account File:', resolvedPath);
        return { adminApp: app, mock: false };
      } else {
        console.warn(`⚠️ Firebase service account file not found at: ${resolvedPath}`);
      }
    }

    // 3. Check for inline credentials in env vars
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
      });
      isFirebaseInitialized = true;
      console.log('✅ Firebase Admin initialized using Environment Variables for project:', env.FIREBASE_PROJECT_ID);
      return { adminApp: app, mock: false };
    }

    // 4. Check for Google Application Default Credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      isFirebaseInitialized = true;
      console.log('✅ Firebase Admin initialized using Application Default Credentials');
      return { adminApp: app, mock: false };
    }

    // 5. Fallback for development/testing without credentials
    console.warn('⚠️ No Firebase credentials detected.');
    console.warn('⚠️ Running in Simulated/Local-Memory Firebase Mode. To use live Firebase, set credentials in .env or provide serviceAccountKey.json.');
    isMockMode = true;
    return { adminApp: null, mock: true };
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    console.warn('⚠️ Falling back to Simulated/Local-Memory Mode.');
    isMockMode = true;
    return { adminApp: null, mock: true };
  }
}

const { adminApp, mock } = initFirebase();

export { admin, adminApp, isFirebaseInitialized, isMockMode };

export const firebaseAuth = isFirebaseInitialized && adminApp ? admin.auth(adminApp) : null;
export const firestore = isFirebaseInitialized && adminApp ? admin.firestore(adminApp) : null;
