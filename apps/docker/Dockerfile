# docker 客户端 5.0（Playwright 官方基图自带 Chromium；Node 升级 22 以支持 strip-types）
FROM mcr.microsoft.com/playwright:v1.47.0-noble

# Node 22（>=22.6 支持 --experimental-strip-types；基图内置 Node 20 不支持）
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && node --version && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN cd packages/core && npm install --no-audit && npx tsc -p tsconfig.json \
 && cd ../../apps/docker && npm install --no-audit --ignore-scripts

ENV NODE_ENV=production
ENV MH_VERSION=5.0.0
ENV DATA_DIR=/data
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
VOLUME ["/data"]
EXPOSE 3000
LABEL org.opencontainers.image.version=5.0.0
CMD ["node", "--experimental-strip-types", "apps/docker/src/main.ts"]
