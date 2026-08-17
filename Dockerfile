FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S btw && adduser -S -G btw btw
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=btw:btw /app/dist ./dist
COPY --from=build --chown=btw:btw /app/migrations ./migrations
COPY --chown=btw:btw public ./public

USER btw
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 CMD wget -q --spider http://127.0.0.1:3000/health/live || exit 1
CMD ["node", "dist/main.js"]
