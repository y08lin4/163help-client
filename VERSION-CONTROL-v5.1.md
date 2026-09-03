# 客户端 v5.1 实施规范（主调度持有）

> 本文件是 v5.1 实施的**唯一权威依据**。所有子代理必须严格遵守，不得超出范围。
> 基准仓库：`C:\Users\lin\Desktop\163music\163help-client\`（monorepo，根目录）
> 设计稿：`C:\Users\lin\Desktop\163music\design-client-full-v5.1.html`（用户已批准，只读参考）

## 版本号（v5.1）
- 版本字符串：`5.1`（不用 5.1.0，保持与 5.0.3 同样制式；popup 标题「· v5.1」，dockeri 端 `version:'5.1'`）
- 所有 `5.0.3` 硬编码处统一改为 `5.1`。（注：`vite@5.0.3`/`deep-eql` 等 npm 依赖版本**不要动**）
- 涉及文件：package.json / package-lock.json / manifest.json / content.ts / background.js / popup.html / main.ts(userscript) / main.ts(docker) / page.ts / server.ts / release.sh（默认值 `/scripts/release.sh` L5 注释与用法）
- 注意：`apps/userscript/package.json` L3 与 `apps/extension/package.json` L3 都要改（若有）。

## 一、popup（扩展端）—— 子任务 A
**目标**：popup 重做为「真实快照 + 外部脚本 + 3 真实按钮」。
- 文件：`apps/extension/src/popup.html`、新建 `apps/extension/src/popup.js`
- popup.html：
  - 移除全部内联 `<script>`（**这是 MV3 CSP 禁止的**）
  - 改为 `<script src="popup.js"></script>`
  - 保留现有样式，但按设计稿 3.1 增加 header 状态徽章 + 状态行 + 3 个按钮（含 `id="open"`/`id="copy"`/`id="toggle"`）
  - 标题：「网易云音乐互助 · v5.1」
- popup.js：
  - 逻辑：打开读 `chrome.storage.local` 的 `mh_snapshot`（30s 由 content 写）；无快照 → 显示占位态（B 态）
  - `mh_snapshot` 数据结构：`{online:boolean, todaySec:number, todayGoal:number, taskName:string, taskPos:string, helped:number, helpedTotal:number}`
  - 按钮：
    - `open`：`chrome.tabs.query({url:'https://music.163.com/*'})` → 有则 activate，无则 create（muted:true）
    - `copy`：组装脱敏诊断文本（格式见下「诊断文本」）→ `navigator.clipboard.writeText` → 成功/失败提示（popup 内小 toast 或 alert）
    - `toggle`：`chrome.tabs.sendMessage(tabId, {type:'mh:toggle'})`；无画面标签时置灰（disabled）
  - 监听 `chrome.storage.onChanged` → 实时刷新
  - 参考现有 popup.html 已有按钮逻辑（第 29-37 行），但需按新格式重写
- **依赖**：内容依赖子任务 B 的面板实现 `mh_snapshot` 写入键；两任务并行，B 完成后再验证 A 的读取逻辑正确性。

## 二、面板（ui 包 + core）—— 子任务 B
**目标**：让面板真正可用（设置弹层/日志/诊断/圆环/被助进度），并接入 core 事件链。
- 文件：`packages/ui/src/mh-panel.ts`、`packages/ui/src/index.ts`（若需）、`packages/core/src/*`（事件触发用）
- 改动点（基于盘点）：
  1. **模板补齐设置弹层**（TEMPLATE 增加 `data-settings` 区 + `data-settoggle`（设置按钮）+ `data-autocollapse`（开关）+ `data-logreport`（错误自动上报开关）+ `data-save`（保存））——但**注意**：mh-panel 是 **shadow DOM**，模板完整。
  2. **设置项**（按设计稿 2.3）：
     - `songIds`（textarea，多个回车分隔）默认空
     - `autoStart`（开关）默认 true
     - `onlyHelp`（只帮不助）默认 false
     - `autoCollapse`（始终展开=on）默认 on——控制 armAutoCollapse
     - `logReport`（错误自动上报）默认 true
     - 存储：优先用 `globalThis.GM`（油猴）→ `chrome.storage.local`（扩展）→ `localStorage`（兜底）。统一一个 `setSetting`/`getSetting` 辅助函数放 mh-panel.ts 或 core。
  3. **诊断复制**：把 `mh:diagnose` 事件接入——监听后调 `logger.dump()`（core）拼接 9 行文本（含版本/浏览器/账号/服务器/状态/心跳/最近日志/设置。格式参考设计稿 2.4）→ 写入剪贴板。**脱敏**：token/账号已打码（`***`）。剪贴板可用 `navigator.clipboard.writeText` 或 `GM.setClipboard`（油猴）。
  4. **logCount**：`log:append` 从不 emit → 通过 `runtime.log.onAppend?`（core）或 panel 自 addEventListener。面板需要监听「core bus log:append」（若 core 仍不发，则改在 core 里发，见下）。
  5. **limits:updated**：core 从未 emit → 让 core 在 `me()` 成功后 emit `limits:updated`（用 `{helpedToday,helpedLimit,receivedToday,receivedLimit}` 载荷；来源 `me()` 返回 `{displayName,credits}` 或 `/api/state`，若无数据则用 stats.ts 推算或默认 0/9000、0/26）。面板监听 → 更新 `help/limit/recv/recvLimit`，圆环/被助进度可动。
  6. **全局错误捕获**：在 ui 或 core 挂 `window.addEventListener('error',...)` + `unhandledrejection` → 组装 `{level:'error', event:'client_error', msg:..., context:{page,url}}` → `transport.sendLog`（仅当 `logReport`=true 且去重：同 event 5min 内不重发）。**但注意**：`sendLog` 在 transport 里已存在（content.ts L54）。
- **不要动**：`location`/`player` 等播放逻辑、`adapter` 的 token 存换取（那在端点里，不在 ui/core）。

## 三、端点适配扩展（content.ts / main.ts / docker）
**目标**：ext 与 userscript 端点一致化 + 错误上报接上 + 版本。
- 文件：`apps/extension/src/content.ts`、`apps/userscript/src/main.ts`、`apps/docker/src/main.ts`（若有需要）
- 改动点：
  1. **content.ts**：adapter.version 与请求头 `X-Music-Helper-Version` 改为 `5.1`；加入**快照写入**（每 30s 写 `chrome.storage.local` 的 `mh_snapshot`，数据从面板/runtime 状态取）；监听 `job:progress`/`limits:updated`/`log:append` 映射到 setState（补齐 extension 端缺口）。
  2. **userscript main.ts**：version 与请求头改 `5.1`；监听 `limits:updated`（盘点显示已监听，但 core 不发——等 B 修好 core 即可）。
  3. **docker main.ts**：VERSION 常量改 `5.1`；如需加错误上报（自动，同接口），按 core 的 sendLog 走（docker 端 transport.sendLog 是否存在需检查；若无则加）。
- **不要动**：docker 的 server.ts/page.ts（版本字符串另派任务 D 处理）。

## 四、版本号统一 + docker 管理端 —— 子任务 D
**目标**：全部 5.0.3 → 5.1；docker 管理端版本角标同步。
- 文件：`apps/docker/src/page.ts`、`apps/docker/src/server.ts`、`apps/docker/src/main.ts`（版本处）、`scripts/release.sh`、所有 package.json / package-lock.json（排除 npm 依赖）
- 改动点：
  1. 全部 `5.0.3` → `5.1`（只改本项目版本字符串；`vite@5.0.3`/`deep-eql@5.0.3` 等依赖不动）
  2. **新增 `scripts/bump.sh`**：接收版本参数，自动替换所有白名单文件中的旧版本串 → 新版本串，并校验来源一致（**防止下次手改漏**）。白名单：manifests / content.ts / background.js / popup.html / main.ts(userscript+docker) / page.ts / server.ts / release.sh / package.json / package-lock.json（本项目部分）。脚本要幂等、可重跑、出错时提示未替换行。
  3. 跑一次 `bash scripts/bump.sh 5.1`（或直接编辑）→ 确认整仓无残留 `5.0.3`（grep 排除 node_modules）。

## 五、构建与验证（主调度自己）
- 构建：`cd 163help-client && bash scripts/release.sh`（或手动 esbuild + zip）
  - 注意 release.sh 的 `VERSION` 默认值必须已是 5.1，`zip` 打包在 `build/extension` 内 zip `../dist/...zip` 含 `extension/` 层
- 验证（写 `scripts/verify-release.sh` 更新）：
  1. zip 解压后 `manifest.json` version=5.1
  2. popup.html 标题含「v5.1」，且**无内联 `<script>`**（grep `<script>` 只匹配 `<script src=`）
  3. popup.js 存在于 zip
  4. content.js 含 `mh_snapshot` 与 `5.1`
  5. userscript 头部 `@version 5.1`
  6. docker 版本字符串全部 5.1
  7. git 无 5.0.3 残留（排除 node_modules）
  8. 站点 zip 与 GitHub zip md5 一致（发布后）

## 六、发布（主调度）
1. 推 tag `v5.1` 触发 GitHub Actions（release.yml 已配 tags 白名单 `v5*`，会自动构建 + 上传 zip/user.js）
2. 同步站点：将 `dist/163help-extension-v5.1.zip` 上传到服务器 `/opt/music-help/script-release/public/` + 更新主仓 `script-release/public/index.html`、`extension-upgrade.html` 的版本引用 + 缓存参数 `v=`（改为新值）+ 主仓 git push
3. 更新服务器 `/opt/music-help/script-release/public/` 的 html（v5.1）
4. verify-release.sh 8 项验收通过
5. 通知用户重载扩展（`chrome://extensions` 移除旧 → 加载新解压文件夹 / 或直接「重新加载」）
6. 更新本文件（实施完成清单）

## 回传格式（每个子代理必须）
- 改了哪些文件（路径 + 改动点摘要 + 关键代码摘录）
- 是否全部按规范完成（若有偏离/坑，列出原因）
- 未完成/需主调度跟进项（无则写「无」）
- **禁止**回传大段无关 log、中间产物、思考过程
