# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm run build


# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine

# ── Install Chromium on Alpine ────────────────────────────────────────────────
# On Alpine, the package is `chromium` (NOT chromium-browser).
# The binary lands at /usr/bin/chromium-browser on Alpine (confusingly),
# BUT it is a REAL binary here — Alpine has no snap system.
# We also need all shared libs Puppeteer requires.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    udev \
    && rm -rf /var/cache/apk/*

# ── Tell Puppeteer where Chromium lives and skip downloading its own ──────────
# On Alpine, `apk install chromium` puts the binary at /usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser

# ─────────────────────────────────────────────────────────────────────────────

RUN npm install -g pnpm prisma

WORKDIR /app

# Copy production dependencies
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --prod --frozen-lockfile

# Copy built assets from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/entrypoint.sh"]