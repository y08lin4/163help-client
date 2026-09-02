#!/bin/bash
# 客户端 5.0 发布（CI/VPS 通用）：core build → userscript bundle → extension zip
# 用法：VERSION=5.0.2 bash scripts/release.sh
set -euo pipefail
VERSION="${VERSION:-5.0.2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p dist

echo "[1/4] core build"
(cd packages/core && npm install --no-audit >/dev/null 2>&1 || true)
(cd packages/core && npx tsc -p tsconfig.json)

echo "[2/4] userscript bundle"
(cd apps/userscript && npm install --no-audit >/dev/null 2>&1 || true)
(cd apps/userscript && npx esbuild src/main.ts --bundle --format=iife --outfile=../../dist/music-help.user.js \
  --banner:js="// ==UserScript==
// @name        网易云音乐互助
// @namespace   163help
// @version     $VERSION
// @description 互助播放（油猴端）
// @match       https://music.163.com/*
// @match       https://163music.linyu.qzz.io/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       unsafeWindow
// ==/UserScript==")

echo "[3/4] extension zip"
(cd apps/extension && npm install --no-audit >/dev/null 2>&1 || true)
(cd apps/extension && npx esbuild src/content.ts --bundle --format=iife --outfile=content.bundle.js)
mkdir -p build/extension
cp apps/extension/src/manifest.json build/extension/manifest.json
cp apps/extension/src/background.js build/extension/background.js
cp apps/extension/content.bundle.js build/extension/content.js
cp apps/extension/src/popup.html build/extension/popup.html
(cd build && zip -r ../dist/163help-extension-v$VERSION.zip extension)

echo "[4/4] done → dist/"
ls -la dist/
