# docker 客户端 5.0（Playwright 官方基图自带 Chromium 与 Node）
FROM mcr.microsoft.com/playwright:v1.47.0-noble

WORKDIR /app
COPY . .
RUN cd packages/core && npm install --no-audit && npx tsc -p tsconfig.json \
 && cd ../../apps/docker && npm install --no-audit --ignore-scripts

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "apps/docker/src/main.ts"]
