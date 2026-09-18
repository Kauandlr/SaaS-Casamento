FROM node:22-bookworm-slim

WORKDIR /app

# Keep the OS CA store current and provide openssl for outbound TLS diagnostics.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start -- --local --ip 0.0.0.0 --port 3000 --show-interactive-dev-session=false"]
