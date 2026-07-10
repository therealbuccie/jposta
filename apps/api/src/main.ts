import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { env } from "./config/env";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "https://jposta.com",
  "https://www.jposta.com",
  env.webOrigin,
]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by JPosta CORS policy."));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.enableShutdownHooks();

  await app.listen(env.port);
}

void bootstrap();
