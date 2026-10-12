import crypto from "crypto";
import { env } from "../config/env";
import { firestore } from "../config/firebase";

// In-memory set of revoked token hashes for instant sub-millisecond lookup
const inMemoryRevokedTokens = new Set<string>();

const TOKEN_SECRET =
  (env.FIREBASE_PRIVATE_KEY && env.FIREBASE_PRIVATE_KEY.length > 20
    ? env.FIREBASE_PRIVATE_KEY
    : env.FIREBASE_PROJECT_ID) ||
  "stockforge_permanent_auth_token_secret_key_2026";

export interface TokenPayload {
  uid: string;
  email?: string;
  name?: string;
  role: string;
  isAdmin?: boolean;
  businessName?: string;
  plan?: string;
  [key: string]: any;
}

function getTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Sign an authentication token with NO expiry date (valid indefinitely until user logs out).
 */
export function signAuthToken(payload: TokenPayload): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");

  const nowSec = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  // Intentionally NO 'exp' claim is added. The token has NO expiry date.
  const claims = {
    ...payload,
    jti,
    iat: nowSec,
  };

  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

/**
 * Verify a server-issued token. Returns payload if valid, null if invalid.
 * Does not check expiration as tokens have no expiry date by design.
 */
export function verifyAuthToken(token: string): any | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const FIRESTORE_REVOKED_COLLECTION = "revoked_tokens";

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 1500,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Revoke an authentication token upon explicit user logout.
 */
export async function revokeToken(
  token: string,
  userId?: string,
): Promise<void> {
  const tokenHash = getTokenHash(token);
  inMemoryRevokedTokens.add(tokenHash);

  try {
    if (firestore) {
      const persistAction = async () => {
        try {
          await firestore
            .collection(FIRESTORE_REVOKED_COLLECTION)
            .doc(tokenHash)
            .set({
              tokenHash,
              userId: userId || null,
              revokedAt: new Date().toISOString(),
            });

          // If user ID is provided, also record lastLogoutAt on client document
          if (userId) {
            await firestore
              .collection("clients")
              .doc(userId)
              .update({
                lastLogoutAt: new Date().toISOString(),
              })
              .catch(() => {});
          }
        } catch (err) {
          console.warn("Failed to persist revoked token to Firestore:", err);
        }
      };

      await withTimeout(persistAction(), 1500).catch(() => {});
    }
  } catch (err) {
    console.warn("Failed to persist revoked token to Firestore:", err);
  }
}

/**
 * Check if a token has been revoked / logged out.
 */
export async function isTokenRevoked(
  token: string,
  userId?: string,
  iat?: number,
): Promise<boolean> {
  const tokenHash = getTokenHash(token);
  if (inMemoryRevokedTokens.has(tokenHash)) {
    return true;
  }

  try {
    if (firestore) {
      const snap = await withTimeout(
        firestore.collection(FIRESTORE_REVOKED_COLLECTION).doc(tokenHash).get(),
        1500,
      );

      if (snap && snap.exists) {
        inMemoryRevokedTokens.add(tokenHash);
        return true;
      }

      // Check if user has logged out after token was issued
      if (userId && iat) {
        const clientSnap = await withTimeout(
          firestore.collection("clients").doc(userId).get(),
          1500,
        );
        if (clientSnap && clientSnap.exists) {
          const clientData = clientSnap.data();
          if (clientData?.lastLogoutAt) {
            const logoutSec = Math.floor(
              new Date(clientData.lastLogoutAt).getTime() / 1000,
            );
            if (iat < logoutSec) {
              inMemoryRevokedTokens.add(tokenHash);
              return true;
            }
          }
        }
      }
    }
  } catch {
    // If Firestore is unavailable, trust in-memory
  }

  return false;
}
