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
  clientId: string;
  extendedAt: string; // ISO string
  durationDays: number;
  previousExpiryDate: string; // ISO string
  newExpiryDate: string; // ISO string
  plan: SubscriptionPlan;
  amountPaid?: number;
  currency?: string;
  paymentReference?: string;
  notes?: string;
  extendedBy?: string; // admin, system, or client
  type?:
    | "trial_creation"
    | "extension"
    | "plan_change"
    | "cancellation"
    | string;
  createdAt?: string;
}

export interface ClientSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string; // ISO string
  durationDays: number;
  expiryDate: string; // ISO string
  autoRenew?: boolean;
  history?: SubscriptionHistoryRecord[];
}

export type ClientAccountStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "banned";

export interface ClientDocument {
  id: string; // Firebase Auth UID
  email: string;
  name: string;
  phone?: string;
  shopName?: string;
  shopType?: string;
  address?: string;
  currencySymbol?: string;
  status: ClientAccountStatus;
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
  status?: ClientAccountStatus;
  plan?: SubscriptionPlan;
  trialDays?: number;
  durationDays?: number;
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
  password?: string;
  shopName?: string;
  shopType?: string;
  address?: string;
  currencySymbol?: string;
  status?: ClientAccountStatus;
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

export interface RegisterClientResponse {
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
  role: "super_admin" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuthResponse {
  token: string;
  tokenType: "Bearer";
  admin: AdminUser;
}

export type InquiryStatus = "pending" | "in_progress" | "resolved" | "closed";
export type InquiryType =
  | "sales"
  | "support"
  | "demo"
  | "billing"
  | "partnership"
  | "general"
  | "on_site_demo"
  | "vat_compliance"
  | "hardware_pairing"
  | "multi_unit_help"
  | "wholesale_deployment"
  | "general_support"
  | string;

export interface InquiryDocument {
  id: string;
  name: string;
  email: string;
  phone?: string;
  shopName?: string;
  storeType?: string;
  type: InquiryType;
  subject: string;
  message: string;
  status: InquiryStatus;
  clientId?: string;
  source?: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInquiryInput {
  name: string;
  email: string;
  phone?: string;
  shopName?: string;
  storeType?: string;
  type?: InquiryType;
  subject: string;
  message: string;
  source?: string;
  clientId?: string;
}

export interface UpdateInquiryInput {
  status?: InquiryStatus;
  adminNotes?: string;
}

export interface ListInquiriesFilter {
  status?: InquiryStatus;
  type?: InquiryType;
  search?: string;
  clientId?: string;
  page?: number;
  limit?: number;
}

export interface ReviewDocument {
  id: string;
  clientName: string;
  shopName?: string;
  location?: string;
  rating: number; // 1 to 5
  reviewText: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewInput {
  clientName: string;
  shopName?: string;
  location?: string;
  rating: number;
  reviewText: string;
  clientId?: string;
}

export interface UpdateReviewInput {
  clientName?: string;
  shopName?: string;
  location?: string;
  rating?: number;
  reviewText?: string;
}

export interface AdminStatsResponse {
  clients: {
    total: number;
    active: number;
    inactive: number;
    trial: number;
    expired: number;
    cancelled: number;
  };
  inquiries: {
    total: number;
    pending: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  reviews: {
    total: number;
    averageRating: number;
    fiveStarCount: number;
  };
  recentClients: ClientDocument[];
  recentInquiries: InquiryDocument[];
  recentReviews: ReviewDocument[];
}
