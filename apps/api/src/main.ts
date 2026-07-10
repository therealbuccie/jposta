import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { env } from "./config/env";

const fixedAllowedOrigins = new Set(["http://localhost:3000", env.webOrigin]);
const jpostaOriginPattern = /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?\.)?jposta\.com$/;

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (fixedAllowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return url.origin === origin && jpostaOriginPattern.test(origin);
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
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

if (require.main === module) {
  void bootstrap();
}
