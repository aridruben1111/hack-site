# syntax=docker/dockerfile:1

# ---- Stage 1: build the React client ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---- Stage 2: production runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install only server runtime dependencies
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

# Copy server source and the built client
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

# Run as an unprivileged user
RUN addgroup -S recon && adduser -S recon -G recon \
    && chown -R recon:recon /app
USER recon

ENV PORT=5174
EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/api/health" >/dev/null 2>&1 || exit 1

WORKDIR /app/server
CMD ["node", "index.js"]
