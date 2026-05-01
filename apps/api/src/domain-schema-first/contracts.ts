/**
 * Domain Schema First — slice-only contracts
 * These types are scoped to the first persisted slice: users, subscriptions, usage_ledger.
 * No auth, billing, templates, or cross-cutting concerns are represented here.
 *
 * Record types (UserRecord, SubscriptionRecord, UsageLedgerRecord) are defined in
 * the repository layer and re-exported here for convenience.
 * Input/output types are defined here because they are service-level contracts.
 */

// ---------------------------------------------------------------------------
// Re-export repository record types
// ---------------------------------------------------------------------------
export type { UserRecord } from "../infrastructure/postgres/repositories/users.repository";
export type { SubscriptionRecord } from "../infrastructure/postgres/repositories/subscriptions.repository";
export type { UsageLedgerRecord } from "../infrastructure/postgres/repositories/usage-ledger.repository";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------
export type AccessStatus = "activa" | "limitada" | "sin_acceso" | "cancelada";
export type UsageOperation = "analisis_documento" | "generacion_documento";

// ---------------------------------------------------------------------------
// Service-level input types
// ---------------------------------------------------------------------------
export interface CreateUserInput {
  email: string;
  displayName: string;
  externalSubject: string;
}

export interface CreateSubscriptionInput {
  userId: number;
  status: AccessStatus;
  periodStart: Date;
  periodEnd: Date;
}

export interface AppendUsageInput {
  userId: number;
  subscriptionId?: number | null;
  operationType: UsageOperation;
}

// ---------------------------------------------------------------------------
// Access state output
// ---------------------------------------------------------------------------
export interface AccessStateResult {
  hasAccess: boolean;
  subscriptionId: number | null;
}