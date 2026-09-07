FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start -- --local --ip 0.0.0.0 --port 3000 --show-interactive-dev-session=false"]
