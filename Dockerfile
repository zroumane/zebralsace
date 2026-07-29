# better-sqlite3 se compile à l'installation : les étapes qui font npm ci
# embarquent la chaîne de compilation (python3/make/g++). L'image finale, non.

# Étape 1 : dépendances complètes + build du front
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : dépendances de production seules (express, better-sqlite3, pngjs, tsx)
FROM node:22-slim AS deps-prod
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Étape 3 : image d'exécution, sans outillage
FROM node:22-slim
WORKDIR /app
ENV DATA_DIR=/data PORT=3000
COPY package*.json ./
COPY --from=deps-prod /app/node_modules node_modules
COPY --from=build /app/web/dist web/dist
COPY server server
COPY tsconfig.json ./
EXPOSE 3000
VOLUME /data
CMD ["npx", "tsx", "server/index.ts"]
