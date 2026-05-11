# Impulse 变更文档：智能报错与自修复系统

## 概述

为 Impulse 引入了一套 **AI 驱动的报错诊断与自修复系统**。当扩展发生错误时，系统会自动收集诊断上下文，交由 AI 分析根因并尝试自动修复，而非仅导出数据等待人工排查。

## 新增文件

### `utils/bug-report.ts` — 诊断数据采集与 AI 分析

- **控制台拦截器**：环形缓冲区捕获最近 200 条 `console.log/warn/error`，同时 hook `window.onerror` 和 `window.onunhandledrejection`
- **`collectBugReport()`**：一键采集扩展版本、用户代理、API 配置（已脱敏）、UI 状态、页面上下文、数据摘要、控制台日志、错误历史
- **`diagnoseWithAI()`**：将采集到的诊断数据发送给 LLM 分析，返回结构化的 `DiagnosisResult`：
  - `rootCause` — 根因分析
  - `suggestedFix` — 修复建议
  - `autoFixAction` — 可执行的自动修复动作（`clear_data` / `reset_config` / `retry` / `switch_model` / `none`）
- **`downloadBugReport()`** / **`formatBugReportAsMarkdown()`**：导出 JSON / Markdown

### `contents/bug-report.ts` — 页面级信息采集

- 响应 `COLLECT_PAGE_INFO` 消息
- 采集页面 URL、标题、Impulse 高亮标记数量、PDF 查看器检测、文档就绪状态

### `components/BugReportModal.tsx` — AI 诊断面板

- 打开后**自动触发 AI 诊断**（显示分析动画 → 诊断结果卡片）
- **根因卡片**（黄色）：展示 AI 分析的问题根因
- **修复建议卡片**（绿色）：展示 AI 建议的修复步骤
- **一键修复按钮**：当 AI 判断问题可自动修复时，显示"Apply Fix"按钮
- **修复结果反馈**：成功/失败状态提示
- **可折叠详情区**：用户补充描述文本、重新分析按钮、数据预览、下载/复制 JSON

## 修改文件

### `components/common/ErrorAlert.tsx`

| 变更 | 说明 |
|------|------|
| 新增 `onDiagnose` prop | 可选回调，传入时显示诊断按钮 |
| 新增 **"Diagnose" 按钮** | 紫色按钮带 Sparkles 图标，点击触发 AI 诊断 |

### `components/common/Header.tsx`

| 变更 | 说明 |
|------|------|
| 新增 `Bug` 图标导入 | 来自 lucide-react |
| 新增 `onReportBug` prop | 回调函数 |
| 新增 **Bug 按钮** | 位于 Settings 与 Export 之间，点击打开 AI 诊断面板 |

### `sidepanel.tsx`

| 变更 | 说明 |
|------|------|
| 控制台拦截 | `useEffect` 中启动/停止 `startConsoleInterception` |
| `showBugReport` 状态 | 控制诊断面板显隐 |
| `handleApplyFix()` | 执行 AI 建议的自动修复动作 |
| 传递 `onDiagnose` 给 ErrorAlert | 错误横幅可触发诊断 |
| 传递 `onApplyFix` 给 BugReportModal | 诊断面板可执行修复 |

### `components/index.ts`

- 新增 `BugReportModal` 导出

## 自动修复能力

| 修复动作 | 触发条件 | 执行操作 |
|----------|----------|----------|
| `clear_data` | 存储数据疑似损坏 | 清除当前 URL 的高亮、聊天、笔记，并重新加载 |
| `reset_config` | API 配置错误 | 清除 API Key 配置，打开配置面板重新设置 |
| `retry` | 临时性错误（网络超时等） | 刷新当前标签页 |
| `switch_model` | 当前模型不兼容 | 打开配置面板切换模型 |

## 交互流程

```
错误发生 → ErrorAlert 显示 + "Diagnose" 按钮
              │
              ├─ 用户点击 "Diagnose" → 打开 AI 诊断面板
              │       │
              │       ├─ 自动采集上下文 → 发送 LLM 分析
              │       ├─ 展示根因 + 修复建议
              │       ├─ "Apply Fix" → 自动执行修复
              │       └─ 或 下载/复制 JSON 报告
              │
              └─ 用户点击 Header 中的 🐛 按钮（同上流程）
```

## 设计原则

- **零手动采集**：所有诊断数据在模态框打开时自动采集，无需用户操作
- **AI 优先诊断**：默认展示 AI 分析结果，原始数据放于可折叠区域
- **渐进式修复**：AI 先分析 → 建议修复 → 用户确认 → 自动执行
- **隐私安全**：API Key 在报告中自动脱敏，仅标记"已配置/未配置"
