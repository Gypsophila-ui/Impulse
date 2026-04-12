# Agent 系统改造可行性方案

> 目标：将 Q&A 标签页从简单对话升级为可调用工具的 Agent，使模型能主动执行摘要、翻译、高亮、笔记等操作，而非仅靠用户手动触发。

---

## 一、现状分析

### 当前 Q&A 架构

```
用户输入问题
  → chatWithContext(messages, paperContext)
    → openai.chat.completions.create({ messages })
      → 返回文字答案
```

问题：模型只能"说话"，不能"做事"。用户问"帮我把这段话保存为笔记"，模型只能回复建议步骤，无法真正调用 `saveNote()`。

### 现有能力清单（可直接暴露为工具）

| 已有函数 | 来源 | 可作为工具 |
|---|---|---|
| `summarize(text)` | llm-client.ts | ✅ |
| `translate(text)` | llm-client.ts | ✅ |
| `generateHighlights(text)` | llm-client.ts | ✅ |
| `extractMetadata(text)` | llm-client.ts | ✅ |
| `saveNote(text, comment, url)` | storage.ts | ✅ |
| `getNotesByUrl(url)` | storage.ts | ✅ |
| `saveHighlights(phrases, ...)` | storage.ts | ✅ |
| `getHighlightsByUrl(url)` | storage.ts | ✅ |
| `deleteChatSession(url)` | storage.ts | ✅ |

---

## 二、LangChain 可行性评估

### 2.1 浏览器兼容性

| 包 | 浏览器兼容 | 备注 |
|---|---|---|
| `@langchain/core` | ✅ | 无 Node.js 依赖，isomorphic |
| `@langchain/openai` | ✅ | 封装 OpenAI SDK，同样 isomorphic |
| `langchain`（完整包）| ⚠️ | 部分 loader/vectorstore 依赖 Node，需 tree-shaking |
| `AgentExecutor` | ✅ | 纯逻辑，无平台依赖 |
| `createToolCallingAgent` | ✅ | 基于 function calling，与平台无关 |
| `ConversationSummaryMemory` | ✅ | 纯内存操作 |

Chrome Extension MV3 的 sidepanel 运行在独立网页上下文（非 service worker），可以使用完整 Web API，**LangChain 技术上可以运行**。

### 2.2 Bundle 体积影响

项目当前通过 Plasmo/Parcel 打包，Chrome Web Store 限制 10MB。

| 方案 | 新增体积（min+gz 估算） | 说明 |
|---|---|---|
| 仅 `@langchain/core` + `@langchain/openai` | ~550 KB | 最小组合 |
| 完整 `langchain` + `@langchain/openai` | ~2–4 MB | 远超需要 |
| **原生 OpenAI SDK tool calling**（现有依赖） | **0 KB** | openai v6.33.0 已内置 |

### 2.3 LangChain 真正的价值对比

| LangChain 提供 | 本项目是否需要 | 替代方案 |
|---|---|---|
| 多 LLM 提供商抽象 | ⚠️ 部分需要 | 已通过自定义 baseURL 实现 |
| Tool 定义 + 调用循环 | ✅ 核心需求 | OpenAI SDK 原生 `tools` 参数已支持 |
| Document Loader / Splitter | ❌ | Chrome 不允许文件系统访问 |
| VectorStore / RAG | ❌ | 无本地向量数据库，quota 限制 |
| ConversationSummaryMemory | ✅ 有价值 | 可自行实现（~30行代码） |
| AgentExecutor 循环 | ✅ 需要 | 可自行实现（~50行代码） |

### 2.4 结论

**LangChain 可行，但性价比低。** 本项目真正需要的只是：
1. Tool calling 循环（OpenAI SDK 已原生支持）
2. 工具执行映射（5–10 个函数）
3. 上下文管理（可用滑动窗口或摘要压缩）

引入 LangChain 为了这三点增加 550KB+ 依赖，且在 DeepSeek/Qwen 等已通过 baseURL 支持的提供商上不会带来额外收益。

---

## 三、推荐方案：原生 Tool Calling Agent

### 3.1 架构设计

```
用户输入
  → agentChat(messages, context, tools)
    → 第一次 LLM 调用（携带 tools 定义）
      → 若返回 tool_calls：
          → 执行对应本地函数
          → 将结果作为 tool 消息追加
          → 第二次 LLM 调用（带工具结果）
      → 若返回普通消息：直接返回给用户
```

```
[用户] "帮我把这段话保存为笔记，标题是：方法论"
    ↓
[LLM]  tool_call: save_note({ text: "...", comment: "方法论" })
    ↓
[执行] saveNote(text, "方法论", currentUrl)
    ↓
[LLM]  "已为您保存笔记：方法论"
    ↓
[用户] 收到确认消息 + 笔记列表自动刷新
```

### 3.2 工具清单设计

```typescript
const PAPER_TOOLS: Tool[] = [
  {
    name: "save_note",
    description: "保存一条阅读笔记，关联当前选中的文本",
    parameters: {
      comment: "string  // 笔记内容"
    }
  },
  {
    name: "get_notes",
    description: "获取当前页面的所有已保存笔记",
    parameters: {}
  },
  {
    name: "apply_highlight",
    description: "将指定短语在页面上高亮显示并保存",
    parameters: {
      phrases: "string[]  // 要高亮的短语列表"
    }
  },
  {
    name: "get_highlights",
    description: "获取当前页面的所有高亮记录",
    parameters: {}
  },
  {
    name: "summarize_selection",
    description: "对当前选中文本生成摘要",
    parameters: {}
  },
  {
    name: "translate_selection",
    description: "翻译当前选中文本",
    parameters: {
      target_language: "string  // 目标语言，默认中文"
    }
  },
  {
    name: "extract_paper_metadata",
    description: "从当前选中文本提取论文元数据（标题、作者、年份等）",
    parameters: {}
  },
  {
    name: "search_notes",
    description: "在已保存笔记中搜索包含关键词的内容",
    parameters: {
      query: "string  // 搜索关键词"
    }
  }
]
```

### 3.3 上下文管理策略

当前方案：所有历史消息全部发送给 LLM（无压缩）。

改进方案（滑动窗口 + 摘要）：

```
保留最近 N 条消息（N=10）
+ 超出部分用 LLM 压缩为一段摘要
+ 摘要作为 system message 前置注入
```

实现成本：约 40 行代码，无需引入外部依赖。

---

## 四、实现路径

### Phase 1：实现 Tool Calling 核心（1–2天）

**修改 `utils/llm-client.ts`**：
- 新增 `agentChat(messages, context, toolExecutors)` 函数
- 实现 tool calling 循环（最多 5 轮，防止死循环）
- 定义 OpenAI `tools` JSON Schema

**新增 `utils/agent-tools.ts`**：
- 每个工具的 schema 定义
- 每个工具的执行函数（调用已有的 storage/llm 函数）
- `executeToolCall(name, args, context)` 分发器

**涉及文件**：
- `utils/llm-client.ts` — 新增 agentChat 函数
- `utils/agent-tools.ts` — 新文件，工具定义与执行
- `types/index.ts` — 新增 ToolCall, AgentMessage 类型

### Phase 2：升级 Q&A 标签页 UI（1天）

**修改 `sidepanel.tsx`**：
- Q&A 标签页调用 `agentChat` 替换 `chatWithContext`
- 工具执行过程显示中间状态（"正在保存笔记..."）
- 工具执行结果触发对应列表刷新（笔记/高亮）
- 增加 Agent 模式开关（可回退到普通对话）

### Phase 3：上下文管理优化（1天，可选）

**修改 `utils/llm-client.ts`**：
- 实现 `compressHistory(messages)` — 超过 10 条时生成摘要
- 摘要存入 `ChatSession.summary` 字段
- 修改 `utils/storage.ts` 的 `ChatSession` 类型

---

## 五、风险与注意事项

| 风险 | 影响 | 对策 |
|---|---|---|
| DeepSeek/Qwen 不支持 tool calling | Q&A Agent 功能降级 | 检测响应格式，降级为普通对话 |
| Tool calling 循环超出 token 限制 | API 费用上涨 | 限制最大轮数（5轮），截断历史 |
| `apply_highlight` 需要 content script 通信 | 工具执行需跨上下文 | 复用现有 `chrome.tabs.sendMessage` 机制 |
| 用户意图识别不准 | 误触发工具 | 工具描述精确化，关键操作加确认提示 |

---

## 六、不引入 LangChain 的理由汇总

1. **零新增依赖**：OpenAI SDK v6 已完整支持 `tools` / `tool_choice` / `tool_calls`
2. **体积**：节省 ~550KB bundle 体积
3. **控制权**：直接操作 chrome.storage、content script 消息，无需适配 LangChain 抽象
4. **兼容性**：DeepSeek/Qwen 已通过 baseURL 支持，不需要 LangChain 的提供商抽象
5. **可维护性**：减少间接依赖，调试链路更短

**若未来需要 LangChain**，最小引入路径为：
```
npm install @langchain/core @langchain/openai
```
仅替换 `agentChat` 内部实现，接口对外不变。

---

## 七、验收标准

- [ ] 用户可以用自然语言触发保存笔记（"帮我记录这个观点"）
- [ ] 用户可以用自然语言触发高亮（"高亮这段的关键概念"）
- [ ] 工具执行期间显示进度状态
- [ ] 工具执行后对应列表（笔记/高亮）自动刷新
- [ ] DeepSeek/Qwen 下优雅降级为普通对话（不崩溃）
- [ ] 对话历史超过 10 条后自动压缩，不影响回答质量
