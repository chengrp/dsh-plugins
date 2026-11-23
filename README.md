# dsh-plugins

[![validate](https://github.com/chengrp/dsh-plugins/actions/workflows/validate.yml/badge.svg)](https://github.com/chengrp/dsh-plugins/actions/workflows/validate.yml)

DSH（DeepSeek Harness）插件专题仓库。所有插件作品以独立包的形式集中在这里维护，新增插件只需按骨架复制、跑校验、提 PR，收录时各自指向对应的 `packages/<插件名>/` 子目录。

## 插件列表

| 插件 | 包名 | 版本 | 说明 |
| --- | --- | --- | --- |
| [prompt-library](packages/prompt-library) | `@chengrp/prompt-library` | 0.3.1 | 本地提示词收藏夹：侧边栏收集、标签、搜索、一键填入 |

## 目录约定

```
.
├── packages/<plugin>/       每个插件一个独立包（可独立打包为 .tgz）
│   ├── package.json         name 用 @chengrp/<plugin>，声明 dsh.bundle + dsh.client
│   ├── index.js             Host 半（可选，纯前端插件可省略）
│   ├── client.js            Web 半（window.__ModuleLoader__.load）
│   ├── cordis.patch.yml     bundle patch，id 与包名对应
│   ├── icon.svg             图标（≤256KiB，SVG/PNG/JPEG/WebP）
│   ├── locale/{zh,en}.json  meta.title / meta.description / meta.detail
│   ├── docs/                meta.detail 指向的详情文档
│   └── README.md            安装与用法
├── templates/minimal/       最小插件骨架（node scripts/new-plugin.mjs 生成）
├── scripts/                 校验 / 打包 / 脚手架工具
├── submissions/             awesome-dsh-plugin 收录条目留档
└── .github/workflows/        CI：对全部包跑校验
```

## 开发一个新插件

```bash
node scripts/new-plugin.mjs <plugin-name>       # 从 templates/minimal 生成包骨架
node scripts/validate.mjs                        # 校验所有包（CI 同款）
node scripts/pack.mjs packages/<plugin-name>     # 打包为可安装的 .tgz
```

校验规则（与 [awesome-dsh-plugin 投稿要求](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) 对齐）：

- 每个包必须有 `dsh.bundle`（仅有 `dsh.client` 会被市场 CI 拒绝）与 `dsh.client` 声明；
- `cordis.patch.yml` 的 id / name 与包名一致；
- `exports` 必须暴露 `.`、`./client`、`./locale/*.json`、`./icon`；
- `locale/zh.json` 或 `en.json` 至少其一，含 `meta.title` 与 `meta.description`；
- 图标存在且体积不超过 256 KiB；
- `package.json` 必须有 `repository` 指回本仓库、含 `dsh-plugin` 关键词、去掉 `private`。

## 安装

在 DSH 插件管理器中选择「安装本地包」，指向本仓库 Release 提供的 `.tgz`，或用 `scripts/pack.mjs` 自行打包。

## License

[MIT](LICENSE)
