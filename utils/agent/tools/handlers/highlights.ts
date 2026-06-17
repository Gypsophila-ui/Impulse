import {
  getHighlightsByUrl,
  saveHighlights
} from "~utils/storage/storage"
import { applyHighlightsToPage } from "../../agent-tools"
import { trackEvent } from "~utils/reading/reading-tracker"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleApplyHighlight(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const phrases = args.phrases as string[]
  const category = (args.category as string | undefined) || "default"
  if (!phrases?.length) {
    return { success: false, error: "没有指定要高亮的短语", message: "高亮失败：没有指定短语" }
  }
  if (!context.currentTabId) {
    return { success: false, error: "无法获取当前标签页", message: "高亮失败：无法访问页面" }
  }
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""

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

    // Save first so we get stable IDs, then inject with those IDs
    const savedHighlights = await saveHighlights(
      validPhrases,
      effectiveText || "页面内容",
      context.currentUrl,
      context.currentTitle,
      category as any
    )

    const injections = savedHighlights.map((h) => ({
      id: h.id,
      phrase: h.phrase,
      category: h.category,
      color: h.color || "#fed7aa"
    }))

    const result = await applyHighlightsToPage(context.currentTabId, injections)

    // Highlights are already saved to storage at this point. Even if page
    // injection fails (e.g. native Chrome PDF viewer, or phrases not found in
    // the current page DOM), the highlights are persisted and will be:
    //   - visible in the sidebar highlight list
    //   - auto-applied when the user opens the Impulse PDF viewer
    // So we treat "saved but not injected" as a soft success with a helpful note.
    if (result.success && result.count > 0) {
      trackEvent("highlight", { count: result.count, source: "agent", category })
      const note = phrasesInSelection.length < validPhrases.length
        ? `（其中 ${phrasesInSelection.length} 个在可用文本中）`
        : ""
      return {
        success: true,
        data: { count: result.count, phrases: validPhrases.slice(0, result.count) },
        message: `已高亮 ${result.count} 个短语${note}`
      }
    } else {
      // Injection failed, but highlights are saved. Provide actionable guidance.
      trackEvent("highlight", { count: validPhrases.length, source: "agent", category, injected: 0 })
      const isPdfUrl = /\.pdf($|\?)|\/pdf\//i.test(context.currentUrl)
      const guidance = isPdfUrl
        ? `已保存 ${validPhrases.length} 个高亮，但当前是原生 PDF 页面无法直接着色。请在侧边栏点击"在 Impulse 查看器中打开"，高亮将自动应用。`
        : `已保存 ${validPhrases.length} 个高亮到侧边栏，但未能在页面中找到匹配文本（可能是 PDF 提取的文本与页面 DOM 不一致）。`
      return {
        success: true, // soft success — highlights are saved
        data: { count: 0, saved: validPhrases.length, phrases: validPhrases },
        message: guidance
      }
    }
  } catch (e: any) {
    return { success: false, error: e?.message, message: `高亮失败：${e?.message ?? String(e)}` }
  }
}

async function handleGetHighlights(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
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

export const highlightHandlers: ToolHandler[] = [
  { name: "apply_highlight", execute: handleApplyHighlight },
  { name: "get_highlights", execute: handleGetHighlights }
]
