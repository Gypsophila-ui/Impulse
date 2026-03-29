# Impulse 开发计划

## 1. 项目概述

**项目名称**：Impulse  
**项目类型**：Chrome 扩展程序（Plasmo 框架，Manifest V3）  
**核心功能**：PDF 论文阅读助手 - 在右侧边栏提供摘要、翻译、高亮、评论功能  
**目标用户**：学术研究人员、研究生、需要阅读英文论文的用户

## 2. 当前状态

### 已完成功能
- [x] 基础项目结构搭建（Plasmo + React）
- [x] 右侧边栏 UI（四个 Tab：summary / translation / highlight / comment）
- [x] PDF 页面选中文本获取（包含 arXiv PDF 兼容性修复）
- [x] 侧边栏自动打开配置

### 待实现功能（占位状态）
- [ ] Summary：调用 LLM 生成选中文本摘要
- [ ] Translation：调用 LLM 翻译选中文本
- [ ] Highlight：生成高亮建议并映射回页面
- [ ] Comment：保存笔记并关联选中文本

### 技术债务
- 大量调试日志代码（`fetch("http://127.0.0.1:7737/...")`）需要清理
- 缺少单元测试和 E2E 测试
- 缺少 TypeScript 严格检查配置

---

## 3. 开发路线图

### Phase 1：核心功能 MVP（短期）

**目标**：完成基础功能可用版本

| 序号 | 任务 | 依赖 | 预估工作量 |
|------|------|------|------------|
| 1.1 | 接入 LLM API（OpenAI / Anthropic / 本地模型） | - | 2-3 天 |
| 1.2 | 实现 Summary 功能：调用 LLM 生成摘要 | 1.1 | 1 天 |
| 1.3 | 实现 Translation 功能：调用 LLM 翻译 | 1.1 | 1 天 |
| 1.4 | 添加 API Key 配置界面 | - | 0.5 天 |
| 1.5 | 清理调试日志代码 | - | 0.5 天 |
| 1.6 | 本地测试与 bug 修复 | 1.2-1.5 | 1-2 天 |

**交付物**：可用的论文摘要和翻译功能

---

### Phase 2：增强功能（中长期）

**目标**：丰富阅读体验，支持高亮和笔记

| 序号 | 任务 | 依赖 | 预估工作量 |
|------|------|------|------------|
| 2.1 | 实现 Highlight 功能：生成高亮建议 | Phase 1 完成 | 2-3 天 |
| 2.2 | 实现 DOM 定位：将高亮映射回 PDF 页面 | 2.1 | 2-3 天 |
| 2.3 | 实现 Comment 功能：笔记保存与读取 | Phase 1 完成 | 2 天 |
| 2.4 | 添加本地存储（chrome.storage） | 2.3 | 1 天 |
| 2.5 | 支持多语言 UI（英文/中文切换） | - | 0.5 天 |

**交付物**：完整的高亮和笔记功能

---

### Phase 3：高级功能（长期）

**目标**：智能化阅读体验

| 序号 | 任务 | 依赖 | 预估工作量 |
|------|------|------|------------|
| 3.1 | 论文元数据提取（标题、作者、年份） | - | 1-2 天 |
| 3.2 | 论文结构解析（章节、参考文献） | 3.1 | 2-3 天 |
| 3.3 | 问答功能（针对论文内容提问） | Phase 1 完成 | 3-5 天 |
| 3.4 | 多平台支持（Chrome、Edge、Firefox） | - | 2-3 天 |
| 3.5 | 账号同步（云端保存笔记和高亮） | - | 3-5 天 |

**交付物**：完整的 AI 论文阅读助手

---

## 4. 技术架构

### 4.1 目录结构

```
Impulse/
├── assets/               # 静态资源（图标等）
├── contents/            # Content scripts（注入到页面）
│   └── selection.ts     # 选中文本获取
├── docs/                # 文档
├── utils/               # 工具函数
│   └── get-selection.ts # 跨 frame 选中文本获取
├── background.ts        # Service Worker（后台逻辑）
├── sidepanel.tsx        # 侧边栏主界面
├── package.json         # 项目配置
└── tsconfig.json        # TypeScript 配置
```

### 4.2 关键技术点

- **框架**：Plasmo + React 18
- **存储**：chrome.storage.local（本地存储）
- **API**：chrome.scripting（跨 frame 注入）
- **侧栏**：chrome.sidePanel（右侧边栏）
- **LLM**：支持 OpenAI GPT / Anthropic Claude（可扩展）

### 4.3 PDF 兼容性

项目已处理的 PDF 场景：
- 直接打开的 PDF（`https://arxiv.org/pdf/*`）
- 嵌入的 PDF（iframe、embed）
- 多 frame 结构的 PDF 查看器

关键配置：
- `all_frames: true`：注入到所有 frame
- `match_origin_as_fallback: true`：处理跨域嵌入
- `world: "MAIN"`：直接访问页面 DOM

---

## 5. 开发规范

### 5.1 代码风格

- 使用 TypeScript（严格模式）
- React 函数组件 + Hooks
- ESLint + Prettier 格式化
- 避免内联样式，优先使用 CSS 类

### 5.2 提交规范

```
feat: 新功能
fix: bug 修复
docs: 文档更新
refactor: 代码重构
chore: 构建/配置更新
```

### 5.3 测试策略

- 单元测试：Jest + React Testing Library
- E2E 测试：Playwright
- 手动测试清单：见 docs/testing-checklist.md

---

## 6. 待讨论事项

1. **LLM 提供商选择**：
   - OpenAI GPT-4（效果好，费用中等）
   - Anthropic Claude（效果好，费用较低）
   - 开源模型（本地部署，成本低）
   - 是否需要支持多提供商？

2. **功能优先级**：
   - 是否优先实现 QA 问答功能？
   - 笔记是否需要云端同步？

3. **发布计划**：
   - MVP 版本发布时间？
   - 是否先发布到 Chrome Web Store？

---

## 7. 参考资料

- [Plasmo 官方文档](https://docs.plasmo.com/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions)
- [PDF 阅读 API 参考](docs/chrome-extension-pdf-reading-api.md)
