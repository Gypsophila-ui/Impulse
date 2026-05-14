import type { ChatCompletionTool } from "openai/resources/chat/completions"

// ─── Tool Definition Metadata ───────────────────────────────────────────────

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  required: string[]
  /** Grouping category for prompt rendering */
  category: string
  /** Concise usage scenario hint for the system prompt */
  usageHint: string
  /** Optional example call */
  example?: string
}

// ─── All Tool Definitions ───────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDef[] = [
  {
    name: "save_note",
    description:
      "保存一条阅读笔记，关联当前选中的文本或论文全文。当用户想要记录、保存、存储某个观点或内容时使用。如果没有选中文本，会自动使用论文全文作为上下文。",
    parameters: {
      comment: {
        type: "string",
        description: "笔记内容/评论/感想"
      }
    },
    required: ["comment"],
    category: "笔记管理",
    usageHint: "用户说“记录这个”、“保存笔记”、“帮我记下来”",
    example: 'save_note(comment: "Transformer 的核心创新在于完全基于注意力机制...")'
  },
  {
    name: "get_notes",
    description: "获取当前页面的所有已保存笔记。当用户想查看、浏览、列出笔记时使用。",
    parameters: {},
    required: [],
    category: "笔记管理",
    usageHint: "用户问“我之前记了什么”、“查看笔记”"
  },
  {
    name: "search_notes",
    description: "在已保存笔记中搜索包含关键词的内容。当用户想要查找、搜索、检索笔记时使用。",
    parameters: {
      query: {
        type: "string",
        description: "搜索关键词"
      }
    },
    required: ["query"],
    category: "笔记管理",
    usageHint: "用户说“找一下关于XX的笔记”",
    example: 'search_notes(query: "注意力机制")'
  },
  {
    name: "apply_highlight",
    description:
      "将指定短语在页面上高亮显示并保存。当用户想要高亮、标记、强调某些关键内容时使用。",
    parameters: {
      phrases: {
        type: "array",
        items: { type: "string" },
        description: "要高亮的短语列表，每个短语应该是文本中的精确匹配"
      }
    },
    required: ["phrases"],
    category: "高亮管理",
    usageHint: "用户说“高亮这段的关键词”、“标记重点”",
    example: 'apply_highlight(phrases: ["自注意力机制", "多头注意力", "位置编码"])'
  },
  {
    name: "get_highlights",
    description: "获取当前页面的所有高亮记录。当用户想查看、浏览、列出高亮内容时使用。",
    parameters: {},
    required: [],
    category: "高亮管理",
    usageHint: "用户问“我高亮了哪些内容”"
  },
  {
    name: "summarize_selection",
    description:
      "对当前选中文本生成摘要。当用户想要总结、概括、提炼选中文本的主要内容时使用。",
    parameters: {},
    required: [],
    category: "内容处理",
    usageHint: "用户说“总结一下”、“这段讲了什么”"
  },
  {
    name: "translate_selection",
    description: "翻译当前选中文本。当用户想要翻译、转换语言时使用。",
    parameters: {
      target_language: {
        type: "string",
        description: "目标语言，如‘中文’、‘英文’、‘日文’等，默认为中文"
      }
    },
    required: [],
    category: "内容处理",
    usageHint: "用户说“翻译这段”、“这句话什么意思”",
    example: 'translate_selection(target_language: "中文")'
  },
  {
    name: "extract_paper_metadata",
    description:
      "从当前选中文本提取论文元数据（标题、作者、年份等）。当用户想要获取论文信息、引用信息时使用。",
    parameters: {},
    required: [],
    category: "内容处理",
    usageHint: "用户说“提取论文信息”、“这篇论文的作者是谁”"
  },
  {
    name: "ask_user_question",
    description:
      "向用户提问并获取回答。当需要用户做出选择、确认操作、提供偏好设置或澄清模糊需求时使用。可以提供预设选项供用户选择，也可以允许用户自定义输入。",
    parameters: {
      question: {
        type: "string",
        description: "要向用户提出的问题"
      },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "选项标签" },
            description: { type: "string", description: "选项描述（可选）" }
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
    required: ["question", "options"],
    category: "交互工具",
    usageHint: "需要用户做选择、确认操作、提供额外信息时使用",
    example: 'ask_user_question(question: "您希望保存为哪种类型的笔记？", options: [{label: "方法"}, {label: "结论"}])'
  },
  {
    name: "list_candidate_papers",
    description:
      "列出所有可用于对比的论文候选，包括当前论文和历史阅读过的论文。当用户想比较论文、或需要了解有哪些论文可供分析时使用。",
    parameters: {
      limit: {
        type: "number",
        description: "最多返回多少篇论文，默认为 10"
      }
    },
    required: [],
    category: "论文对比工具",
    usageHint: "用户说“帮我对比论文”但未指定论文、或问“我读过哪些论文”"
  },
  {
    name: "get_paper_summary",
    description:
      "获取指定论文的结构化摘要，包括元数据、笔记、高亮和上下文预览。用于在对比前了解某篇论文的核心内容。",
    parameters: {
      url: {
        type: "string",
        description: "论文的 URL"
      }
    },
    required: ["url"],
    category: "论文对比工具",
    usageHint: "对比前了解某篇论文的具体内容",
    example: 'get_paper_summary(url: "https://arxiv.org/abs/1706.03762")'
  },
  {
    name: "compare_papers",
    description:
      "对比多篇论文，生成结构化的对比表格和总结。当用户想了解论文间的异同、找出各自优缺点或决定读哪篇时使用。",
    parameters: {
      paper_urls: {
        type: "array",
        items: { type: "string" },
        description: "要对比的论文 URL 列表（2-5 篇）"
      },
      dimensions: {
        type: "array",
        items: {
          type: "string",
          enum: ["contribution", "method", "experiment", "limitation", "novelty", "practical_value"]
        },
        description: "对比维度，默认为 contribution、method、experiment、limitation"
      },
      focus: {
        type: "string",
        description: "对比的重点或用户具体关心的问题，帮助生成更有针对性的分析"
      }
    },
    required: ["paper_urls"],
    category: "论文对比工具",
    usageHint: "用户说“对比这几篇”、“帮我找出这两篇的异同”、“哪篇方法更好”",
    example: 'compare_papers(paper_urls: ["url1", "url2"], dimensions: ["method", "contribution"])'
  },
  {
    name: "save_comparison",
    description:
      "将对比结果保存到本地，方便后续查阅。在生成对比结果后，如用户希望保存，则调用此工具。",
    parameters: {
      title: {
        type: "string",
        description: "对比任务的标题，例如‘Transformer vs BERT 方法对比’"
      },
      comparison_json: {
        type: "string",
        description: "compare_papers 返回的 ComparisonResult JSON 字符串"
      }
    },
    required: ["title", "comparison_json"],
    category: "论文对比工具",
    usageHint: "用户说“保存这次对比”，或对比完成后主动询问用户是否保存"
  }
]

// ─── JSON Schema → readable type string ──────────────────────────────────────

function jsonSchemaToTypeString(schema: Record<string, unknown> | undefined): string {
  if (!schema) return "any"

  const type = schema.type as string | undefined

  if (type === "string") {
    if (schema.enum) return (schema.enum as string[]).map((v) => `“${v}”`).join(" | ")
    return "string"
  }
  if (type === "number" || type === "integer") return "number"
  if (type === "boolean") return "boolean"

  if (type === "array") {
    const items = schema.items as Record<string, unknown> | undefined
    if (!items) return "any[]"
    const itemType = items.type as string | undefined
    if (itemType === "object") {
      const props = items.properties as Record<string, Record<string, unknown>> | undefined
      if (props) return `{${Object.keys(props).join(", ")}[]}`
      return "object[]"
    }
    if (itemType === "string") {
      if (items.enum) return `(${(items.enum as string[]).map((v) => `“${v}”`).join(" | ")})[]`
      return "string[]"
    }
    return `${itemType || "any"}[]`
  }

  if (type === "object") {
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined
    if (props) return `{${Object.keys(props).join(", ")}}`
    return "object"
  }

  return "any"
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Convert tool definitions to OpenAI ChatCompletionTool format */
export function getOpenAITools(): ChatCompletionTool[] {
  return TOOL_DEFINITIONS.map((def) => ({
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: "object" as const,
        properties: def.parameters as Record<string, unknown>,
        required: def.required
      }
    }
  }))
}

/** OpenAI-compatible tools array (cached for convenience) */
export const PAPER_TOOLS: ChatCompletionTool[] = getOpenAITools()

/** Get all tool names */
export function getToolNames(): string[] {
  return TOOL_DEFINITIONS.map((t) => t.name)
}

/**
 * Dynamically generate the "可用工具说明" section of the system prompt.
 * Groups tools by category and renders each tool's signature, usage hint, and example.
 */
export function getToolPrompt(): string {
  const categoryOrder: string[] = []
  const grouped = new Map<string, ToolDef[]>()
  for (const def of TOOL_DEFINITIONS) {
    if (!grouped.has(def.category)) {
      grouped.set(def.category, [])
      categoryOrder.push(def.category)
    }
    grouped.get(def.category)!.push(def)
  }

  const sections: string[] = []

  for (const category of categoryOrder) {
    const tools = grouped.get(category)!
    const lines: string[] = [`## ${category}`]

    for (const tool of tools) {
      const propEntries = Object.entries(tool.parameters as Record<string, Record<string, unknown>>)
      const paramParts = propEntries.map(([name, schema]) => {
        const typeStr = jsonSchemaToTypeString(schema)
        const isRequired = tool.required.includes(name)
        return isRequired ? `${name}: ${typeStr}` : `${name}?: ${typeStr}`
      })
      const signature = paramParts.length > 0 ? `(${paramParts.join(", ")})` : "()"

      lines.push(`- **${tool.name}**${signature}`)
      lines.push(`  ${tool.usageHint}`)
      if (tool.example) {
        lines.push(`  示例：${tool.example}`)
      }
    }

    sections.push(lines.join("\n"))
  }

  return sections.join("\n\n")
}
