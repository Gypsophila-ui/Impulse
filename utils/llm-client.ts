import OpenAI from "openai"

import type { ChatMessage, PaperMetadata } from "~types"
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
