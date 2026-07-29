# Étape 1 : build du front (toutes dépendances)
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : image d'exécution (dépendances de production seulement :
# express, better-sqlite3, pngjs, tsx)
FROM node:20-slim
WORKDIR /app
ENV DATA_DIR=/data PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/web/dist web/dist
COPY server server
COPY tsconfig.json ./
EXPOSE 3000
VOLUME /data
CMD ["npx", "tsx", "server/index.ts"]
