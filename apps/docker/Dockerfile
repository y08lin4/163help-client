# docker 客户端（5.0）—— 基础镜像自带 Chromium（Playwright 官方）
FROM mcr.microsoft.com/playwright:v1.47.0-noble

WORKDIR /app
COPY package.json ./
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY apps/docker ./apps/docker
RUN npm --prefix packages/core install --omit=dev --ignore-scripts && \
    npm --prefix apps/docker install --omit=dev --ignore-scripts 2>/dev/null || true

ENV NODE_ENV=production
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "apps/docker/src/main.js"]
