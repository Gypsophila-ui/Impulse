import OpenAI from "openai"

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

// Reset client when config changes
export function resetClient(): void {
  openaiClient = null
}
