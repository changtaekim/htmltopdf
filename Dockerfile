FROM node:18-slim

# Chromium 및 폰트 설치
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# 서버 의존성 설치 (레이어 캐시 최적화)
COPY server/package*.json ./server/
RUN npm install --prefix server

# 클라이언트 의존성 설치 (레이어 캐시 최적화)
COPY client/package*.json ./client/
RUN npm install --prefix client

# 클라이언트 소스 복사 후 빌드
COPY client/ ./client/
RUN npm run build --prefix client

# 서버 소스 복사
COPY server/ ./server/
COPY package.json ./

EXPOSE 3000

CMD ["node", "server/index.js"]
