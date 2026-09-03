#!/bin/bash
# bump.sh <新版本> —— 客户端版本号统一替换（v5.1 引入，防下次手改漏）
# 用法：bash scripts/bump.sh 5.1
# 白名单：manifest / 端点入口 / docker 页面 / release.sh / package.json / package-lock.json（本项目部分）
set -euo pipefail
NEW="${1:-}"
if [ -z "$NEW" ]; then echo "用法: bash scripts/bump.sh <新版本>（如 5.1）"; exit 1; fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD="5.0.3"   # 起始版本（本脚本幂等：所有旧版本串都替换为 NEW，含 5.0.x 全系）
FILES=(
  "package.json"
  "apps/docker/Dockerfile"
  "apps/docker/package.json"
  "apps/docker/src/main.ts"
  "apps/docker/src/page.ts"
  "apps/docker/src/server.ts"
  "apps/extension/src/background.js"
  "apps/extension/src/content.ts"
  "apps/extension/src/manifest.json"
  "apps/extension/src/popup.html"
  "apps/userscript/package.json"
  "apps/userscript/src/main.ts"
  "packages/core/package.json"
  "packages/core/tests/auth.test.ts"
  "packages/ui/package.json"
  "scripts/release.sh"
)

CHANGED=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # 只替换 5.0.x（形如 5.0.0-5.0.9 的版本串），不动 vite@5.0.3 等依赖：依赖写法为 "vite": "^5.0.3" 不在白名单文件内
    if grep -qE "5\.0\.[0-9]+" "$f"; then
      sed -i -E "s/5\.0\.[0-9]+/$NEW/g" "$f"
      echo "  ✓ $f → $NEW"
      CHANGED=1
    fi
  fi
done

if [ "$CHANGED" = "0" ]; then
  echo "提示：白名单文件中未发现 5.0.x 残留（可能已在 $NEW 或已一致）。"
fi

echo "—— 残留检查（应无 5.0.x，排除 node_modules/package-lock 依赖）——"
LEFTOVER=$(grep -rnE "5\.0\.[0-9]+" --include="*.json" --include="*.ts" --include="*.js" --include="*.html" --include="*.sh" --include="Dockerfile" . 2>/dev/null \
  | grep -vE "node_modules|package-lock|vite|deep-eql|\.dist/" \
  | grep -vE "apps/extension/content\.bundle\.js|dist/" || true)
if [ -n "$LEFTOVER" ]; then
  echo "⚠ 以下文件仍有 5.0.x（请人工核对是否为依赖/非本项目版本）："
  echo "$LEFTOVER"
else
  echo "✓ 无残留"
fi
echo "—— 完成：bump 到 $NEW ——"
