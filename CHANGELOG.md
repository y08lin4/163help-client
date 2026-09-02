# CHANGELOG

## 5.0.0 (2026-09-02) —— 三端整体重构
- 新架构：monorepo（core/ui/三端），一个核心三端复用
- 严格心跳协议：30s 无首心跳放弃 / 45s 心跳中断放弃 / 冻结恢复续听；无心跳=无效重听
- UI 全新：网易云风白卡红标（跟随页面亮/暗主题），默认 44px 红圆球收起
- 客户端错误日志自动上报（error 即时/warn 聚类/双层脱敏；后台「客户端日志」页）
- 修复：nonce 重放 403、finish 缺 token、掉登录自检引导、全量中文文案
- 发布链：GitHub Actions 自动构建（zip+user.js+docker 镜像），verify-release.sh 8 项验收