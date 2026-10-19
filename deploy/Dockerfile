# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS web-build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/wholesaler/package.json apps/wholesaler/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/web-ui/package.json packages/web-ui/package.json
RUN pnpm install --frozen-lockfile
COPY apps/wholesaler apps/wholesaler
COPY apps/admin apps/admin
COPY packages packages
ARG SUPPLIER_DOMAIN
ARG ADMIN_DOMAIN
RUN VITE_SUPPLIER_URL=https://${SUPPLIER_DOMAIN} VITE_ADMIN_URL=https://${ADMIN_DOMAIN} VITE_MOBILE_URL= VITE_BASE_PATH=/ pnpm build:web

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATABASE_PATH=/data/rasta.sqlite API_ONLY=true
COPY --chown=node:node apps/api apps/api
COPY --chown=node:node packages/domain packages/domain
COPY --chown=node:node scripts/backup-db.mjs scripts/backup-db.mjs
RUN mkdir -p /data/backups && chown -R node:node /data
USER node
EXPOSE 4173
CMD ["node", "apps/api/server.mjs"]

FROM caddy:2.11-alpine AS gateway
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/wholesaler/dist /srv/wholesaler
COPY --from=web-build /app/apps/admin/dist /srv/admin
