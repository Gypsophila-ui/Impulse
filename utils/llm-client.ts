import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

import type { AgentChatResult, AgentStatusCallback, ChatMessage, ComparisonDimension, ComparisonResult, PaperMetadata, PaperSnapshot, ReadingGoal } from "~types"
import {
  executeToolCall,
  formatToolResultForLLM,
  PAPER_TOOLS,
  type ToolExecutionContext,
  type ToolResult
} from "~utils/agent-tools"
import { getLLMConfig } from "~utils/storage"

let openaiClient: OpenAI | null = null

async function getClient(): Promise<OpenAI> {
  if (!openaiClient) {
    const config = await getLLMConfig()
    if (!config?.apiKey) {
      throw new Error("未配置 API Key，请先在设置页面配置")
    }
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || undefined,
      dangerouslyAllowBrowser: true
    })
  }
  return openaiClient
}

function getReadingGoalPrompt(goal: ReadingGoal): string {
  const goalPrompts: Record<ReadingGoal, string> = {
    understand_method: `
【阅读目标：了解方法】
请重点分析论文的方法论部分：
- 技术路线和整体框架
- 核心算法或模型的原理
- 方法的关键步骤和流程
- 与现有方法的对比和改进
- 方法的适用场景和前提假设`,

    find_details: `
【阅读目标：寻找实现细节】
请重点关注论文的实现细节：
- 具体的参数设置和配置
- 实验环境和数据集详情
- 代码实现的关键技巧
- 复现实验所需的必要信息
- 可复现性的关键要素`,

    evaluate_novelty: `
【阅读目标：评估新颖性】
请重点评估论文的创新贡献：
- 核心创新点是什么
- 与现有工作的关键区别
- 理论或方法上的突破
- 创新点的学术价值
- 可能的局限性或不足`,

    prepare_citation: `
【阅读目标：准备引用】
请重点提炼适合引用的关键信息：
- 论文的主要结论和发现
- 最具代表性的成果
- 适合在文献综述中引用的观点
- 实验结果的关键数据
- 对所在领域的贡献`
  }
  return goalPrompts[goal] || ""
}

export async function summarize(text: string, readingGoal?: ReadingGoal): Promise<string> {
  const client = await getClient()
  const config = await getLLMConfig()

  const goalPrompt = readingGoal ? getReadingGoalPrompt(readingGoal) : ""

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `你是一个专业的学术论文摘要助手。请为以下论文内容生成一个结构化的学术摘要，遵循以下格式：

**一句话总结**：用一句话概括论文的核心贡献（不超过30字）

**详细摘要**：
1. **研究背景**：说明该研究解决的问题或填补的空白
2. **研究方法**：概述采用的技术路线或方法论
3. **核心贡献**：提炼关键发现、实验结果或理论创新
4. **实践意义**：指出研究的实际应用价值或局限性
${goalPrompt}
要求：
- 语言精炼、逻辑清晰、使用学术规范表达
- 直接输出摘要内容，不要出现类似"好的，以下是根据您提供的论文内容生成的结构化学术摘要"、"根据您提供的内容"这样的开场白
- 直接从"一句话总结"开始输出`
      },
      {
        role: "user",
        content: `请总结以下论文内容:\n\n${text}`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  })

  return response.choices[0]?.message?.content || "生成摘要失败"
}

export async function translate(
  text: string,
  targetLang: string = "中文"
): Promise<string> {
  const client = await getClient()
  const config = await getLLMConfig()

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `你是一个专业的学术翻译专家。请将以下学术论文内容翻译成${targetLang}，遵循以下原则：

1. **学术准确性**：忠实传达原意，保持学术严谨性
2. **术语一致性**：使用目标语言的标准化学术术语，必要时保留关键英文术语并在括号中说明
3. **表达流畅**：符合学术写作规范，逻辑清晰、句式专业
4. **格式保留**：保持原文的结构层次、公式、图表标注等特殊格式

请提供高质量的学术翻译。`
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0.3,
    max_tokens: 4000
  })

  return response.choices[0]?.message?.content || "翻译失败"
}

/**
 * Generate highlight suggestions for selected text
 * Returns an array of key phrases that should be highlighted
 */
export async function generateHighlights(text: string): Promise<string[]> {
  const client = await getClient()
  const config = await getLLMConfig()

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an academic reading assistant specialized in identifying key concepts in scholarly papers. Your task is to extract 3-7 important key phrases that represent the core concepts, findings, or significant terms from the given academic text.

Guidelines:
- Focus on technical terms, methodology names, framework names, and significant findings
- Each phrase should be 2-10 words long
- Prioritize phrases that would be useful for quick reference or review
- Extract concepts that appear central to the paper's contribution

Return ONLY a valid JSON array of strings, with no additional text or explanation. Example format: ["phrase one", "phrase two", "phrase three"]`
      },
      {
        role: "user",
        content: `Extract key phrases from this academic text:\n\n${text}`
      }
    ],
    temperature: 0.3,
    max_tokens: 300
  })

  const content = response.choices[0]?.message?.content || "[]"

  try {
    // Parse JSON response
    const phrases = JSON.parse(content)
    if (Array.isArray(phrases)) {
      return phrases.filter((p) => typeof p === "string" && p.length > 0).slice(0, 7)
    }
  } catch (e) {
    // If not valid JSON, try to extract phrases from text
    const lines = content
      .split("\n")
      .map((line) => line.trim().replace(/^[-*•]\s*/, "").replace(/^["']|["']$/g, ""))
      .filter((line) => line.length > 3 && line.length < 100)
    return lines.slice(0, 7)
  }

  return []
}

/**
 * Multi-turn chat with paper context
 */
export async function chatWithContext(
  messages: ChatMessage[],
  paperContext: string,
  readingGoal?: ReadingGoal
): Promise<string> {
  const client = await getClient()
  const config = await getLLMConfig()

  const goalPrompt = readingGoal ? getReadingGoalPrompt(readingGoal) : ""

  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `你是一个专业的学术论文阅读助手，擅长帮助用户理解和分析学术论文。请根据提供的论文片段回答用户问题。

论文片段：
${paperContext}
${goalPrompt}
回答要求：
1. **准确性**：基于提供的论文内容进行回答，避免引入外部信息
2. **学术性**：使用规范的学术语言和表达方式
3. **针对性**：直接回应用户问题，提供有价值的见解
4. **局限性说明**：如果问题超出论文范围或无法从文中推断，请明确说明

请用中文回答，保持专业、严谨的学术风格。`
    },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  ]

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: apiMessages,
    temperature: 0.5,
    max_tokens: 4000
  })

  return response.choices[0]?.message?.content || "无法生成回答"
}

/**
 * Extract paper metadata from text
 */
export async function extractMetadata(text: string): Promise<PaperMetadata> {
  const client = await getClient()
  const config = await getLLMConfig()

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a specialized metadata extraction assistant for academic papers. Your task is to accurately extract bibliographic metadata from the given text.

Extract the following fields:
- title: The full paper title
- authors: An array of author names (as strings)
- year: Publication year (string format)
- journal: Journal or conference name (if available)
- doi: Digital Object Identifier (if available)

Return ONLY a valid JSON object with these exact field names. Use empty string "" for missing fields or empty array [] for missing author lists. Do not include any additional text, explanations, or markdown formatting outside the JSON object.`
      },
      {
        role: "user",
        content: `Extract metadata from this paper text:\n\n${text}`
      }
    ],
    temperature: 0.1,
    max_tokens: 400
  })

  const content = response.choices[0]?.message?.content || "{}"

  try {
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    return {
      title: parsed.title || "",
      authors: Array.isArray(parsed.authors) ? parsed.authors : [],
      year: parsed.year || "",
      journal: parsed.journal || "",
      doi: parsed.doi || ""
    }
  } catch {
    return { title: "", authors: [], year: "", journal: "", doi: "" }
  }
}

// Reset client when config changes
export function resetClient(): void {
  openaiClient = null
}

const MAX_TOOL_CALL_ROUNDS = 5

export async function agentChat(
  messages: ChatMessage[],
  paperContext: string,
  toolContext: ToolExecutionContext,
  onStatus?: AgentStatusCallback,
  existingSummary?: string,
  readingGoal?: ReadingGoal
): Promise<AgentChatResult> {
  const client = await getClient()
  const config = await getLLMConfig()

  const toolCallsExecuted: AgentChatResult["toolCallsExecuted"] = []

  let processedMessages = messages
  let newSummary = existingSummary

  if (messages.length > MAX_HISTORY_MESSAGES) {
    onStatus?.("压缩对话历史...", "thinking")
    const compressResult = await compressHistory(messages, existingSummary)
    processedMessages = compressResult.recentMessages
    newSummary = compressResult.summary
  }

  const summarySection = newSummary
    ? `\n\n[对话历史摘要]\n${newSummary}\n`
    : ""

  const goalPrompt = readingGoal ? getReadingGoalPrompt(readingGoal) : ""

  const systemMessage = {
    role: "system" as const,
    content: `你是一个专业的学术论文阅读与研究助手 Agent，专注于帮助用户高效阅读和理解学术论文。

# 核心能力
- 分析和总结论文内容
- 解答关于论文的学术问题
- 提取和管理关键信息（笔记、高亮）
- 翻译专业术语和段落
- 主动执行用户请求的操作

# 可用工具说明

## 笔记管理
- **save_note**(comment: string)
  保存一条阅读笔记，关联当前选中的文本
  使用场景：用户说"记录这个"、"保存笔记"、"帮我记下来"

- **get_notes**()
  获取当前页面的所有已保存笔记
  使用场景：用户问"我之前记了什么"、"查看笔记"

- **search_notes**(query: string)
  在所有笔记中搜索包含关键词的内容
  使用场景：用户说"找一下关于XX的笔记"

## 高亮管理
- **apply_highlight**(phrases: string[])
  将指定短语在页面上高亮显示并保存
  使用场景：用户说"高亮这段的关键词"、"标记重点"

- **get_highlights**()
  获取当前页面的所有高亮记录
  使用场景：用户问"我高亮了哪些内容"

## 内容处理
- **summarize_selection**()
  对当前选中文本生成摘要
  使用场景：用户说"总结一下"、"这段讲了什么"

- **translate_selection**(target_language?: string)
  翻译当前选中文本（默认翻译为中文）
  使用场景：用户说"翻译这段"、"这句话什么意思"

- **extract_paper_metadata**()
  从当前选中文本提取论文元数据（标题、作者、年份等）
  使用场景：用户说"提取论文信息"、"这篇论文的作者是谁"

## 交互工具
- **ask_user_question**(question: string, options: {label, description}[], allowCustomInput?: boolean, placeholder?: string)
  向用户提问并获取回答，用于澄清需求、确认操作、获取偏好设置
  使用场景：需要用户做选择、确认操作、提供额外信息时
  示例：ask_user_question("您希望保存为哪种类型的笔记？", [{label: "方法", description: "论文方法相关"}, {label: "结论", description: "论文结论相关"}])

## 论文对比工具
- **list_candidate_papers**(limit?: number)
  列出所有可对比的论文候选（有笔记/高亮/元数据的论文），按最近阅读排序
  使用场景：用户说"帮我对比论文"但未指定论文、或问"我读过哪些论文"

- **get_paper_summary**(url: string)
  获取指定论文的结构化摘要（元数据、笔记、高亮、上下文预览）
  使用场景：对比前了解某篇论文的具体内容

- **compare_papers**(paper_urls: string[], dimensions?: string[], focus?: string)
  对多篇论文进行结构化对比，生成对比表格和总结。对比前需先确认用户选择了哪些论文和维度
  使用场景：用户说"对比这几篇"、"帮我找出这两篇的异同"、"哪篇方法更好"
  dimensions 可选：contribution / method / experiment / limitation / novelty / practical_value

- **save_comparison**(title: string, comparison_json: string)
  将 compare_papers 返回的对比结果保存到本地
  使用场景：用户说"保存这次对比"，或对比完成后主动询问用户是否保存
${summarySection}

# 当前上下文
- 页面标题：${toolContext.currentTitle}
- 选中文本：${toolContext.selectedText?.slice(0, 500) || "无"}${(toolContext.selectedText?.length || 0) > 500 ? "..." : ""}
- 论文全文：${toolContext.paperText ? `已加载 (${toolContext.paperText.length} 字符)` : "未加载"}

# 论文片段
${paperContext}
${goalPrompt}
# 工作流程：先思考，后行动

对于每个用户请求，请遵循以下思维框架：

1. **理解意图**：用户真正想要什么？是获取信息还是执行操作？
2. **判断工具**：需要调用哪些工具？调用顺序是什么？
3. **执行操作**：调用工具并获取结果
4. **整合回复**：基于工具结果和论文内容，给出清晰、有价值的回答

## 行为准则
- **主动执行**：当用户明确表达操作意图（"保存"、"高亮"、"翻译"）时，直接调用工具，不要只是建议
- **学术严谨**：回答问题时保持学术准确性，基于论文内容进行推理，避免臆测
- **简洁高效**：直接回应用户需求，避免冗余的解释和客套话
- **智能引导**：在适当时候主动提供笔记建议、追问建议或相关问题引导
- **明确边界**：如果问题超出论文范围或当前上下文不足，明确说明并建议用户提供更多信息

请根据用户需求灵活运用工具和能力，提供专业的学术阅读辅助服务。`
  }

  const apiMessages: ChatCompletionMessageParam[] = [
    systemMessage,
    ...processedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  ]

  let currentRound = 0

  while (currentRound < MAX_TOOL_CALL_ROUNDS) {
    onStatus?.("思考中...", "thinking")

    let response: OpenAI.Chat.Completions.ChatCompletion & { _request_id?: string | null }
    try {
      response = await client.chat.completions.create({
        model: config?.model || "gpt-4o-mini",
        messages: apiMessages,
        tools: PAPER_TOOLS,
        tool_choice: currentRound === 0 ? "auto" : "auto",
        temperature: 0.5,
        max_tokens: 8000
      })
    } catch (e: any) {
      const isToolCallingUnsupported =
        e?.status === 400 ||
        e?.status === 404 ||
        e?.error?.type === "invalid_request_error" ||
        e?.error?.type === "unsupported_parameter" ||
        (e?.message && (
          e.message.includes("tool") ||
          e.message.includes("function") ||
          e.message.includes("unsupported") ||
          e.message.includes("not supported") ||
          e.message.includes("does not support")
        ))

      if (isToolCallingUnsupported) {
        onStatus?.("模型不支持工具调用，使用普通对话", "complete")
        const fallbackReply = await chatWithContext(messages, paperContext)
        return {
          success: true,
          message: fallbackReply,
          toolCallsExecuted: [],
          fallbackToSimpleChat: true,
          newSummary
        }
      }
      throw e
    }

    const choice = response.choices[0]
    if (!choice) {
      return {
        success: false,
        message: "模型未返回有效响应",
        toolCallsExecuted,
        fallbackToSimpleChat: false,
        newSummary
      }
    }

    const assistantMessage = choice.message

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      onStatus?.("完成", "complete")
      return {
        success: true,
        message: assistantMessage.content || "已完成",
        toolCallsExecuted,
        fallbackToSimpleChat: false,
        newSummary
      }
    }

    apiMessages.push({
      role: "assistant",
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }))
    })

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments)
      } catch {
        args = {}
      }

      onStatus?.(`执行工具: ${toolName}`, "tool_call")

      const result: ToolResult = await executeToolCall(toolName, args, toolContext, (status) => {
        onStatus?.(status, "tool_call")
      })

      toolCallsExecuted.push({
        name: toolName,
        args,
        result: {
          success: result.success,
          message: result.message,
          data: result.data
        }
      })

      apiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: formatToolResultForLLM(result)
      })
    }

    currentRound++
  }

  onStatus?.("达到最大调用轮数", "complete")
  return {
    success: true,
    message: "已完成所有工具调用，但达到了最大轮数限制。请继续提问以获取更多信息。",
    toolCallsExecuted,
    fallbackToSimpleChat: false,
    newSummary
  }
}

const MAX_HISTORY_MESSAGES = 10

export async function compressHistory(
  messages: ChatMessage[],
  existingSummary?: string
): Promise<{ summary: string; recentMessages: ChatMessage[] }> {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return { summary: existingSummary || "", recentMessages: messages }
  }

  const client = await getClient()
  const config = await getLLMConfig()

  const messagesToCompress = messages.slice(0, messages.length - MAX_HISTORY_MESSAGES)
  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES)

  const conversationText = messagesToCompress
    .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
    .join("\n\n")

  const existingSummaryText = existingSummary
    ? `\n\n之前的对话摘要：\n${existingSummary}\n\n`
    : ""

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `你是一个专业的学术论文摘要助手。请将以下对话历史压缩为结构化的学术摘要，遵循以下格式：

**一句话总结**：用一句话概括对话的核心内容（不超过30字）

**详细摘要**：
1. **研究背景与问题**：提炼用户关注的核心问题、研究动机或论文主题
2. **研究方法**：总结讨论中涉及的方法论、技术方案或分析框架
3. **关键发现**：突出重要结论、数据洞察、实验结果或理论贡献
4. **讨论与启示**：保留有价值的观点、争议点或后续研究方向

摘要要求：
- 语言精炼，使用学术化表达
- 保留关键术语、专有名词和重要数据
- 突出逻辑链条和论证过程
- 如有多个主题，按重要性排序呈现${existingSummaryText}
请生成一个结构清晰、信息完整的学术对话摘要。`
      },
      {
        role: "user",
        content: conversationText
      }
    ],
    temperature: 0.3,
    max_tokens: 1500
  })

  const summary = response.choices[0]?.message?.content || ""

  return { summary, recentMessages }
}

// ─── Paper Comparison ──────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  contribution: "核心贡献",
  method: "方法",
  experiment: "实验",
  limitation: "局限性",
  novelty: "新颖性",
  practical_value: "实用价值"
}

/**
 * Call the LLM to generate a structured comparison of multiple papers.
 * Called from agent-tools.ts case "compare_papers".
 */
export async function comparePapersWithLLM(
  snapshots: PaperSnapshot[],
  dimensions: Array<ComparisonDimension | string>,
  paperSummaries: string,
  dimText: string,
  focusText: string
): Promise<ComparisonResult> {
  const client = await getClient()
  const config = await getLLMConfig()

  const paperTitles = snapshots.map((s, i) => `论文${i + 1}：${s.title}`).join("\n")

  const prompt = `你是一个学术论文对比分析专家。请仔细阅读以下论文资料，并按要求进行结构化对比分析。

## 待对比论文
${paperTitles}

## 论文详细资料
${paperSummaries}

## 对比任务
对比维度：${dimText}${focusText}

## 输出要求
请以 JSON 格式返回对比结果，结构如下：
{
  "summary": "一段简洁的总体对比摘要（100-150字）",
  "recommendation": "针对用户关注点的推荐意见（可选，50字以内）",
  "rows": [
    {
      "dimension": "维度英文key，如 contribution/method/experiment/limitation",
      "values": {
        "<论文URL1>": "该论文在此维度的核心描述（30-80字）",
        "<论文URL2>": "该论文在此维度的核心描述（30-80字）"
      },
      "difference": "这一维度上各论文的核心差异（30-60字）"
    }
  ]
}

只返回 JSON，不要其他内容。`

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 6000
  })

  const content = response.choices[0]?.message?.content || "{}"
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim()

  let parsed: { summary: string; recommendation?: string; rows: Array<{ dimension: string; values: Record<string, string>; difference: string }> }

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Fallback: return a minimal structure with the raw text
    return {
      papers: snapshots,
      dimensions,
      rows: [],
      summary: content.slice(0, 300),
      generatedAt: Date.now()
    }
  }

  const rows = (parsed.rows || []).map((row) => ({
    dimension: row.dimension as ComparisonDimension | string,
    values: row.values || {},
    difference: row.difference || ""
  }))

  return {
    papers: snapshots,
    dimensions,
    rows,
    summary: parsed.summary || "",
    recommendation: parsed.recommendation,
    generatedAt: Date.now()
  }
}
