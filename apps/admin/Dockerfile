FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile

COPY apps/admin apps/admin

RUN pnpm --filter @jposta/admin build

EXPOSE 3001

CMD ["pnpm", "--filter", "@jposta/admin", "start"]
