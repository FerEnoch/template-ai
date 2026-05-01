import { Injectable } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import {
  UsersRepository,
  type UserRecord,
  type CreateUserInput,
} from "../infrastructure/postgres/repositories/users.repository";
import {
  SubscriptionsRepository,
  type SubscriptionRecord,
  type CreateSubscriptionInput,
} from "../infrastructure/postgres/repositories/subscriptions.repository";
import { UsageLedgerRepository } from "../infrastructure/postgres/repositories/usage-ledger.repository";
import type {
  AccessStateResult,
  AppendUsageInput,
  UsageLedgerRecord,
} from "./contracts";

@Injectable()
export class DomainSchemaFirstService {
  public constructor(private readonly postgres: PostgresService) {}

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    // Owner context uses id=0 sentinel during user creation (before user has an id).
    // The INSERT policy only requires that app.current_user_id is set, allowing
    // insertion before the generated id is known. Owner isolation for reads/updates
    // is enforced by the separate SELECT/UPDATE/DELETE policies.
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const repo = new UsersRepository(client);
      return repo.create(input);
    });
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionRecord> {
    return this.postgres.withOwnerTransaction(input.userId, async ({ client }) => {
      const repo = new SubscriptionsRepository(client);
      return repo.create(input);
    });
  }

  async getAccessState(userId: number, now: Date = new Date()): Promise<AccessStateResult> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new SubscriptionsRepository(client);
      const subscription = await repo.findActiveByUserId(userId, now);

      if (!subscription) {
        return { hasAccess: false, subscriptionId: null };
      }

      return {
        hasAccess: true,
        subscriptionId: subscription.id,
      };
    });
  }

  async appendUsage(input: AppendUsageInput): Promise<UsageLedgerRecord> {
    return this.postgres.withOwnerTransaction(input.userId, async ({ client }) => {
      const repo = new UsageLedgerRepository(client);
      return repo.append({
        userId: input.userId,
        subscriptionId: input.subscriptionId ?? null,
        operationType: input.operationType,
      });
    });
  }
}