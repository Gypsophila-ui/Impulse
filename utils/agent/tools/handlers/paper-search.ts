import { loadPaperDocForRetrieval } from "~utils/storage/storage"
import { retrieveContext } from "~utils/reading/paper-context"
import type { PaperDocument } from "~types"
import { fail } from "../../agent-tools"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import { classifyError } from "../../tool-error"
import type { ToolHandler } from "../registry"

const MAX_RESULT_CHUNK_CHARS = 1200

/**
 * Agentic retrieval tool: lets the agent pull page-indexed evidence from any
 * indexed paper on demand instead of front-loading full text into the prompt.
 */
async function handleSearchPaperContent(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const query = args.query as string
  if (!query?.trim()) {
    return fail("INVALID_ARGS", "检索失败：请提供查询词（使用论文中的核心术语效果最佳）")
  }

  const url = (args.url as string)?.trim() || context.currentUrl
  if (!url) {
    return fail("INVALID_ARGS", "检索失败：未指定论文且当前页面不是论文页")
  }

  let loaded: { doc: PaperDocument; fullChunks: Map<number, string> } | null = null
  try {
    loaded = await loadPaperDocForRetrieval(url)
  } catch (e: any) {
    return fail(classifyError(e), `检索失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
  if (!loaded) {
    return fail("NOT_FOUND", `该论文尚未建立结构化索引（${url}）。请在 Impulse 内置 PDF 查看器中打开该论文以建立索引，或改用 get_paper_summary 获取摘要信息。`)
  }

  let doc = loaded.doc

  // Optional scope filters: section keyword and/or page range
  const section = (args.section as string)?.trim()
  const pageStart = typeof args.page_start === "number" ? args.page_start : undefined
  const pageEnd = typeof args.page_end === "number" ? args.page_end : undefined
  if (section || pageStart !== undefined || pageEnd !== undefined) {
    const filtered = doc.chunks.filter((c) => {
      if (section && !c.sectionPath.join(" ").toLowerCase().includes(section.toLowerCase())) return false
      if (pageStart !== undefined && c.endPage < pageStart) return false
      if (pageEnd !== undefined && c.startPage > pageEnd) return false
      return true
    })
    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: "过滤条件下没有匹配的片段。建议放宽 section / page 过滤后重试。"
      }
    }
    doc = { ...doc, chunks: filtered }
  }

  const topK = typeof args.top_k === "number" ? Math.min(Math.max(args.top_k, 1), 10) : 5
  const ctx = retrieveContext(doc, loaded.fullChunks, query, "", {
    topK,
    maxContextTokens: 3000,
    neighborCount: 0,
    mergeAdjacent: true
  })

  if (ctx.chunks.length === 0) {
    return {
      success: true,
      data: [],
      message:
        "未找到与查询相关的片段。建议：换用论文中出现的核心术语重试（英文术语优先），或去掉 section/page 过滤。"
    }
  }

  const formatted = ctx.chunks
    .map(
      (c) =>
        `[chunk ${c.index}][${c.sectionPath.join(" > ") || "正文"}][p. ${c.startPage}-${c.endPage}]\n${(c.text || "").slice(0, MAX_RESULT_CHUNK_CHARS)}`
    )
    .join("\n\n")

  return {
    success: true,
    data: {
      query,
      url,
      confidence: ctx.meta.confidence,
      results: ctx.chunks.map((c) => ({
        chunkIndex: c.index,
        section: c.sectionPath.join(" > "),
        pages: `p. ${c.startPage}-${c.endPage}`,
        score: c.score,
        text: (c.text || "").slice(0, MAX_RESULT_CHUNK_CHARS)
      }))
    },
    message: `找到 ${ctx.chunks.length} 个相关片段（置信度 ${ctx.meta.confidence}）。引用时请标注 [chunk N][p. X-Y]：\n\n${formatted}`
  }
}

export const paperSearchHandlers: ToolHandler[] = [
  { name: "search_paper_content", execute: handleSearchPaperContent }
]
