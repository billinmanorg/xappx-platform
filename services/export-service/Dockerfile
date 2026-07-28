# export-service
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8094
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8094/healthz || exit 1
CMD ["node", "dist/main.js"]
