export type SubscriptionStatus =
  | "active"
  | "expired"
  | "trial"
  | "grace_period"
  | "cancelled";

export type SubscriptionPlan =
  | "trial"
  | "starter"
  | "pro"
  | "enterprise"
  | string;

export interface SubscriptionHistoryRecord {
  id: string;
  extendedAt: string; // ISO string
  durationDays: number;
  previousExpiryDate: string; // ISO string
  newExpiryDate: string; // ISO string
  plan: SubscriptionPlan;
  amountPaid?: number;
  currency?: string;
  paymentReference?: string;
  notes?: string;
  extendedBy?: string; // admin or client
}

export interface ClientSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string; // ISO string
  durationDays: number;
  expiryDate: string; // ISO string
  autoRenew?: boolean;
  history: SubscriptionHistoryRecord[];
}

export interface ClientDocument {
  id: string; // Firebase Auth UID
  email: string;
  name: string;
  phone?: string;
  shopName?: string;
  shopType?: string;
  address?: string;
  currencySymbol?: string;
  isActive: boolean;
  subscription: ClientSubscription;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface RegisterClientInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  shopName?: string;
  shopType?: string;
  address?: string;
  currencySymbol?: string;
  plan?: SubscriptionPlan;
  trialDays?: number;
}

export interface LoginClientInput {
  email: string;
  password: string;
}

export interface ExtendSubscriptionInput {
  clientId: string;
  durationDays: number;
  plan?: SubscriptionPlan;
  amountPaid?: number;
  currency?: string;
  paymentReference?: string;
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  phone?: string;
  shopName?: string;
  shopType?: string;
  address?: string;
  currencySymbol?: string;
  isActive?: boolean;
}

export interface ClientAuthResponse {
  token: string;
  tokenType: "Bearer";
  client: Omit<ClientDocument, "password">;
  subscriptionStatus: {
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    expiryDate: string;
    daysRemaining: number;
    isExpired: boolean;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: 'super_admin' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuthResponse {
  token: string;
  tokenType: 'Bearer';
  admin: AdminUser;
}
