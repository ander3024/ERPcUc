FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init openssl openssl-dev libc6-compat
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --only=production && npm cache clean --force
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/imports logs
EXPOSE 3001
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]
