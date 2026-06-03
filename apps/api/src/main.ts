import "dotenv/config";
import type { Server } from "node:http";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { getApiEnv } from "./config/env";
import { HttpExceptionFilter } from "./infrastructure/http/exception.filter";

// 30s request timeout — async workers handle AI inference,
// no more blocking HTTP connections for 20-30s.
const REQUEST_TIMEOUT_MS = 30 * 1000;
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
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
}

void bootstrap();
