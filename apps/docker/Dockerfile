# docker 客户端 5.0（Playwright 基图 + Node22；源码 esbuild 预编译，运行纯 JS）
FROM mcr.microsoft.com/playwright:v1.47.0-noble

# Node 22（>=22 稳定；同时服务 bundle 后的运行时）
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && node --version && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm config set cache /tmp/npmcache --global && \
    cd packages/core && npm install --no-audit && npx tsc -p tsconfig.json && cd ../.. && \
    cd apps/docker && npm install --no-audit --ignore-scripts && \
    npx esbuild src/main.ts --bundle --format=esm --platform=node --outfile=dist/main.js --external:playwright-core

ENV NODE_ENV=production
ENV MH_VERSION=5.0.3
ENV DATA_DIR=/data
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
VOLUME ["/data"]
EXPOSE 3000
LABEL org.opencontainers.image.version=5.0.3
CMD ["node", "apps/docker/dist/main.js"]
