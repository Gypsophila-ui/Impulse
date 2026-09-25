## Plan: 论文上下文管理改造

将当前单一 `paperContext: string` 改造成可追溯、可检索、受 token 预算控制的论文上下文系统。第一阶段采用本地结构化切块 + 关键词/章节检索 + 分层摘要，不引入外部 embedding 服务；Agent 默认输出章节/页码证据，并保留后续接入向量检索的接口边界。

**Steps**

### 阶段一：数据模型与论文切块
1. 新增论文上下文类型：`PaperChunk`、`PaperDocument`、`PaperSectionSummary`、`RetrievedContext`，至少包含 chunk id、URL、章节路径、页码起止、顺序、文本、关键词和可选摘要。扩展 `ChatSession`，兼容旧的 `paperContext` 字段，同时增加文档版本/切块元数据。
2. 改造 `utils/reading/pdf-extractor.ts`：保留 PDF.js 的页级提取，但输出结构化页对象或可被切块器消费的中间结果；在句子/段落边界切分，默认 chunk 目标约 500-1000 token，设置有限 overlap，不能切断表格/公式标记和页码信息；参考章节标题识别，识别失败时退化为页级标题。
3. 新增独立的上下文模块（建议 `utils/reading/paper-context.ts`）：负责章节识别、段落切块、重叠、字符/token 预算估算、chunk 去重和文档哈希。该模块必须是纯函数优先，便于后续测试。

### 阶段二：索引、摘要与持久化
4. 新增本地轻量索引：为每个 chunk 生成规范化关键词/词频，支持标题、术语、数字和章节路径加权；第一阶段不引入向量数据库。检索接口返回 chunk 及匹配分数、匹配原因和来源信息，并预留 `embedding`/`semanticScore` 字段但不实现远程 embedding。
5. 增加分层摘要流程：先按 chunk 生成短摘要，再按章节合并为章节摘要，最后生成全文摘要；每个摘要保存来源 chunk id，限制摘要长度和输入预算。生成失败时保留原文检索能力，不阻塞论文阅读。
6. 扩展 `utils/storage/storage.ts` 的会话/论文存储：按 URL 保存文档哈希、chunk 元数据、章节摘要、全文摘要和当前摘要版本；避免每次会话把完整论文文本重复写入多个历史记录。旧会话读取时从 `paperContext` 做一次兼容迁移或暂时退化到单上下文模式。

### 阶段三：接入 Agent 请求路径
7. 改造 `components/AgentView.tsx`：PDF 加载后建立/恢复论文上下文索引，而不是只设置一段全文字符串；用户每次提问前将问题、选中文本、阅读目标传给检索器，选择少量 Top-K chunk，并保留必要的相邻 chunk 和章节摘要。
8. 改造 `utils/agent/llm-client.ts`：将 `agentChat`/`chatWithContext` 的 `paperContext` 参数逐步替换为 `RetrievedContext`；系统提示只注入全文摘要、当前问题相关 chunk、章节/页码元数据和受限的历史摘要，不再每轮注入完整论文全文。保留最近 10 条消息 + 压缩摘要，并为上下文设置统一 token budget。
9. 在 Agent 指令和响应处理上增加证据约束：要求关键结论引用 chunk 的章节/页码；区分“原文事实、跨段落归纳、模型推断”；检索不到充分证据时明确回答信息不足。工具调用结果只保留必要摘要，避免多轮工具结果无限增长。
10. 为摘要、检索、证据和失败场景增加状态信息：显示论文已索引/部分索引/截断状态，显示回答引用来源；网络或模型失败时退化为已有选中文本/章节摘要/旧版全文模式，不影响基础聊天。

### 阶段四：验证与后续扩展
11. 为纯函数切块器、检索器、token 预算器和证据格式化增加单元测试；覆盖短论文、超长论文、跨页段落、重复标题、空页、表格/公式文本、中文/英文混排和没有命中结果。
12. 增加集成验证：检查从 PDF 加载到 Agent 请求的实际 payload 大小、最近对话压缩、会话恢复、旧数据兼容、工具调用最多 5 轮以及检索结果来源完整性。
13. 使用现有 `npm run build` 和 `bash test-suite.sh` 做静态/构建验证；补充一份手工验收清单，至少包含：长论文总体总结、方法细节问题、跨章节问题、论文没有提及的问题、章节冲突和重复追问。
14. 后续可在不改变 Agent 接口的情况下实现 embedding：新增 `SemanticRetriever` 与当前本地检索器组合为混合召回，使用同一 `RetrievedContext` 和证据链，不改动 UI 和会话协议。

**Relevant files**
- `d:/GitHub/Impulse/utils/reading/pdf-extractor.ts` — 保留 PDF.js 提取和页码边界，改造为可生成结构化中间结果。
- `d:/GitHub/Impulse/utils/reading/paper-context.ts` — 新增切块、章节识别、关键词索引、检索、预算和文档哈希的核心模块。
- `d:/GitHub/Impulse/utils/agent/llm-client.ts` — 改造 Agent/普通聊天的上下文组装、摘要压缩、证据约束和 token 预算。
- `d:/GitHub/Impulse/components/AgentView.tsx` — 管理 PDF 索引生命周期、当前问题检索和上下文状态。
- `d:/GitHub/Impulse/utils/storage/storage.ts` — 持久化文档索引、摘要版本和会话兼容迁移，避免保存重复全文。
- `d:/GitHub/Impulse/types/index.ts` — 增加论文 chunk、文档、检索上下文和证据相关类型，扩展 `ChatSession` 兼容旧字段。
- `d:/GitHub/Impulse/sidepanel.tsx` — 如需恢复新索引/摘要状态或展示上下文状态，在现有 URL 会话加载和 Agent props 传递处接入。
- `d:/GitHub/Impulse/package.json` — 第一阶段不新增运行时依赖；若补测试框架，再在此增加最小开发依赖和脚本。
- `d:/GitHub/Impulse/test-suite.sh` — 增加核心模块存在性/构建前检查，但不把 shell 文本检查当作唯一正确性保证。
- `d:/GitHub/Impulse/docs/DEVELOPMENT_PLAN.md` 或新增上下文设计文档 — 记录检索策略、token 预算、兼容策略和后续 embedding 扩展边界。

**Verification**
1. 对 `paper-context.ts` 的纯函数测试：固定输入论文文本，断言 chunk 不超过预算、页码/章节保留、overlap 有限、chunk 顺序稳定、重复段落去重正确。
2. 检索测试：方法问题命中方法章节，实验问题命中实验章节，关键词和章节标题能提高排序；无命中时返回明确的低置信度/信息不足状态。
3. 摘要测试：章节摘要和全文摘要均限制长度，并保留来源 chunk id；摘要失败后仍能检索原文。
4. Agent 集成测试：单次请求 payload 不包含完整论文全文，只包含全文摘要、相关 Top-K chunk、受限消息历史和来源元数据；超过历史阈值后只保留最近 10 条及摘要。
5. 会话兼容测试：旧版 `ChatSession.paperContext` 可读取；新会话恢复后使用文档哈希和摘要/索引，不重复重新抽取同一 PDF。
6. 构建验证：运行 `npm run build`；运行 `bash test-suite.sh`，并修正其中与当前目录结构不一致的旧路径检查。
7. 手工验收：使用一篇超过当前 6 万字符限制的论文，验证总体总结、方法细节、跨章节追问、无证据问题、冲突信息和引用页码均能得到可追溯回答。

**Decisions**
- 第一阶段选择本地关键词/章节检索，不接入 embedding API，降低扩展隐私、成本和配置复杂度。
- 回答默认显示章节/页码证据；证据不足时明确说明，不强行补全。
- 保留现有“最近 10 条消息 + 历史摘要”的会话策略，并把论文上下文从全量字符串改为按问题检索。
- 采用渐进兼容：不删除旧 `paperContext`，旧会话可读，新会话优先使用结构化文档。
- 不在本次方案中改造 PDF 渲染、高亮引擎、阅读历史数据库或 LLM provider 配置；只有在接入上下文检索所必需时才触碰相关调用点。

**Further Considerations**
1. 当前 `test-suite.sh` 引用了若干已不存在的旧路径，执行时可能有历史性失败；实现阶段应单独修正测试脚本，而不是把这些失败误判为上下文改造回归。
2. 浏览器 `chrome.storage.local` 不适合长期保存大量原文和索引；第一阶段应优先保存 chunk 元数据/摘要，必要时再评估 IndexedDB 或 OPFS 保存全文。
3. token 预算应按 provider/model 配置可调整，但要有保守默认值；不能只按字符数估算，因为中英文和代码/公式的 token 密度不同。
