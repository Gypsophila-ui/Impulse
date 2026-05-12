# Impulse - AI 驱动的 PDF 阅读助手

Impulse 是一个基于 Plasmo 的 Chrome 扩展，为 PDF 阅读提供强大的 AI 辅助功能，包括智能摘要、翻译、高亮、笔记、问答和元数据提取。

## ✨ 核心功能

### 📝 智能摘要 (Summary)
- 使用 LLM 自动生成选中文本的中文摘要
- 支持多种阅读目标配置（理解方法、总结观点等）

### 🌐 专业翻译 (Translation)
- 学术级别的中英互译
- 保留专业术语的准确性

### 🎯 智能高亮 (Highlight)
- AI 自动识别并提取关键内容
- 在页面上高亮显示关键短语
- 支持保存和管理高亮

### 📑 笔记管理 (Notes)
- 为选中内容添加笔记
- 按 URL 持久化存储
- 支持编辑和删除

### 💬 AI 问答 (Q&A)
- 基于选中内容进行对话
- 上下文感知的智能回答
- 支持多轮对话

### 📋 元数据提取 (Metadata)
- 自动识别论文标题、作者、年份等信息
- 智能提取摘要和关键词

### 🐛 智能 Bug 报告系统
- 自动捕获控制台错误和日志
- AI 诊断并建议修复方案
- 自动提取代码上下文
- 支持一键应用修复

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 开发模式

```bash
# 安装依赖
npm install
# 或
pnpm install

# 启动开发服务器
npm run dev
# 或
pnpm dev
```

打开浏览器，在 `chrome://extensions/` 中启用开发者模式，加载 `build/chrome-mv3-dev` 目录。

### 生产构建

```bash
npm run build
# 或
pnpm build
```

构建产物位于 `build/chrome-mv3-prod`，可直接打包发布。

## 🛠️ 配置

首次使用时，点击浏览器工具栏的扩展图标，在右侧边栏中配置 OpenAI API Key：
- 点击设置图标 ⚙️
- 输入 API Key
- 选择模型（GPT-4o-mini / GPT-4o / GPT-3.5-turbo）
- 可选配置自定义 Base URL

## 📁 项目结构

```
├── background.ts          # 后台服务，配置侧边栏
├── sidepanel.tsx          # 侧边栏主界面
├── options.tsx            # 选项页面
├── components/            # React 组件
│   ├── SummaryTab.tsx     # 摘要标签
│   ├── TranslationTab.tsx # 翻译标签
│   ├── HighlightTab.tsx   # 高亮标签
│   ├── NotesTab.tsx       # 笔记标签
│   ├── QATab.tsx          # 问答标签
│   ├── MetadataCard.tsx   # 元数据卡片
│   ├── BugReportModal.tsx # Bug 报告组件
│   └── common/            # 公共组件
├── contents/              # 内容脚本
│   ├── selection.ts       # 文本选择捕获
│   └── highlight.ts       # 页面高亮应用
├── utils/                 # 工具函数
│   ├── bug-report.ts      # Bug 报告系统
│   ├── code-context-extractor.ts # 代码上下文提取
│   ├── llm-client.ts      # LLM API 客户端
│   ├── storage.ts         # 存储管理
│   ├── i18n.ts            # 国际化
│   └── export.ts          # 导出功能
└── types/                 # TypeScript 类型定义
```

## 🔑 核心特性

### 自动文本同步
- 每 2 秒自动轮询页面选中的文本
- 支持跨 iframe 的文本捕获
- 用户也可直接粘贴文本

### 数据持久化
- 所有数据按 URL 存储在 chrome.storage.local 中
- 包括笔记、高亮、聊天记录、元数据

### 主题与国际化
- 支持浅色/深色主题切换
- 中英文双语界面

### 导出功能
- 将笔记、高亮、聊天记录导出为 Markdown 文件

## 📖 使用说明

1. 打开任意网页（特别是 PDF 页面）
2. 点击浏览器工具栏的 Impulse 图标打开右侧边栏
3. 选中页面中的文本
4. 选择相应的功能标签页
5. 点击对应的操作按钮

### 键盘快捷键
- `Alt + 1-5`：快速切换标签页
- `Alt + S`：摘要功能
- `Alt + T`：翻译功能
- `Alt + H`：高亮功能
- `Alt + C`：笔记功能
- `Alt + Q`：问答功能
- `Alt + E`：导出功能

## 🔧 技术栈

- **框架**: Plasmo + React 18
- **语言**: TypeScript
- **样式**: 原生 CSS
- **AI 服务**: OpenAI API（可自定义）
- **存储**: Chrome Storage Local


