import "dotenv/config";
import type { Server } from "node:http";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { getApiEnv } from "./config/env";
import { HttpExceptionFilter } from "./infrastructure/http/exception.filter";

// Timeout configuration for long-running AI generation requests.
//
// Phase 1 (sync /generate): server.requestTimeout is temporarily raised to
// 300s so the synchronous POST /cases/:id/generate endpoint can survive its
// worst-case AI retry budget (~150s = 3 attempts × ~48s + backoff). This is a
// documented band-aid; it will be reverted to 30s in Phase 2 when /generate
// becomes async (202 Accepted) via the async-document-generation change.
// See openspec/changes/fix-generation-delay-ui-message/specs/local-operational-infra/spec.md
//
// TODO(Phase2): revert REQUEST_TIMEOUT_MS to 30 * 1000 once /generate becomes
// async (202 Accepted). Remove this comment block update.
//
// server.requestTimeout (300s Phase 1 / 30s Phase 2): Maximum time to receive
//   the complete HTTP request headers + body. The Node.js HTTP server destroys
//   the socket when this fires — even for in-flight responses, NOT just request
//   reception. This was the root cause of the original ECONNRESET crash on
//   /generate.
//
// server.timeout (0 = disabled): Socket inactivity timer. DELIBERATELY kept
//   at 0 because during AI generation (OpenRouter, 30-60s + retries) NO bytes
//   flow on the socket — it sits completely idle while the backend waits for
//   the upstream model. A non-zero value would destroy the socket mid-flight
//   and re-trigger the exact ECONNRESET/ECONNREFUSED crashes this timeout
//   config was designed to fix.
//
//   Trade-off: disabling the inactivity timer removes a layer of slow-loris
//   protection. That protection is handled by requestTimeout (caps request
//   reception), headersTimeout (caps header arrival for keep-alive), and
//   keepAliveTimeout (caps keep-alive idle between requests).
//
// server.keepAliveTimeout (75s): Idle keep-alive connection lifetime.
// server.headersTimeout (76s): Must be > keepAliveTimeout to avoid races.
//
// Reference: https://nodejs.org/api/http.html#servertimeout
// server.timeout is deprecated since Node 18; prefer server.requestTimeout.
// TODO(Phase2): revert to 30s once /generate becomes async (202 Accepted)
const REQUEST_TIMEOUT_MS = 300 * 1000;
const SOCKET_TIMEOUT_MS = 0; // disabled — see explanation above
const KEEP_ALIVE_TIMEOUT_MS = 75 * 1000;
const HEADERS_TIMEOUT_MS = 76 * 1000;

// Eagerly validate env at startup — fail synchronously before NestJS starts
getApiEnv();

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix("api");

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  });

  // Body parser size limit for file uploads
  app.useBodyParser("json", { limit: "10mb" });
  app.useBodyParser("urlencoded", { limit: "10mb", extended: true });

  const shutdown = async () => {
    await app.close();
  };

  process.once("SIGTERM", () => {
    void shutdown();
  });

  process.once("SIGINT", () => {
    void shutdown();
  });

  await app.listen(env.PORT);

  const server = app.getHttpServer() as Server;
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.timeout = SOCKET_TIMEOUT_MS;
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
}

void bootstrap();
