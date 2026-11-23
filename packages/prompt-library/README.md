# prompt-library

DSH（DeepSeek Harness）插件：本地提示词收藏夹。

在侧边栏底部与输入框工具栏提供入口，可新建 / 编辑 / 删除常用提示词，支持标签筛选、搜索与使用频率统计，一键填入当前会话输入框。所有数据仅保存在本机 DSH 存储域（`prompt_library`），不联网、不同步。

## 安装

### 方式一：从 GitHub Release 安装（推荐）

在 DSH 的插件管理器里选择本地包安装，下载本仓库 [Releases](https://github.com/chengrp/dsh-plugins/releases) 中对应版本的 `prompt-library-<版本>.tgz`。

### 方式二：从源码安装

```bash
# 在本 monorepo 根目录
node scripts/pack.mjs packages/prompt-library
# 生成 chengrp-prompt-library-<版本>.tgz，再用 DSH 插件管理器安装
```

### 方式三：纳入插件市场

本包已按 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 monorepo 子包规范提交收录条目，合并后可在 dshmarket 中搜索安装。

## 结构说明

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：注册本地存储域与 `/api/prompt-library.*` 路由 |
| `client.js` | Web 半：注册 `sidebar.footer.action` 与 `conversation.input.left` 两个 slot |
| `cordis.patch.yml` | 声明 DSH bundle 插件条目 |
| `locale/{zh,en}.json` | 展示元数据（标题 / 描述 / 详情） |
| `docs/DETAIL.md` | 插件详情文档 |

## 版本

`0.3.1` — 原 `@local/prompt-library`，迁入本 monorepo 后改为 `@chengrp/prompt-library`；内部存储域名与 API 路由名保持不变，已收藏的数据不受影响。
