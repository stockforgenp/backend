import crypto from "crypto";
import {
  ExtendSubscriptionInput,
  ClientSubscription,
  SubscriptionHistoryRecord,
} from "../types";
import {
  firebaseAuth,
  firestore,
  isFirebaseInitialized,
} from "../config/firebase";
import {
  calculateNewExpiryDate,
  getRemainingDays,
  isDateExpired,
} from "../utils/dateUtils";
import { ClientService } from "./client.service";
import { mockStorage } from "./mockStorage.service";

const FIRESTORE_COLLECTION = "clients";

export class SubscriptionService {
  /**
   * Extend client subscription
   */
  static async extendSubscription(input: ExtendSubscriptionInput): Promise<{
    client: any;
    extensionDetails: SubscriptionHistoryRecord;
    daysRemaining: number;
  }> {
    const client = await ClientService.getClientById(input.clientId);
    const currentSub = client.subscription;

    // Calculate new expiry date based on whether it was active or expired
    const { newExpiryDate, previousExpiryDate } = calculateNewExpiryDate(
      currentSub.expiryDate,
      input.durationDays,
    );

    const targetPlan = input.plan || currentSub.plan;
    const now = new Date().toISOString();

    const historyRecord: SubscriptionHistoryRecord = {
      id: `sub_ext_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      extendedAt: now,
      durationDays: input.durationDays,
      previousExpiryDate,
      newExpiryDate,
      plan: targetPlan,
      amountPaid: input.amountPaid,
      currency: input.currency || "USD",
      paymentReference: input.paymentReference,
      notes:
        input.notes || `Extended subscription by ${input.durationDays} days`,
      extendedBy: "admin",
    };

    const updatedSubscription: ClientSubscription = {
      ...currentSub,
      plan: targetPlan,
      status: "active",
      expiryDate: newExpiryDate,
      durationDays: currentSub.durationDays + input.durationDays,
      history: [...(currentSub.history || []), historyRecord],
    };

    const updatedClient = {
      ...client,
      subscription: updatedSubscription,
      updatedAt: now,
    };

    // Save to Firestore or Mock
    if (isFirebaseInitialized && firestore) {
      try {
        await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
          subscription: updatedSubscription,
          updatedAt: now,
        });
      } catch (dbErr: any) {
        if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
          await mockStorage.updateClient(client.id, updatedClient);
        } else {
          throw dbErr;
        }
      }

      // Sync custom claims if plan was updated
      if (firebaseAuth && input.plan && input.plan !== currentSub.plan) {
        try {
          await firebaseAuth.setCustomUserClaims(client.id, {
            role: "client",
            plan: targetPlan,
          });
        } catch (claimsErr) {
          console.warn(
            "Failed to update custom claims on Firebase Auth:",
            claimsErr,
          );
        }
      }
    } else {
      await mockStorage.updateClient(client.id, updatedClient);
    }

    return {
      client: updatedClient,
      extensionDetails: historyRecord,
      daysRemaining: getRemainingDays(newExpiryDate),
    };
  }

  /**
   * Get subscription status for a specific client
   */
  static async getSubscriptionStatus(clientId: string): Promise<{
    clientId: string;
    status: string;
    plan: string;
    startDate: string;
    expiryDate: string;
    daysRemaining: number;
    isExpired: boolean;
    autoRenew?: boolean;
    totalExtensions: number;
  }> {
    const client = await ClientService.getClientById(clientId);
    const sub = client.subscription;
    const expired = isDateExpired(sub.expiryDate);

    return {
      clientId: client.id,
      status: sub.status,
      plan: sub.plan,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      daysRemaining: getRemainingDays(sub.expiryDate),
      isExpired: expired,
      autoRenew: sub.autoRenew,
      totalExtensions: (sub.history || []).length,
    };
  }

  /**
   * Retrieve subscription history records
   */
  static async getSubscriptionHistory(
    clientId: string,
  ): Promise<SubscriptionHistoryRecord[]> {
    const client = await ClientService.getClientById(clientId);
    return client.subscription.history || [];
  }

  /**
   * Cancel client subscription
   */
  static async cancelSubscription(
    clientId: string,
    reason?: string,
  ): Promise<ClientSubscription> {
    const client = await ClientService.getClientById(clientId);
    const now = new Date().toISOString();

    const cancellationRecord: SubscriptionHistoryRecord = {
      id: `sub_cnc_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      extendedAt: now,
      durationDays: 0,
      previousExpiryDate: client.subscription.expiryDate,
      newExpiryDate: client.subscription.expiryDate,
      plan: client.subscription.plan,
      notes: reason
        ? `Subscription cancelled: ${reason}`
        : "Subscription cancelled by administrator",
      extendedBy: "admin",
    };

    const updatedSubscription: ClientSubscription = {
      ...client.subscription,
      status: "cancelled",
      autoRenew: false,
      history: [...(client.subscription.history || []), cancellationRecord],
    };

    if (isFirebaseInitialized && firestore) {
      try {
        await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
          "subscription.status": "cancelled",
          "subscription.autoRenew": false,
          "subscription.history": updatedSubscription.history,
          updatedAt: now,
        });
      } catch (dbErr: any) {
        if (dbErr.code === 7 || dbErr.details?.includes('Cloud Firestore API')) {
          await mockStorage.updateClient(client.id, {
            subscription: updatedSubscription,
            updatedAt: now,
          });
        } else {
          throw dbErr;
        }
      }
    } else {
      await mockStorage.updateClient(client.id, {
        subscription: updatedSubscription,
        updatedAt: now,
      });
    }

    return updatedSubscription;
  }
}
