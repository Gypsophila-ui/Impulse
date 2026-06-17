import type { AskUserQuestionCallback } from "~types"

// ─── Context & Result types ────────────────────────────────────────────────

export interface ToolExecutionContext {
  selectedText: string
  paperText: string
  currentUrl: string
  currentTitle: string
  currentTabId: number | null
  askUserQuestion?: AskUserQuestionCallback
  /** Reading history summary for system prompt injection (null when DB not initialized) */
  readingSummary?: import("~types").ReadingSummaryBrief | null
  /** Reading stats for the current URL */
  currentUrlStats?: {
    sessionCount: number
    totalDurationSeconds: number
    eventCount: number
    topEventTypes: Array<{ type: string; count: number }>
    firstVisitTime: number | null
    lastVisitTime: number | null
  } | null
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

// Re-export tool definitions (kept for backward compatibility)
export { PAPER_TOOLS, getToolNames } from "./tool-definitions"

// ─── Standalone functions for chrome.scripting.executeScript ──────────────────
// These must be self-contained (no external references) to be serializable.

function injectHighlightSentences(phrases: string[]): number {
  const HIGHLIGHT_CLASS = "impulse-sentence-hl"
  const COLORS = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ddd6fe", "#fed7aa"]

  // Clear existing highlights
  const existing = document.querySelectorAll("." + HIGHLIGHT_CLASS)
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i] as HTMLElement
    const p = el.parentNode
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ""), el)
    }
  }
  document.body.normalize()

  function isSkippable(el: Element | null): boolean {
    if (!el) return true
    const tag = el.tagName
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "MARK") return true
    if (el.classList.contains(HIGHLIGHT_CLASS)) return true
    return false
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isSkippable((node as Text).parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text)
  }

  let count = 0
  const lowerPhrases = phrases.map((p) => p.toLowerCase())

  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i]
    const text = textNode.textContent || ""
    if (!text.trim()) continue

    const sentences: { text: string; highlight: boolean; colorIdx: number }[] = []
    const sentenceRegex = /[^.!?\n]+[.!?]*\n*/g
    let m: RegExpExecArray | null
    while ((m = sentenceRegex.exec(text)) !== null) {
      const sentenceText = m[0]
      const lowerSentence = sentenceText.toLowerCase()
      let highlight = false
      let colorIdx = -1
      for (let p = 0; p < lowerPhrases.length; p++) {
        if (lowerSentence.indexOf(lowerPhrases[p]) !== -1) {
          highlight = true
          colorIdx = p
          break
        }
      }
      sentences.push({ text: sentenceText, highlight, colorIdx })
    }

    if (sentences.length === 0) continue

    let hasMatch = false
    for (let s = 0; s < sentences.length; s++) {
      if (sentences[s].highlight) { hasMatch = true; break }
    }
    if (!hasMatch) continue

    const parent = textNode.parentNode
    if (!parent) continue

    const fragment = document.createDocumentFragment()
    for (let s = 0; s < sentences.length; s++) {
      const sent = sentences[s]
      if (sent.highlight) {
        const span = document.createElement("span")
        span.className = HIGHLIGHT_CLASS
        span.style.backgroundColor = COLORS[sent.colorIdx % COLORS.length]
        span.style.padding = "2px 4px"
        span.style.borderRadius = "3px"
        span.textContent = sent.text
        fragment.appendChild(span)
        count++
      } else {
        fragment.appendChild(document.createTextNode(sent.text))
      }
    }

    parent.replaceChild(fragment, textNode)
  }

  return count
}

function injectClearHighlights(): void {
  const HIGHLIGHT_CLASS = "impulse-sentence-hl"
  const existing = document.querySelectorAll("." + HIGHLIGHT_CLASS)
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i] as HTMLElement
    const p = el.parentNode
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ""), el)
    }
  }
}

export async function applyHighlightsToPage(
  tabId: number,
  phrases: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectHighlightSentences,
      args: [phrases]
    })

    let totalCount = 0
    for (const r of results) {
      if (typeof r.result === "number") totalCount += r.result
    }

    if (totalCount === 0) {
      return { success: false, count: 0, error: "指定短语未在页面中找到" }
    }
    return { success: true, count: totalCount }
  } catch (e: any) {
    const errorMsg = e?.message ?? String(e)
    return { success: false, count: 0, error: errorMsg }
  }
}

export async function clearHighlightsOnPage(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectClearHighlights
    })
  } catch (e) {
    console.error("Failed to clear highlights:", e)
  }
}

// ─── Tool execution (delegates to registry) ──────────────────────────────

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  // Lazy-import to avoid circular dependency at module load time
  const { executeToolCall: dispatch } = await import("./tools")
  return dispatch(toolName, args, context, onStatus)
}

// ─── Format tool results for LLM consumption ─────────────────────────────

export function formatToolResultForLLM(result: ToolResult): string {
  if (result.success) {
    if (typeof result.data === "string") {
      return result.data
    }
    return JSON.stringify(result.data, null, 2)
  }
  return `Error: ${result.error || result.message}`
}
