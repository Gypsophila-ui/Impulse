# Impulse 开发计划

## 1. 项目概述

**项目名称**：Impulse  
**项目类型**：Chrome 扩展程序（Plasmo 框架，Manifest V3）  
**核心功能**：PDF 论文阅读助手 - 在右侧边栏提供摘要、翻译、高亮、评论功能  
**目标用户**：学术研究人员、研究生、需要阅读英文论文的用户

## 2. 当前状态

### 已完成功能
- [x] 基础项目结构搭建（Plasmo 0.90.5 + React 18.2.0 + TypeScript 5.3.3）
- [x] 右侧边栏 UI（四个 Tab：summary / translation / highlight / comment）
  - 文件：`sidepanel.tsx` (430 行)
  - 包含状态管理、Tab 切换、选中文本展示
- [x] PDF 页面选中文本获取（包含 arXiv iframed PDF 兼容性）
  - 文件：`utils/get-selection.ts` (150 行)
  - 跨 frame 选中文本提取，使用 `allFrames: true`
  - 支持 ISOLATED 和 MAIN world 双模式回退
- [x] PDF URL 自动检测
  - 文件：`background.ts` (136 行)
  - `isProbablyPdfUrl()` 启发式检测
- [x] 侧边栏生命周期管理
  - 文件：`background.ts`
  - Tab 更新监听、用户手势触发

### 已完成功能（Phase 1）✅
- [x] Summary：调用 LLM 生成选中文本摘要
  - 文件：`sidepanel.tsx` - 已集成 OpenAI API
- [x] Translation：调用 LLM 翻译选中文本
  - 文件：`sidepanel.tsx` - 已集成 OpenAI API
- [x] LLM API 客户端封装（`utils/llm-client.ts`）
  - 功能：`summarize()`, `translate()` 方法
  - 使用 OpenAI GPT-4o-mini（默认）
- [x] chrome.storage 封装（`utils/storage.ts`）
  - 功能：`saveLLMConfig()`, `getLLMConfig()`, `hasApiKey()`, `clearConfig()`
- [x] API Key 配置页面（`options.tsx`）
  - 界面：API Key 输入、模型选择
  - 模型选项：GPT-4o-mini / GPT-4o / GPT-3.5-turbo
- [x] 权限修复
  - 添加 `activeTab` 权限（关键）
  - 添加 `file://*/*` 支持本地 PDF
  - 添加 `storage` 权限
- [x] **UI/UX 优化升级** (2026-04-02)
  - 现代化渐变色设计（紫色主题）
  - 精美的 Tab 切换动画
  - 加载状态 Spinner 组件
  - Hover 交互效果
  - 友好的错误提示
  - 图标和 Emoji 增强视觉体验
  - Options 页面全新设计（卡片式布局、show/hide API key）
  - 响应式布局优化

### 待实现功能（Phase 2）
- [ ] Highlight：生成高亮建议并映射回页面
  - 位置：`sidepanel.tsx` - 需要 DOM 定位和注入
- [ ] Comment：保存笔记并关联选中文本
  - 位置：`sidepanel.tsx` - 需要持久化存储方案

### 技术债务
- **依赖管理**
  - ✅ 已安装 OpenAI SDK (v6.33.0)
  - 无 ESLint 配置
  - 无测试框架（Jest/Playwright）
- **TypeScript 配置**
  - 未启用 strict mode
  - 大量 `any` 类型在错误处理中
- **文档缺失**
  - `docs/testing-checklist.md` 被引用但不存在

---

## 3. 开发路线图

### Phase 1：核心功能 MVP（短期）

**目标**：完成基础功能可用版本

#### 任务优先级排序

**P0（阻塞性）- 已完成 ✅**
- [x] Task 1.0: 清理调试日志代码（16 处）
  - 状态：✅ 已完成 (2026-04-02)
  - 影响：生产环境不能有这些日志
  - 文件：`background.ts`, `sidepanel.tsx`, `utils/get-selection.ts`, `contents/selection.ts`
  - 操作：删除所有 `#region` ... `#endregion` 包裹的 fetch 调用

**P1（核心功能）- 已完成 ✅**
- [x] Task 1.1: 安装 LLM SDK 依赖
  - 状态：✅ 已完成 (2026-04-02)
  - 安装：`npm install openai` (v6.33.0)

- [x] Task 1.2: 创建存储工具 (`utils/storage.ts`)
  - 状态：✅ 已完成 (2026-04-02)
  - 功能：封装 `chrome.storage.local` API
  - 方法：`saveLLMConfig()`, `getLLMConfig()`, `hasApiKey()`, `clearConfig()`

- [x] Task 1.3: 创建 LLM 客户端 (`utils/llm-client.ts`)
  - 状态：✅ 已完成 (2026-04-02)
  - 功能：封装 OpenAI API 调用
  - 方法：`summarize(text)`, `translate(text, targetLang)`, `resetClient()`
  - 错误处理：配置缺失、API 失败

- [x] Task 1.4: 创建配置页面 (`options.tsx`)
  - 状态：✅ 已完成 (2026-04-02)
  - 功能：API Key 输入和保存、模型选择
  - UI：表单（API Key 输入框 + 模型下拉 + 保存按钮）

- [x] Task 1.5: 实现 Summary 功能
  - 状态：✅ 已完成 (2026-04-02)
  - 文件：`sidepanel.tsx`
  - 替换 TODO 为实际 LLM 调用
  - 添加加载状态、错误处理
  - 依赖：Task 1.3

- [x] Task 1.6: 实现 Translation 功能
  - 状态：✅ 已完成 (2026-04-02)
  - 文件：`sidepanel.tsx`
  - 替换 TODO 为实际 LLM 调用
  - 目标语言默认为中文

- [x] Task 1.7: 修复文本选择 Bug
  - 状态：✅ 已完成 (2026-04-02)
  - 问题：在 PDF 页面选中文字无法在侧边栏显示
  - 修复：添加 `activeTab`, `file://*/*`, `http://*/*` 权限
  - 改进：更清晰的错误提示信息

**P2（优化）- 可选**
- [ ] Task 1.8: 添加 TypeScript 类型定义 (`types/index.ts`)
  - 接口：`LLMConfig`, `ApiResponse`, `StorageData`

- [ ] Task 1.9: 本地测试与 bug 修复
  - 测试场景：arXiv PDF、本地 PDF、Google Drive PDF
  - 检查：选中文本、摘要生成、翻译功能

- [ ] Task 1.10: 优化用户体验
  - 添加加载动画
  - 改进错误提示
  - 添加重试机制

**交付物**：
- ✅ 无调试日志的干净代码
- ✅ 可配置 API Key 的设置页面
- ✅ 可用的论文摘要功能
- ✅ 可用的论文翻译功能

**预估总工时**：2-3 天（假设每天 6-8 小时有效开发时间）

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
