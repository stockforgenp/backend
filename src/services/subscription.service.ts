import crypto from "crypto";
import {
  ExtendSubscriptionInput,
  ClientSubscription,
  SubscriptionHistoryRecord,
} from "../types";
import {
  firebaseAuth,
  firestore,
} from "../config/firebase";
import {
  calculateNewExpiryDate,
  getRemainingDays,
  isDateExpired,
} from "../utils/dateUtils";
import {
  ClientService,
  FIRESTORE_COLLECTION,
  SUBSCRIPTION_HISTORY_COLLECTION,
} from "./client.service";

export class SubscriptionService {
  /**
   * Extend client subscription and record transaction in separate collection
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
      clientId: client.id,
      type: "extension",
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
      createdAt: now,
    };

    // 1. Save history record in separate subscription_history collection
    await firestore
      .collection(SUBSCRIPTION_HISTORY_COLLECTION)
      .doc(historyRecord.id)
      .set(ClientService.cleanObject(historyRecord));

    // 2. Update active subscription on client document
    const updatedSubscription: ClientSubscription = {
      plan: targetPlan,
      status: "active",
      startDate: currentSub.startDate,
      durationDays: currentSub.durationDays + input.durationDays,
      expiryDate: newExpiryDate,
      autoRenew: currentSub.autoRenew || false,
    };

    const updatedClient = {
      ...client,
      subscription: updatedSubscription,
      updatedAt: now,
    };

    await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
      subscription: updatedSubscription,
      updatedAt: now,
    });

    // 3. Sync custom claims if plan was updated
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
    totalExtensions: number;
  }> {
    const client = await ClientService.getClientById(clientId);
    const sub = client.subscription;

    // Fetch total history records count from separate subscription_history collection
    const historySnap = await firestore
      .collection(SUBSCRIPTION_HISTORY_COLLECTION)
      .where("clientId", "==", clientId)
      .get();

    return {
      clientId: client.id,
      status: sub.status,
      plan: sub.plan,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      daysRemaining: getRemainingDays(sub.expiryDate),
      isExpired: isDateExpired(sub.expiryDate),
      totalExtensions: historySnap.size,
    };
  }

  /**
   * Get subscription payment and extension history from separate collection
   */
  static async getSubscriptionHistory(
    clientId: string,
  ): Promise<SubscriptionHistoryRecord[]> {
    // Ensure client exists first
    await ClientService.getClientById(clientId);

    const snapshot = await firestore
      .collection(SUBSCRIPTION_HISTORY_COLLECTION)
      .where("clientId", "==", clientId)
      .get();

    const historyList = snapshot.docs.map(
      (doc) => doc.data() as SubscriptionHistoryRecord,
    );

    // Sort newest first
    historyList.sort(
      (a, b) =>
        new Date(b.extendedAt).getTime() - new Date(a.extendedAt).getTime(),
    );

    return historyList;
  }

  /**
   * Cancel client subscription and record event in separate collection
   */
  static async cancelSubscription(
    clientId: string,
    reason?: string,
  ): Promise<ClientSubscription> {
    const client = await ClientService.getClientById(clientId);
    const now = new Date().toISOString();

    const cancellationRecord: SubscriptionHistoryRecord = {
      id: `sub_cancel_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      clientId: client.id,
      type: "cancellation",
      extendedAt: now,
      durationDays: 0,
      previousExpiryDate: client.subscription.expiryDate,
      newExpiryDate: client.subscription.expiryDate,
      plan: client.subscription.plan,
      notes: reason
        ? `Subscription cancelled: ${reason}`
        : "Subscription cancelled by administrator",
      extendedBy: "admin",
      createdAt: now,
    };

    // 1. Save cancellation entry in separate subscription_history collection
    await firestore
      .collection(SUBSCRIPTION_HISTORY_COLLECTION)
      .doc(cancellationRecord.id)
      .set(ClientService.cleanObject(cancellationRecord));

    // 2. Update subscription status on client document
    const updatedSubscription: ClientSubscription = {
      ...client.subscription,
      status: "cancelled",
      autoRenew: false,
    };

    await firestore.collection(FIRESTORE_COLLECTION).doc(client.id).update({
      "subscription.status": "cancelled",
      "subscription.autoRenew": false,
      updatedAt: now,
    });

    return updatedSubscription;
  }
}
