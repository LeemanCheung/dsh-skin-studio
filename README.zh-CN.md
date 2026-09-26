# dsh-skin-studio

[English](README.md) | 中文

本地优先的 DSH 皮肤工作室，用于创建、审计、预览、持久化、导入和导出 `--dsw-alias-*` 明暗语义主题。

兼容 DeepSeek Harness `0.1.2-rc.1`；Client 包使用当前 Cordis Context、UI Renderer、Settings、Theme 与 Remote 合同。
Windows 界面实测结果见 [Windows DSH 0.1.2 验收记录](docs/WINDOWS_DSH_0.1.2_ACCEPTANCE.md)。

## 界面截图

![Skin Studio Token 编辑器与预览](https://raw.githubusercontent.com/LeemanCheung/dsh-skin-studio/main/assets/screenshots/overview.png)

> 使用 GPT Image 根据已实现的 Client 布局和功能生成；实际外观会随 DSH 主题和视口变化。

## 功能

- Settings → **皮肤工坊** 提供响应式皮肤库、语义 token 编辑器和明暗双预览，包含 6 套预设、锁定、撤销/重做、删除确认和手动颜色控制。
- 从不超过 10 MB、4000 万像素的 PNG/JPEG/WebP 图片中，以 128px 降采样和 OKLab k-means 提取最多 6 个可选色块；自动派生始终保留锁定 token。
- 检查正文、次要文本和品牌按钮的 WCAG AA 对比度，并自动修复未锁定的派生 token，包括必须从白色向深色调整的前景色。
- 通过 `storageDomain` 和生成的 Typert Remote 持久保存皮肤和当前激活状态；“保存并应用”会先保存当前草稿，再替换可逆主题覆盖。
- 支持严格 `.dshskin` JSON 导入/导出、停止预览、生成已声明 `theme` 依赖的 Client 入口源码和本地 PNG 分享卡。

## 数据与安全

`dshskin/v1` 最大 100 KB、最多 128 个语义 token，只允许严格元数据、六位十六进制颜色和指向已有 token 的唯一锁，并要求 DSH 当前使用的核心背景、文字、品牌与边框 token。导入只解析纯 JSON，且拒绝覆盖已有同 ID 皮肤，并拒绝未知字段、原型污染键、过深或超大数据、非法 token 名、脚本、CSS 选择器、URL、import、表达式和外部字体；导入数据绝不会执行。

Typert Remote 面向同一可信 DSH Web composition 中挂载的客户端，不是隔离不可信浏览器插件的授权层。

## 安装

```powershell
dsh plugin --profile web add github:LeemanCheung/dsh-skin-studio
```

安装后重启原有 DSH Web 进程并刷新页面。完整说明见[套件安装指南](../../INSTALL.zh-CN.md)。

## 模型体验

本插件不会增加模型提示、工具、消息、token 消耗或 KV cache 内容。调色板分析与主题预览在浏览器运行，通过校验的皮肤在 Host 持久保存。

## 已知限制

生成的插件源码只是供用户显式导出的文本，Skin Studio 不会安装或执行它。图片取色会把解码像素缩小到 128px，并只使用一个解码帧，因此不会保留动画和图片元数据。Remote CRUD 由同一 composition 中的可信客户端共享，不按浏览器包身份隔离。

## 开发

在仓库根目录运行 `corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build` 和 `corepack pnpm pack:check`。

CI 还会对比重建后的 `packages/dsh-skin-studio/lib` 与 `HEAD`，包含已暂存的改动，并拒绝未跟踪或被 Git 忽略的构建产物。CSS 模块标识使用包内相对路径，source map 保留源码和原有末尾换行，并统一为 LF。修改源码或构建逻辑时应一并提交重建后的 bundle。

MIT，见 [LICENSE](LICENSE)。
