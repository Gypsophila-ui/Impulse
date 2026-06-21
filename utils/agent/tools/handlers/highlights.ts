import {
  getHighlightsByUrl,
  saveHighlights,
  saveHighlightsWithCategories
} from "~utils/storage/storage"
import { applyHighlightsToPage } from "../../agent-tools"
import { trackEvent } from "~utils/reading/reading-tracker"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"
import type { HighlightCategory } from "~utils/storage/storage"

interface HighlightItem {
  phrase: string
  category?: string
}

/**
 * Normalize args from the LLM into a list of {phrase, category} items.
 * Supports two calling conventions:
 *   - items: [{phrase, category}, ...]  (preferred, per-item category)
 *   - phrases: [...] + category         (legacy, shared category)
 */
function normalizeHighlightArgs(args: Record<string, unknown>): {
  items: HighlightItem[]
  error?: string
} {
  const rawItems = args.items as HighlightItem[] | undefined
  const rawPhrases = args.phrases as string[] | undefined
  const globalCategory = (args.category as string | undefined) || "default"

  const VALID_CATEGORIES = new Set([
    "important", "question", "definition", "method", "default"
  ])

  function coerceCategory(v: unknown): HighlightCategory {
    return VALID_CATEGORIES.has(v as string) ? (v as HighlightCategory) : "default"
  }

  // Prefer `items` if provided
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const items: HighlightItem[] = rawItems
      .filter((it) => it && typeof it === "object" && typeof it.phrase === "string" && it.phrase.trim())
      .map((it) => ({
        phrase: (it.phrase as string).trim(),
        category: coerceCategory(it.category)
      }))
    if (items.length === 0) {
      return { items: [], error: "items 中没有有效的 phrase" }
    }
    return { items }
  }

  // Fallback to `phrases` + `category`
  if (Array.isArray(rawPhrases) && rawPhrases.length > 0) {
    const items: HighlightItem[] = rawPhrases
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => ({
        phrase: (p as string).trim(),
        category: coerceCategory(globalCategory)
      }))
    if (items.length === 0) {
      return { items: [], error: "没有有效的 phrase" }
    }
    return { items }
  }

  return { items: [], error: "没有指定要高亮的短语（items 或 phrases）" }
}

async function handleApplyHighlight(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const { items, error } = normalizeHighlightArgs(args)
  if (error || items.length === 0) {
    return { success: false, error: error || "没有指定要高亮的短语", message: `高亮失败：${error}` }
  }
  if (!context.currentTabId) {
    return { success: false, error: "无法获取当前标签页", message: "高亮失败：无法访问页面" }
  }
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""

  try {
    const phrasesInSelection = effectiveText
      ? items.filter((it) => effectiveText.includes(it.phrase)).length
      : 0

    // Save with per-item categories
    const savedHighlights = await saveHighlightsWithCategories(
      items.map((it) => ({
        phrase: it.phrase,
        category: (it.category as HighlightCategory) || "default"
      })),
      effectiveText || "页面内容",
      context.currentUrl,
      context.currentTitle
    )

    // Notify the side panel to refresh its Highlight tab list.
    try {
      await chrome.runtime.sendMessage({ type: "HIGHLIGHT_UPDATED" })
    } catch {
      // Side panel may not be open — ignore
    }

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
      trackEvent("highlight", { count: result.count, source: "agent" })
      const note = phrasesInSelection < items.length
        ? `（其中 ${phrasesInSelection} 个在可用文本中）`
        : ""
      // Summarize categories used
      const catSummary = items.reduce<Record<string, number>>((acc, it) => {
        const c = it.category || "default"
        acc[c] = (acc[c] || 0) + 1
        return acc
      }, {})
      const catStr = Object.entries(catSummary)
        .map(([c, n]) => `${c}:${n}`)
        .join(", ")
      return {
        success: true,
        data: { count: result.count, phrases: injections.slice(0, result.count).map((i) => i.phrase), categories: catStr },
        message: `已高亮 ${result.count} 个短语${note} [${catStr}]`
      }
    } else {
      // Injection failed, but highlights are saved. Provide actionable guidance.
      trackEvent("highlight", { count: items.length, source: "agent", injected: 0 })
      const isPdfUrl = /\.pdf($|\?)|\/pdf\//i.test(context.currentUrl)
      const guidance = isPdfUrl
        ? `已保存 ${items.length} 个高亮，但当前是原生 PDF 页面无法直接着色。请在侧边栏点击"在 Impulse 查看器中打开"，高亮将自动应用。`
        : `已保存 ${items.length} 个高亮到侧边栏，但未能在页面中找到匹配文本（可能是 PDF 提取的文本与页面 DOM 不一致）。`
      return {
        success: true, // soft success — highlights are saved
        data: { count: 0, saved: items.length, phrases: items.map((i) => i.phrase) },
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
