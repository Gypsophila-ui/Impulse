import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

import type { AgentChatResult, AgentStatusCallback, ChatMessage, PaperMetadata } from "~types"
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
      baseURL: config.baseURL || undefined, // 留空则默认 OpenAI
      dangerouslyAllowBrowser: true // Chrome extension context
    })
  }
  return openaiClient
}

export async function summarize(text: string): Promise<string> {
  const client = await getClient()
  const config = await getLLMConfig()

  const response = await client.chat.completions.create({
    model: config?.model || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "你是一个专业的学术论文助手。请用简洁的中文总结以下内容，突出关键要点。"
      },
      {
        role: "user",
        content: `请总结以下文本:\n\n${text}`
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
        content: `你是一个专业的翻译助手。请将以下内容翻译成${targetLang}，保持学术性和准确性。`
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
        content:
          "You are a reading assistant that identifies the most important phrases in academic text. Extract 3-7 key phrases (each 2-10 words) that represent the core concepts. Return ONLY a JSON array of strings, no explanations."
      },
      {
        role: "user",
        content: `Extract key phrases from this text:\n\n${text}`
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
  paperContext: string
): Promise<string> {
  const client = await getClient()
  const config = await getLLMConfig()

  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `你是一个专业的学术论文助手。请根据用户提供的论文片段回答问题。使用中文回答，保持学术性和准确性。如果问题超出了提供的文本范围，请说明。

论文片段：
${paperContext}`
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
        content:
          'You are a metadata extraction assistant. Extract paper metadata from the given text. Return ONLY a JSON object with these fields: title (string), authors (string array), year (string), journal (string), doi (string). Use empty string or empty array if not found.'
      },
      {
        role: "user",
        content: `Extract metadata from:\n\n${text}`
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
  existingSummary?: string
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

  const systemMessage = {
    role: "system" as const,
    content: `你是一个专业的学术论文助手，可以调用工具来帮助用户完成任务。

你可以使用以下工具：
- save_note: 保存阅读笔记
- get_notes: 查看当前页面的笔记
- apply_highlight: 高亮页面上的关键短语
- get_highlights: 查看当前页面的高亮
- summarize_selection: 摘要选中文本
- translate_selection: 翻译选中文本
- extract_paper_metadata: 提取论文元数据
- search_notes: 搜索笔记
${summarySection}
当前上下文：
- 页面标题：${toolContext.currentTitle}
- 选中文本：${toolContext.selectedText?.slice(0, 500) || "无"}${(toolContext.selectedText?.length || 0) > 500 ? "..." : ""}

论文片段：
${paperContext}

请根据用户需求，主动判断是否需要调用工具。如果用户请求涉及保存笔记、高亮、翻译、摘要等操作，请调用相应工具。如果只是普通问答，直接回答即可。`
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
