import type { ChatCompletionTool } from "openai/resources/chat/completions"

import type { AskUserQuestionCallback, PaperMetadata } from "~types"
import {
  getHighlightsByUrl,
  getNotesByUrl,
  saveHighlights,
  saveNote,
  type Highlight,
  type Note
} from "~utils/storage"
import {
  extractMetadata,
  generateHighlights as generateHighlightsLLM,
  summarize,
  translate
} from "~utils/llm-client"

export interface ToolExecutionContext {
  selectedText: string
  paperText: string
  currentUrl: string
  currentTitle: string
  currentTabId: number | null
  askUserQuestion?: AskUserQuestionCallback
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
}

export type ToolExecutionCallback = (
  status: string,
  toolName: string
) => void

export const PAPER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "save_note",
      description:
        "保存一条阅读笔记，关联当前选中的文本。当用户想要记录、保存、存储某个观点或内容时使用。",
      parameters: {
        type: "object",
        properties: {
          comment: {
            type: "string",
            description: "笔记内容/评论/感想"
          }
        },
        required: ["comment"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_notes",
      description:
        "获取当前页面的所有已保存笔记。当用户想查看、浏览、列出笔记时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_highlight",
      description:
        "将指定短语在页面上高亮显示并保存。当用户想要高亮、标记、强调某些关键内容时使用。",
      parameters: {
        type: "object",
        properties: {
          phrases: {
            type: "array",
            items: { type: "string" },
            description: "要高亮的短语列表，每个短语应该是文本中的精确匹配"
          }
        },
        required: ["phrases"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_highlights",
      description:
        "获取当前页面的所有高亮记录。当用户想查看、浏览、列出高亮内容时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "summarize_selection",
      description:
        "对当前选中文本生成摘要。当用户想要总结、概括、提炼选中文本的主要内容时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "translate_selection",
      description:
        "翻译当前选中文本。当用户想要翻译、转换语言时使用。",
      parameters: {
        type: "object",
        properties: {
          target_language: {
            type: "string",
            description: "目标语言，如'中文'、'英文'、'日文'等，默认为中文"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_paper_metadata",
      description:
        "从当前选中文本提取论文元数据（标题、作者、年份等）。当用户想要获取论文信息、引用信息时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "在已保存笔记中搜索包含关键词的内容。当用户想要查找、搜索、检索笔记时使用。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_user_question",
      description:
        "向用户提问并获取回答。当需要用户做出选择、确认操作、提供偏好设置或澄清模糊需求时使用。可以提供预设选项供用户选择，也可以允许用户自定义输入。",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "要向用户提出的问题"
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "选项标签"
                },
                description: {
                  type: "string",
                  description: "选项描述（可选）"
                }
              },
              required: ["label"]
            },
            description: "预设选项列表，建议提供2-4个选项"
          },
          allow_custom_input: {
            type: "boolean",
            description: "是否允许用户自定义输入，默认为false"
          },
          placeholder: {
            type: "string",
            description: "自定义输入框的占位符文本"
          }
        },
        required: ["question", "options"]
      }
    }
  }
]

async function applyHighlightsToPage(
  tabId: number,
  phrases: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "APPLY_HIGHLIGHTS",
      phrases,
      color: "#fef08a"
    })
    return response
  } catch (e: any) {
    return { success: false, count: 0, error: e?.message ?? String(e) }
  }
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  onStatus?.(`正在执行: ${toolName}`, toolName)

  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""

  switch (toolName) {
    case "save_note": {
      const comment = args.comment as string
      if (!comment?.trim()) {
        return { success: false, error: "笔记内容不能为空", message: "保存失败：笔记内容为空" }
      }
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "保存失败：请先选中要记录的文本或加载论文全文" }
      }
      try {
        const note = await saveNote(
          effectiveText,
          comment,
          context.currentUrl,
          context.currentTitle
        )
        return {
          success: true,
          data: note,
          message: `已保存笔记：${comment.slice(0, 30)}${comment.length > 30 ? "..." : ""}`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `保存笔记失败：${e?.message ?? String(e)}` }
      }
    }

    case "get_notes": {
      try {
        const notes = await getNotesByUrl(context.currentUrl)
        return {
          success: true,
          data: notes,
          message: notes.length > 0
            ? `当前页面有 ${notes.length} 条笔记`
            : "当前页面暂无笔记"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `获取笔记失败：${e?.message ?? String(e)}` }
      }
    }

    case "apply_highlight": {
      const phrases = args.phrases as string[]
      if (!phrases?.length) {
        return { success: false, error: "没有指定要高亮的短语", message: "高亮失败：没有指定短语" }
      }
      if (!context.currentTabId) {
        return { success: false, error: "无法获取当前标签页", message: "高亮失败：无法访问页面" }
      }
      try {
        const validPhrases = phrases.filter(
          (p) => typeof p === "string" && p.trim().length > 0
        )
        if (validPhrases.length === 0) {
          return { success: false, error: "没有有效的短语", message: "高亮失败：没有有效的短语" }
        }

        const phrasesInSelection = effectiveText
          ? validPhrases.filter((p) => effectiveText.includes(p))
          : []

        const result = await applyHighlightsToPage(context.currentTabId, validPhrases)
        if (result.success && result.count > 0) {
          await saveHighlights(
            validPhrases.slice(0, result.count),
            effectiveText || "页面内容",
            context.currentUrl,
            context.currentTitle
          )
          const note = phrasesInSelection.length < validPhrases.length
            ? `（其中 ${phrasesInSelection.length} 个在可用文本中）`
            : ""
          return {
            success: true,
            data: { count: result.count, phrases: validPhrases.slice(0, result.count) },
            message: `已高亮 ${result.count} 个短语${note}`
          }
        } else if (result.count === 0) {
          return {
            success: false,
            error: "短语未在页面中找到",
            message: "高亮失败：指定短语未在页面中找到，请确保短语与页面内容精确匹配"
          }
        } else {
          return { success: false, error: result.error, message: `高亮失败：${result.error}` }
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `高亮失败：${e?.message ?? String(e)}` }
      }
    }

    case "get_highlights": {
      try {
        const highlights = await getHighlightsByUrl(context.currentUrl)
        return {
          success: true,
          data: highlights,
          message: highlights.length > 0
            ? `当前页面有 ${highlights.length} 个高亮`
            : "当前页面暂无高亮"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `获取高亮失败：${e?.message ?? String(e)}` }
      }
    }

    case "summarize_selection": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "摘要失败：请先选中文本或加载论文全文" }
      }
      try {
        const summary = await summarize(effectiveText)
        return { success: true, data: { summary }, message: summary }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `摘要失败：${e?.message ?? String(e)}` }
      }
    }

    case "translate_selection": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "翻译失败：请先选中文本或加载论文全文" }
      }
      try {
        const targetLang = (args.target_language as string) || "中文"
        const translated = await translate(effectiveText, targetLang)
        return { success: true, data: { translation: translated, targetLanguage: targetLang }, message: translated }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `翻译失败：${e?.message ?? String(e)}` }
      }
    }

    case "extract_paper_metadata": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "提取失败：请先选中文本或加载论文全文" }
      }
      try {
        const metadata = await extractMetadata(effectiveText)
        return { success: true, data: metadata, message: `已提取元数据：${metadata.title || "未找到标题"}` }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `提取元数据失败：${e?.message ?? String(e)}` }
      }
    }

    case "search_notes": {
      const query = args.query as string
      if (!query?.trim()) {
        return { success: false, error: "搜索关键词为空", message: "搜索失败：请提供搜索关键词" }
      }
      try {
        const pageNotes = await getNotesByUrl(context.currentUrl)
        const results = pageNotes.filter(
          (note) =>
            note.comment.toLowerCase().includes(query.toLowerCase()) ||
            note.selectedText.toLowerCase().includes(query.toLowerCase())
        )
        return {
          success: true,
          data: results,
          message: results.length > 0
            ? `在当前页面找到 ${results.length} 条相关笔记`
            : "当前页面未找到相关笔记"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `搜索失败：${e?.message ?? String(e)}` }
      }
    }

    case "ask_user_question": {
      const question = args.question as string
      const options = args.options as Array<{ label: string; description?: string }>
      const allowCustomInput = (args.allow_custom_input as boolean) ?? false
      const placeholder = args.placeholder as string | undefined

      if (!question?.trim()) {
        return { success: false, error: "问题不能为空", message: "提问失败：问题为空" }
      }
      if (!options?.length) {
        return { success: false, error: "选项不能为空", message: "提问失败：请提供选项" }
      }

      if (!context.askUserQuestion) {
        return { success: false, error: "askUserQuestion 回调未配置", message: "提问失败：系统未配置用户交互功能" }
      }

      try {
        const result = await context.askUserQuestion({
          question,
          options,
          allowCustomInput,
          placeholder
        })
        return {
          success: true,
          data: {
            answer: result.selected,
            isCustomInput: result.isCustomInput
          },
          message: `用户回答：${result.selected}`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `提问失败：${e?.message ?? String(e)}` }
      }
    }

    default:
      return { success: false, error: `未知工具: ${toolName}`, message: `未知工具: ${toolName}` }
  }
}

export function formatToolResultForLLM(result: ToolResult): string {
  if (result.success) {
    if (typeof result.data === "string") {
      return result.data
    }
    return JSON.stringify(result.data, null, 2)
  }
  return `Error: ${result.error || result.message}`
}

export function getToolNames(): string[] {
  return PAPER_TOOLS.map((t) => {
    if (t.type === "function") {
      return t.function.name
    }
    return ""
  }).filter(Boolean)
}
