import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

import type { AgentChatResult, AgentStatusCallback, ChatMessage, PaperMetadata, ReadingGoal } from "~types"
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
要求：语言精炼、逻辑清晰、使用学术规范表达。`
      },
      {
        role: "user",
        content: `请总结以下论文内容:\n\n${text}`
      }
    ],
    temperature: 0.7,
    max_tokens: 500
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
    max_tokens: 1000
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
    max_tokens: 800
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
    content: `你是一个专业的学术论文阅读与研究助手，专注于帮助用户高效阅读和理解学术论文。

【核心能力】
- 分析和总结论文内容
- 解答关于论文的学术问题
- 提取和管理关键信息
- 翻译专业术语
- 保存阅读笔记和高亮

【可用工具】
- save_note: 保存阅读笔记
- get_notes: 查看当前页面的笔记
- apply_highlight: 高亮页面上的关键短语
- get_highlights: 查看当前页面的高亮
- summarize_selection: 摘要选中文本
- translate_selection: 翻译选中文本
- extract_paper_metadata: 提取论文元数据
- search_notes: 搜索笔记
${summarySection}

【当前上下文】
- 页面标题：${toolContext.currentTitle}
- 选中文本：${toolContext.selectedText?.slice(0, 500) || "无"}${(toolContext.selectedText?.length || 0) > 500 ? "..." : ""}

【论文片段】
${paperContext}
${goalPrompt}
【工作原则】
1. 主动判断：对于涉及保存笔记、高亮、翻译、摘要等操作的任务，主动调用相应工具
2. 学术严谨：回答问题时保持学术准确性，基于论文内容进行推理
3. 简洁高效：直接回应用户需求，避免冗余
4. 智能建议：在适当时候主动提供笔记建议或相关问题引导

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

    let response
    try {
      response = await client.chat.completions.create({
        model: config?.model || "gpt-4o-mini",
        messages: apiMessages,
        tools: PAPER_TOOLS,
        tool_choice: currentRound === 0 ? "auto" : "auto",
        temperature: 0.5,
        max_tokens: 1000
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
    max_tokens: 500
  })

  const summary = response.choices[0]?.message?.content || ""

  return { summary, recentMessages }
}
