FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Only a disposable empty schema is used at build time. No production data or secrets.
ENV DATABASE_URL=file:/tmp/zahra-build.db
ARG APP_URL=https://zahra.noonomanart.com
ENV APP_URL=$APP_URL
RUN npm run db:migrate && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat \
    && addgroup -S -g 1001 zahra && adduser -S -u 1001 -G zahra zahra
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/storage/zahra.db UPLOAD_DIR=/app/storage/uploads
COPY --from=builder --chown=zahra:zahra /app/.next/standalone ./
COPY --from=builder --chown=zahra:zahra /app/.next/static ./.next/static
COPY --from=builder --chown=zahra:zahra /app/public ./public
COPY deploy/start.mjs ./deploy/start.mjs
RUN mkdir -p storage .next/cache && chown zahra:zahra storage .next/cache
USER zahra
EXPOSE 3000
CMD ["node", "deploy/start.mjs"]
