import "dotenv/config";
import type { Server } from "node:http";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { getApiEnv } from "./config/env";
import { HttpExceptionFilter } from "./infrastructure/http/exception.filter";

// Request timeout: AI inference calls (document generation via OpenRouter) can
// take 30-60s with retries. We set the timeout high enough to accommodate that.
// Previously 30s, which caused ECONNRESET on the generate endpoint because the
// Node.js HTTP server closes the socket when the timeout fires — even for
// in-flight responses, not just request reception.
const REQUEST_TIMEOUT_MS = 120 * 1000;
const SOCKET_TIMEOUT_MS = 0; // no socket inactivity timeout
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
