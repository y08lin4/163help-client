# 163help-client 🎵

网易云音乐互助客户端 **5.0**（monorepo：一个核心三端复用）

| 端 | 说明 | 使用 |
|---|---|---|
| 油猴 | `dist/music-help.user.js`（28KB 单文件） | https://163music.linyu.qzz.io/music-help.user.js |
| 扩展 | `dist/163help-extension-v5.0.0.zip`（MV3） | https://163music.linyu.qzz.io/extension-upgrade.html |
| Docker | `ghcr.io/y08lin4/163help-client/docker-client`（latest / docker-v5.0.0） | 见下方命令 |

## Docker 部署（宿主端口 13000）
```bash
docker run -d --name 163music-docker-client --restart unless-stopped --memory 1g \
  -e UI_PASSWORD='你的强密码' -e TZ=Asia/Shanghai -p 13000:3000 -v ./data:/data \
  ghcr.io/y08lin4/163help-client/docker-client:docker-v5.0.0
```
管理端：`http://IP:13000`（UI_PASSWORD 登录；粘贴网易云 Cookie + portal `mh_ck_` 密钥）

## 核心设计（5.0）
- **严格心跳**：无心跳=无效播放=重听（不做补结算）
- **UI**：网易云风白卡红标（`#EC4141`）；暗色跟随官方灰黑
- **错误日志自动上报**：`POST /api/client/log`（限流+双层脱敏；后台「客户端日志」页可查）
- 架构：`packages/core`（TS 逻辑）+ `packages/ui`（原生 WebComponent）+ `apps/*`（三端壳）

## 构建 / 发布
```bash
bash scripts/release.sh            # zip + user.js（GitHub Actions v5* tag 自动执行）
# docker 镜像：tag docker-v5.0.0 自动构建推送 GHCR
```