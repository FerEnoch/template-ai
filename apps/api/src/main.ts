import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getApiEnv } from "./config/env";

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create(AppModule);

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
}

void bootstrap();
