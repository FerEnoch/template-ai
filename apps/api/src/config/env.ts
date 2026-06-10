type NodeEnv = "development" | "test" | "production";

export type ApiEnv = {
  PORT: number;
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  OPENROUTER_API_KEY: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  AI_CACHE_ENABLED: boolean;
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

function parseCorsOrigin(value: string | undefined): string {
  // CORS_ORIGIN is optional — default to localhost:3000 for dev
  if (!value) {
    return "http://localhost:3000";
  }

  return value;
}

function parseOpenRouterApiKey(value: string | undefined): string {
  if (!value) {
    fail("OPENROUTER_API_KEY is required");
  }

  return value;
}

function parseRedisHost(value: string | undefined): string {
  if (!value) {
    fail("REDIS_HOST is required");
  }

  return value;
}

function parseRedisPort(value: string | undefined): number {
  if (!value) {
    fail("REDIS_PORT is required");
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("REDIS_PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseAiCacheEnabled(value: string | undefined): boolean {
  // Default to false — cache is opt-in
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase().trim();
  return normalized === "true" || normalized === "1";
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
    CORS_ORIGIN: parseCorsOrigin(process.env.CORS_ORIGIN),
    OPENROUTER_API_KEY: parseOpenRouterApiKey(process.env.OPENROUTER_API_KEY),
    REDIS_HOST: parseRedisHost(process.env.REDIS_HOST),
    REDIS_PORT: parseRedisPort(process.env.REDIS_PORT),
    AI_CACHE_ENABLED: parseAiCacheEnabled(process.env.AI_CACHE_ENABLED),
  };

  return cachedApiEnv;
}

// Ensure process exits on critical env validation failure
function handleFatalError(message: string): never {
  process.stderr.write(`[api env] ${message}\n`);
  process.exit(1);
}

// Trap startup errors to guarantee non-zero exit.
// Guarded to prevent duplicate listeners when the module is re-imported
// (e.g., across test files in the same pool).
let fatalErrorHandlerRegistered = false;

if (!fatalErrorHandlerRegistered) {
  fatalErrorHandlerRegistered = true;
  process.on("uncaughtException", (err) => {
    if (err.message.includes("[api env]")) {
      handleFatalError(err.message.replace("[api env] ", ""));
    }
    process.exit(1);
  });
}
