FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

RUN pnpm --filter @jposta/web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@jposta/web", "start"]
