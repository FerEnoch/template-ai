import { PoolClient } from "pg";

export interface UserRecord {
  id: number;
  email: string;
  emailNormalized: string;
  displayName: string;
  externalSubject: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  externalSubject: string;
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  return {
    id: row["id"] as number,
    email: row["email"] as string,
    emailNormalized: row["email_normalized"] as string,
    displayName: row["display_name"] as string,
    externalSubject: row["external_subject"] as string,
    createdAt: row["created_at"] as Date,
    updatedAt: row["updated_at"] as Date,
  };
}

export class UsersRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO users (email, display_name, external_subject)
        VALUES ($1, $2, $3)
        RETURNING id, email, email_normalized, display_name, external_subject, created_at, updated_at
      `,
      [input.email, input.displayName, input.externalSubject],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert user");
    }

    return rowToUser(result.rows[0]);
  }

  async findById(id: number): Promise<UserRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, email, email_normalized, display_name, external_subject, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }

  async findByEmailNormalized(emailNormalized: string): Promise<UserRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, email, email_normalized, display_name, external_subject, created_at, updated_at
        FROM users
        WHERE email_normalized = $1
      `,
      [emailNormalized],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }

  async findByExternalSubject(externalSubject: string): Promise<UserRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, email, email_normalized, display_name, external_subject, created_at, updated_at
        FROM users
        WHERE external_subject = $1
      `,
      [externalSubject],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }
}