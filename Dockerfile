# Local / self-hosted image: Bun runs the same Hono app as the Worker and also
# serves the built React app. Production on Cloudflare does not use this file.
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY . .
RUN bun --filter @fugo/web build

FROM oven/bun:1.4 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY --from=build /app/apps/web/dist apps/web/dist

WORKDIR /app/apps/api
ENV PORT=8787 STATIC_DIR=../web/dist
EXPOSE 8787
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/server.ts"]
