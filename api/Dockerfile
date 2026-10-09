# Base image comes from Google's Docker Hub mirror by default (no Docker Hub auth/rate limits in CI).
ARG NODE_IMAGE=mirror.gcr.io/library/node:22-alpine

# ---- deps: install all dependencies (cached by lockfile) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript ----
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: minimal image, non-root ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
