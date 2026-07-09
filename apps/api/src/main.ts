import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: env.webOrigin,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(env.port);
}

void bootstrap();
