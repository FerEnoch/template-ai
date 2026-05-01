import { describe, expect, it, vi } from "vitest";
import { DomainSchemaFirstService } from "./domain-schema-first.service";
import { PostgresService, type TransactionContext } from "../infrastructure/postgres/postgres.service";
import type { UserRecord, SubscriptionRecord, UsageLedgerRecord } from "./contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 1,
    email: "test@example.com",
    emailNormalized: "test@example.com",
    displayName: "Test User",
    externalSubject: "subj_123",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeSubscriptionRecord(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const now = new Date();
  return {
    id: 1,
    userId: 1,
    status: "activa",
    periodStart: new Date(now.getTime() - 86400 * 1000),
    periodEnd: new Date(now.getTime() + 86400 * 1000),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeUsageLedgerRecord(overrides: Partial<UsageLedgerRecord> = {}): UsageLedgerRecord {
  return {
    id: 1,
    userId: 1,
    subscriptionId: 1,
    operationType: "analisis_documento",
    units: 1,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function createMockPostgres() {
  const mockClient = { query: vi.fn() };
  const mockPostgres = {
    withOwnerTransaction: vi.fn(
      async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
        await mockClient.query("BEGIN");
        await mockClient.query("SET LOCAL app.current_user_id = $1", [ownerId]);
        const result = await cb({ client: mockClient as never, ownerId });
        await mockClient.query("COMMIT");
        return result;
      },
    ),
  } as unknown as PostgresService;

  return { mockPostgres, mockClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DomainSchemaFirstService", () => {
  describe("createUser", () => {
    it("creates a user and returns the record", async () => {
      const mockClient = { query: vi.fn() };
      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            return cb({ client: mockClient as never, ownerId });
          },
        ),
      } as unknown as PostgresService;

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            email: "test@example.com",
            email_normalized: "test@example.com",
            display_name: "Test User",
            external_subject: "subj_123",
            created_at: new Date("2025-01-01"),
            updated_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      const result = await service.createUser({
        email: "test@example.com",
        displayName: "Test User",
        externalSubject: "subj_123",
      });

      expect(result).toMatchObject({
        id: 1,
        email: "test@example.com",
        emailNormalized: "test@example.com",
        displayName: "Test User",
        externalSubject: "subj_123",
      });
    });

    it("invokes withOwnerTransaction with ownerId=0 and sets RLS context", async () => {
      const { mockPostgres, mockClient } = createMockPostgres();

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            email: "test@example.com",
            email_normalized: "test@example.com",
            display_name: "Test User",
            external_subject: "subj_123",
            created_at: new Date("2025-01-01"),
            updated_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      await service.createUser({
        email: "test@example.com",
        displayName: "Test User",
        externalSubject: "subj_123",
      });

      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL app.current_user_id = $1", [0]);
    });
  });

  describe("createSubscription", () => {
    it("creates a subscription and returns the record", async () => {
      const mockClient = { query: vi.fn() };
      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            return cb({ client: mockClient as never, ownerId });
          },
        ),
      } as unknown as PostgresService;
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            user_id: 1,
            status: "activa",
            period_start: now,
            period_end: periodEnd,
            created_at: new Date("2025-01-01"),
            updated_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      const result = await service.createSubscription({
        userId: 1,
        status: "activa",
        periodStart: now,
        periodEnd: periodEnd,
      });

      expect(result).toMatchObject({
        id: 1,
        userId: 1,
        status: "activa",
      });
    });

    it("invokes withOwnerTransaction with the correct ownerId and sets RLS context", async () => {
      const { mockPostgres, mockClient } = createMockPostgres();
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            user_id: 1,
            status: "activa",
            period_start: now,
            period_end: periodEnd,
            created_at: new Date("2025-01-01"),
            updated_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      await service.createSubscription({
        userId: 1,
        status: "activa",
        periodStart: now,
        periodEnd: periodEnd,
      });

      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(1, expect.any(Function));
      expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL app.current_user_id = $1", [1]);
    });
  });

  describe("getAccessState", () => {
    it("returns hasAccess=true when active subscription exists", async () => {
      const mockClient = { query: vi.fn() };
      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            return cb({ client: mockClient as never, ownerId });
          },
        ),
      } as unknown as PostgresService;
      const now = new Date();

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            user_id: 1,
            status: "activa",
            period_start: new Date(now.getTime() - 86400 * 1000),
            period_end: new Date(now.getTime() + 86400 * 1000),
            created_at: new Date("2025-01-01"),
            updated_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      const result = await service.getAccessState(1, now);

      expect(result).toEqual({ hasAccess: true, subscriptionId: 1 });
    });

    it("returns hasAccess=false when no active subscription", async () => {
      const mockClient = { query: vi.fn() };
      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            return cb({ client: mockClient as never, ownerId });
          },
        ),
      } as unknown as PostgresService;

      mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] });

      const service = new DomainSchemaFirstService(mockPostgres);
      const result = await service.getAccessState(1);

      expect(result).toEqual({ hasAccess: false, subscriptionId: null });
    });

  });

  describe("appendUsage", () => {
    it("appends a usage ledger row and returns the record", async () => {
      const mockClient = { query: vi.fn() };
      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            return cb({ client: mockClient as never, ownerId });
          },
        ),
      } as unknown as PostgresService;

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            user_id: 1,
            subscription_id: 1,
            operation_type: "analisis_documento",
            units: 1,
            created_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      const result = await service.appendUsage({
        userId: 1,
        subscriptionId: 1,
        operationType: "analisis_documento",
      });

      expect(result).toMatchObject({
        id: 1,
        userId: 1,
        subscriptionId: 1,
        operationType: "analisis_documento",
        units: 1,
      });
    });

    it("invokes withOwnerTransaction with the correct ownerId and sets RLS context", async () => {
      const { mockPostgres, mockClient } = createMockPostgres();

      mockClient.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            user_id: 1,
            subscription_id: 1,
            operation_type: "analisis_documento",
            units: 1,
            created_at: new Date("2025-01-01"),
          },
        ],
      });

      const service = new DomainSchemaFirstService(mockPostgres);
      await service.appendUsage({
        userId: 1,
        subscriptionId: 1,
        operationType: "analisis_documento",
      });

      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(1, expect.any(Function));
      expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL app.current_user_id = $1", [1]);
    });
  });
});