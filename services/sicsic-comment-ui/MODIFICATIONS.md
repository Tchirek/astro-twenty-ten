# Changes / 修改摘要

Relevant modification date / 相关修改日期: 2026-09-07

SicSic is derived from BeiyanYunyi/Sodesu v0.5.2 and keeps the upstream AGPL
license obligations. This file summarizes the product-level changes.

SicSic 基于 BeiyanYunyi/Sodesu v0.5.2 修改，并继续遵守上游 AGPL 协议要求。本文只保留
产品级修改摘要。

## Current Product / 当前产品

2026-08-28 restores cross-origin Passport continuation through a click-only,
first-party account popup. A canonical HttpOnly cookie, single-use PKCE codes
and exact window/origin/state checks connect Blog and Pics/Docs without sharing
localStorage or adding a comment iframe. Google initialization is browser-bound;
proof-bound polling survives opener isolation. Shared logout has a D1 revocation
barrier. Existing comment/profile visuals and account customization are unchanged.

2026-08-28 补回跨站通行证：仅点击身份入口时启用账户源顶层弹窗，以 HttpOnly
Cookie、一次性 PKCE 授权码及精确窗口／来源／state 校验接续登录。Google 启动
绑定当前浏览器，结果轮询不依赖 opener。退出撤销由 D1 阻止共享会话复活。
不重加 Blog 评论 iframe，不改评论／账户界面，不移除头像或徽章功能。

The 2026-08-27 refactor replaces Blog's iframe with host-native core DOM and
Blog-owned Twenty Ten CSS. Passport is a dynamic identity module; the frame
adapter retains the Pics/Docs panel and strict parent-origin checks. Comment
reading does not initialize accounts, request profiles or create viewer IDs.
Viewer continuity is tab-scoped and action-triggered. B/I/Preview and the existing
comment/panel visual output are retained, with old screenshot baselines.
Custom avatars and badges follow current account settings on old and new comments;
only historical text bylines are preserved. No avatar/badge snapshot migration.

2026-08-27 重构将 Blog 从 iframe 切换到宿主 DOM，Twenty Ten CSS 由 Blog 持有；
Passport 按身份交互加载，frame 保留 Pics/Docs 面板。普通阅读不初始化账户、不请求
Profile、不生成 viewer ID；匿名连续性仅在操作后按标签页保留。保留 B/I/Preview
与原有评论、面板视觉，不借重构重设计。
自定义头像和徽章在新旧评论中均跟随账户当前设置；仅文字署名保留历史记录，
不做头像／徽章冻结快照或迁移。

The original iframe-specific notes below describe the pre-refactor product;
`iamtchirek` presets and `skin` mode switches are now removed. Current contracts,
non-goals and backend rollout gates are in `INTEGRATION.md` and `THREAT_MODEL.md`.

## Before the inline refactor / 重构前

- This directory is the deployed iframe comment product.
- Markdown/GFM preview, replies, likes, and admin deletion are kept.
- Attachment upload is removed.
- Anonymous commenting remains the default path.
- Accounts are optional and only appear for auth-capable backends.
- Root comments are ranked by liked status, like count, then recency.
- Runtime integration uses strict `postMessage` origin checks.
- The `iamtchirek` presets add an isolated WordPress Twenty Ten comment skin,
  including its comment list and block-editor-style composer.
- The Twenty Ten embed reveals its editor shell before the first comment
  response and keeps threads chronological; other skins retain ranked roots.
- Footer attribution is `Powered by SicSic` in the default skins. The Twenty Ten
  skin hides the product footer; upstream Sodesu attribution remains in source
  and license material.
- Each build publishes its exact corresponding source as
  `/sicsic-comment-ui-source.tar.gz`.

- 本目录是实际部署的 iframe 评论产品。
- 保留 Markdown/GFM 预览、回复、点赞和管理员删除。
- 移除评论附件上传。
- 匿名评论仍是默认路径。
- 账户能力可选，只有支持认证的后端才显示账户入口。
- 根评论按是否被赞、点赞数、时间排序。
- 运行时集成严格校验 `postMessage` 来源。
- `iamtchirek` presets 使用隔离的 WordPress Twenty Ten 评论样式，包括评论列表和
  区块编辑器式留言面板。
- Twenty Ten 嵌入会在首次评论请求返回前先显示编辑器外壳，并按时间排列评论；其他
  皮肤继续使用根评论排序。
- 默认皮肤页脚显示 `Powered by SicSic`；Twenty Ten 皮肤隐藏产品页脚，上游
  Sodesu 署名仍保留在源码与协议材料中。
- 每次构建都会在 `/sicsic-comment-ui-source.tar.gz` 发布该版本对应源码。

## 2026-09-07

Replace account/password/logout popup transport with credentialed same-site session requests. Open only Google directly, retaining browser nonce and PKCE result validation. Point frame attribution to the public SicSic repository; continue shipping the corresponding-source archive.

v0.1.2 shows the account dialog before session lookup completes, with a 200 ms login-form fallback and draft protection. Hover/focus preloads only the UI module; network identity lookup still requires account activation.

v0.1.3 removes the intermediate status card and timer. The complete login form or known account appears immediately; session restoration stays in the background and preserves active input.
