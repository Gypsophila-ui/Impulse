import type { AskUserQuestionCallback } from "~types"
import type { HighlightCategory } from "~utils/storage/storage"
import { getHighlightColor } from "~utils/storage/storage"

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

/**
 * A highlight to inject into the page. Carries id/category/color so the page
 * can render category-colored spans with stable data-impulse-id attributes
 * that the sidebar can reference for click-to-focus behavior.
 */
export interface HighlightInjection {
  id: string
  phrase: string
  category?: HighlightCategory
  color: string
}

function injectHighlightSentences(injections: HighlightInjection[]): number {
  const HIGHLIGHT_CLASS = "impulse-sentence-hl"
  const FOCUS_CLASS = "impulse-hl-focus"

  // ── Clear existing highlights ──
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

  // ── Block-level tag set for grouping text nodes ──
  const BLOCK_TAGS = new Set([
    "DIV", "P", "SECTION", "ARTICLE", "LI", "TD", "TH",
    "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE",
    "MAIN", "ASIDE", "NAV", "HEADER", "FOOTER", "BODY"
  ])

  function getBlockAncestor(el: Element): Element {
    let cur: Element | null = el
    while (cur) {
      if (BLOCK_TAGS.has(cur.tagName)) return cur
      cur = cur.parentElement
    }
    return document.body
  }

  // ── Pass 1: Collect text nodes and group by block ancestor ──
  // Each group has a reference element and concatenated text.
  // We record per-node (start, end) offsets so we can map match positions
  // back to specific text nodes later.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isSkippable((node as Text).parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  interface TextSegment {
    node: Text
    start: number   // character offset in the block's fullText
    end: number     // exclusive
  }

  interface TextBlock {
    element: Element        // block-level ancestor (for scoped re-walk during apply)
    segments: TextSegment[]
    fullText: string
  }

  const blocks: TextBlock[] = []
  let currentBlock: TextBlock | null = null
  let prevBlockEl: Element | null = null
  let runningOffset = 0
  let node: Node | null

  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const text = textNode.textContent || ""
    if (!text) continue

    const parentEl = textNode.parentElement
    if (!parentEl) continue
    const blockEl = getBlockAncestor(parentEl)

    if (!currentBlock || blockEl !== prevBlockEl) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = { element: blockEl, segments: [], fullText: "" }
      runningOffset = 0
      prevBlockEl = blockEl
    }

    currentBlock.segments.push({
      node: textNode,
      start: runningOffset,
      end: runningOffset + text.length
    })
    currentBlock.fullText += text
    runningOffset += text.length
  }
  if (currentBlock) blocks.push(currentBlock)

  // ── Pass 2: Match phrases against each block's concatenated text ──
  interface MatchSpan {
    startOffset: number
    endOffset: number   // exclusive
    injection: HighlightInjection & { lowerPhrase: string }
  }

  const lowerInjections = injections.map((inj) => ({
    ...inj,
    lowerPhrase: inj.phrase.toLowerCase()
  }))

  const SENTENCE_REGEX = /[^.!?\n]+[.!?]*\n*/g

  const blockMatches = new Map<TextBlock, MatchSpan[]>()

  for (const block of blocks) {
    const matches: MatchSpan[] = []
    const lowerFullText = block.fullText.toLowerCase()
    let sm: RegExpExecArray | null

    while ((sm = SENTENCE_REGEX.exec(block.fullText)) !== null) {
      const sentText = sm[0]
      const sentStart = sm.index
      const sentEnd = sentStart + sentText.length
      const lowerSent = sentText.toLowerCase()

      for (const inj of lowerInjections) {
        if (lowerSent.indexOf(inj.lowerPhrase) !== -1) {
          matches.push({
            startOffset: sentStart,
            endOffset: sentEnd,
            injection: inj
          })
          break // first matching injection wins for this sentence
        }
      }
    }

    if (matches.length > 0) {
      blockMatches.set(block, matches)
    }
  }

  // ── Helper: create a highlight span element ──
  function makeHighlightSpan(inj: HighlightInjection): HTMLSpanElement {
    const span = document.createElement("span")
    span.className = HIGHLIGHT_CLASS
    span.setAttribute("data-impulse-id", inj.id)
    if (inj.category) {
      span.setAttribute("data-impulse-category", inj.category)
    }
    span.style.backgroundColor = inj.color
    span.style.padding = "2px 4px"
    span.style.borderRadius = "3px"
    span.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease"
    span.style.cursor = "pointer"
    span.title = `Impulse 高亮 · ${inj.category || "default"}`
    return span
  }

  // ── Pass 3: Apply matches to each block (right-to-left within each block) ──
  let count = 0

  function applyMatchToBlock(block: TextBlock, match: MatchSpan): void {
    // Re-collect text nodes within this block element (handles modifications
    // from earlier matches which were to the right).
    const tw = document.createTreeWalker(block.element, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        return isSkippable((n as Text).parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      }
    })

    const children: Text[] = []
    let cn: Node | null
    while ((cn = tw.nextNode())) {
      children.push(cn as Text)
    }

    // Find the text nodes and internal offsets for this match
    let cumOffset = 0
    let startNode: Text | null = null
    let startInternal = 0
    let endNode: Text | null = null
    let endInternal = 0

    for (const child of children) {
      const childLen = (child.textContent || "").length
      if (!startNode && cumOffset + childLen > match.startOffset) {
        startNode = child
        startInternal = match.startOffset - cumOffset
      }
      if (!endNode && cumOffset + childLen >= match.endOffset) {
        endNode = child
        endInternal = match.endOffset - cumOffset
        break
      }
      cumOffset += childLen
    }

    if (!startNode || !endNode) return

    if (startNode === endNode) {
      // Match is entirely within one text node
      const beforeLen = startInternal
      const matchLen = endInternal - startInternal

      let matchNode = startNode
      if (beforeLen > 0) {
        matchNode = startNode.splitText(beforeLen)
      }
      if (matchLen < (matchNode.textContent || "").length) {
        matchNode.splitText(matchLen)
      }

      const span = makeHighlightSpan(match.injection)
      const parent = matchNode.parentNode
      if (parent) {
        parent.replaceChild(span, matchNode)
        span.appendChild(matchNode)
        count++
      }
    } else {
      // Match spans multiple text nodes
      // Split start node at the match boundary
      let firstMatchNode = startNode
      if (startInternal > 0) {
        firstMatchNode = startNode.splitText(startInternal)
      } else {
        // startNode is fully consumed; firstMatchNode is startNode itself
        firstMatchNode = firstMatchNode
      }

      // Split end node at the match boundary
      let lastMatchNode = endNode
      if (endInternal < (endNode.textContent || "").length) {
        endNode.splitText(endInternal)
        // endNode now contains [0, endInternal) — the match portion
      }

      // Wrap all text nodes from firstMatchNode through lastMatchNode
      const span = makeHighlightSpan(match.injection)
      const parent = firstMatchNode.parentNode
      if (!parent) return

      parent.insertBefore(span, firstMatchNode)

      let moveNode: Node | null = firstMatchNode
      let nodesWrapped = 0
      while (moveNode) {
        const next: Node | null = moveNode.nextSibling
        span.appendChild(moveNode)
        nodesWrapped++
        if (moveNode === endNode) break
        moveNode = next
      }

      count++
    }
  }

  // Process blocks in any order (they're independent), but within each block
  // process matches right-to-left to avoid offset invalidation.
  for (const [block, matches] of blockMatches) {
    // Sort right-to-left (descending startOffset)
    matches.sort((a, b) => b.startOffset - a.startOffset)

    for (const match of matches) {
      applyMatchToBlock(block, match)
    }
  }

  // ── Inject focus-flash keyframes once ──
  if (!document.getElementById("impulse-hl-focus-style")) {
    const style = document.createElement("style")
    style.id = "impulse-hl-focus-style"
    style.textContent = `
      @keyframes impulse-hl-flash {
        0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); background-color: var(--impulse-flash-bg, #fde68a) !important; }
        30%  { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.55); background-color: #fde68a !important; }
        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
      }
      .impulse-hl-focus { animation: impulse-hl-flash 1.2s ease-out 2; z-index: 5; position: relative; }
    `
    document.head.appendChild(style)
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

function focusHighlightOnPage(highlightId: string): boolean {
  const FOCUS_CLASS = "impulse-hl-focus"
  // Remove any previous focus markers
  const prevFocused = document.querySelectorAll("." + FOCUS_CLASS)
  for (let i = 0; i < prevFocused.length; i++) {
    prevFocused[i].classList.remove(FOCUS_CLASS)
  }

  const targets = document.querySelectorAll(`[data-impulse-id="${CSS.escape(highlightId)}"]`)
  if (targets.length === 0) return false

  const first = targets[0] as HTMLElement
  first.scrollIntoView({ behavior: "smooth", block: "center" })
  // Apply flash class after scroll begins so the animation is visible
  setTimeout(() => {
    first.classList.add(FOCUS_CLASS)
    // Auto-remove after animation completes
    setTimeout(() => first.classList.remove(FOCUS_CLASS), 2600)
  }, 250)

  return true
}

/**
 * Check if a tab is showing the Impulse PDF viewer page.
 * Returns true for chrome-extension://<id>/pdfviewer.html?url=... URLs.
 */
async function isImpulseViewerTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId)
    return !!tab.url && tab.url.includes("pdfviewer.html")
  } catch {
    return false
  }
}

/**
 * Apply highlights to the page. Accepts either:
 *   - an array of HighlightInjection objects (preferred, carries id/category/color), or
 *   - an array of strings (legacy; will be assigned default category and generated ids)
 *
 * For Impulse PDF viewer pages, sends a message instead of using executeScript,
 * because the viewer has its own highlight logic for PDF.js text layers.
 */
export async function applyHighlightsToPage(
  tabId: number,
  highlights: HighlightInjection[] | string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const injections: HighlightInjection[] = Array.isArray(highlights)
    ? highlights.map((h, idx) =>
        typeof h === "string"
          ? {
              id: `legacy_${Date.now()}_${idx}`,
              phrase: h,
              category: "default",
              color: getHighlightColor("default")
            }
          : h
      )
    : []

  if (injections.length === 0) {
    return { success: false, count: 0, error: "没有可应用的高亮" }
  }

  try {
    // If this is our Impulse PDF viewer page, send a message instead of executeScript
    if (await isImpulseViewerTab(tabId)) {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "APPLY_HIGHLIGHTS",
        injections
      })
      if (response?.success) {
        return { success: true, count: response.count || 0 }
      }
      return { success: false, count: 0, error: response?.error || "PDF 查看器未找到匹配文本" }
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectHighlightSentences,
      args: [injections]
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

/**
 * Scroll to and flash the highlight with the given id on the page.
 * For Impulse PDF viewer pages, sends a message instead of using executeScript.
 */
export async function focusHighlightById(
  tabId: number,
  highlightId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (await isImpulseViewerTab(tabId)) {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "FOCUS_HIGHLIGHT",
        highlightId
      })
      return { success: !!response?.success, error: response?.error }
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: focusHighlightOnPage,
      args: [highlightId]
    })

    for (const r of results) {
      if (r.result === true) return { success: true }
    }
    return { success: false, error: "未在页面找到该高亮（可能需要先 Reapply）" }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

/**
 * Clear all highlights on the page.
 * For Impulse PDF viewer pages, sends a message instead of using executeScript.
 */
export async function clearHighlightsOnPage(tabId: number): Promise<void> {
  try {
    if (await isImpulseViewerTab(tabId)) {
      await chrome.tabs.sendMessage(tabId, { type: "CLEAR_HIGHLIGHTS" })
      return
    }

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
