FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

RUN pnpm --filter @jposta/api build

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @jposta/api prisma:deploy && pnpm --filter @jposta/api start"]

