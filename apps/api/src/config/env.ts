type NodeEnv = "development" | "test" | "production";

export type ApiEnv = {
  PORT: number;
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
};

const allowedNodeEnvs: readonly NodeEnv[] = ["development", "test", "production"];

function fail(message: string): never {
  throw new Error(`[api env] ${message}`);
}

function parsePort(value: string | undefined): number {
  if (!value) {
    fail("PORT is required");
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (!value) {
    fail("NODE_ENV is required");
  }

  if (!allowedNodeEnvs.includes(value as NodeEnv)) {
    fail("NODE_ENV must be one of development | test | production");
  }

  return value as NodeEnv;
}

function parseDatabaseUrl(value: string | undefined): string {
  if (!value) {
    fail("DATABASE_URL is required");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    fail("DATABASE_URL must be a valid URL");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    fail("DATABASE_URL must use postgres:// or postgresql:// protocol");
  }

  return value;
}

let cachedApiEnv: ApiEnv | null = null;

export function getApiEnv(): ApiEnv {
  if (cachedApiEnv) {
    return cachedApiEnv;
  }

  cachedApiEnv = {
    PORT: parsePort(process.env.PORT),
    NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
    DATABASE_URL: parseDatabaseUrl(process.env.DATABASE_URL),
  };

  return cachedApiEnv;
}
