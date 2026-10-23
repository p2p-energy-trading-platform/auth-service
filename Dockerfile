FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng poppler-utils python3 py3-pillow

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY scripts/preprocess-nic-image.py ./scripts/preprocess-nic-image.py

USER node

EXPOSE 3000
EXPOSE 50051

CMD ["node", "dist/main.js"]