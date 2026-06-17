import type { PlasmoCSConfig } from "plasmo"

// Run on all pages, in all frames (for PDF iframes)
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const HIGHLIGHT_CLASS = "impulse-sentence-hl"
const FOCUS_CLASS = "impulse-hl-focus"

interface InjectionPayload {
  id: string
  phrase: string
  category?: string
  color: string
}

function injectSentenceHighlights(injections: InjectionPayload[]): number {
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isSkippable((node as Text).parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  interface TextSegment {
    node: Text
    start: number
    end: number
  }

  interface TextBlock {
    element: Element
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
  const lowerInjections = injections.map((inj) => ({
    ...inj,
    lowerPhrase: inj.phrase.toLowerCase()
  }))
  const SENTENCE_REGEX = /[^.!?\n]+[.!?]*\n*/g

  interface MatchSpan {
    startOffset: number
    endOffset: number
    injection: InjectionPayload & { lowerPhrase: string }
  }

  const blockMatches = new Map<TextBlock, MatchSpan[]>()

  for (const block of blocks) {
    const matches: MatchSpan[] = []
    const lowerFullText = block.fullText.toLowerCase()
    let sm: RegExpExecArray | null

    while ((sm = SENTENCE_REGEX.exec(block.fullText)) !== null) {
      const sentStart = sm.index
      const sentEnd = sentStart + sm[0].length
      const lowerSent = sm[0].toLowerCase()

      for (const inj of lowerInjections) {
        if (lowerSent.indexOf(inj.lowerPhrase) !== -1) {
          matches.push({
            startOffset: sentStart,
            endOffset: sentEnd,
            injection: inj
          })
          break
        }
      }
    }

    if (matches.length > 0) {
      blockMatches.set(block, matches)
    }
  }

  // ── Pass 3: Apply matches to each block (right-to-left within each block) ──
  let count = 0

  function applyMatchToBlock(block: TextBlock, match: MatchSpan): void {
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
      const beforeLen = startInternal
      const matchLen = endInternal - startInternal

      let matchNode = startNode
      if (beforeLen > 0) {
        matchNode = startNode.splitText(beforeLen)
      }
      if (matchLen < (matchNode.textContent || "").length) {
        matchNode.splitText(matchLen)
      }

      const span = document.createElement("span")
      span.className = HIGHLIGHT_CLASS
      span.setAttribute("data-impulse-id", match.injection.id)
      if (match.injection.category) {
        span.setAttribute("data-impulse-category", match.injection.category)
      }
      span.style.backgroundColor = match.injection.color
      span.style.padding = "2px 4px"
      span.style.borderRadius = "3px"
      span.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease"
      span.style.cursor = "pointer"
      span.title = `Impulse 高亮 · ${match.injection.category || "default"}`
      const parent = matchNode.parentNode
      if (parent) {
        parent.replaceChild(span, matchNode)
        span.appendChild(matchNode)
        count++
      }
    } else {
      let firstMatchNode = startNode
      if (startInternal > 0) {
        firstMatchNode = startNode.splitText(startInternal)
      }

      if (endInternal < (endNode.textContent || "").length) {
        endNode.splitText(endInternal)
      }

      const span = document.createElement("span")
      span.className = HIGHLIGHT_CLASS
      span.setAttribute("data-impulse-id", match.injection.id)
      if (match.injection.category) {
        span.setAttribute("data-impulse-category", match.injection.category)
      }
      span.style.backgroundColor = match.injection.color
      span.style.padding = "2px 4px"
      span.style.borderRadius = "3px"
      span.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease"
      span.style.cursor = "pointer"
      span.title = `Impulse 高亮 · ${match.injection.category || "default"}`
      const parent = firstMatchNode.parentNode
      if (!parent) return

      parent.insertBefore(span, firstMatchNode)

      let moveNode: Node | null = firstMatchNode
      while (moveNode) {
        const next: Node | null = moveNode.nextSibling
        span.appendChild(moveNode)
        if (moveNode === endNode) break
        moveNode = next
      }

      count++
    }
  }

  for (const [block, matches] of blockMatches) {
    matches.sort((a, b) => b.startOffset - a.startOffset)
    for (const match of matches) {
      applyMatchToBlock(block, match)
    }
  }

  // Inject focus-flash keyframes once
  if (!document.getElementById("impulse-hl-focus-style")) {
    const style = document.createElement("style")
    style.id = "impulse-hl-focus-style"
    style.textContent = `
      @keyframes impulse-hl-flash {
        0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); background-color: #fde68a !important; }
        30%  { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.55); background-color: #fde68a !important; }
        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
      }
      .impulse-hl-focus { animation: impulse-hl-flash 1.2s ease-out 2; z-index: 5; position: relative; }
    `
    document.head.appendChild(style)
  }

  return count
}

function clearSentenceHighlights(): void {
  const existing = document.querySelectorAll("." + HIGHLIGHT_CLASS)
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i] as HTMLElement
    const p = el.parentNode
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ""), el)
    }
  }
}

function focusHighlightById(highlightId: string): boolean {
  // Remove any previous focus markers
  const prevFocused = document.querySelectorAll("." + FOCUS_CLASS)
  for (let i = 0; i < prevFocused.length; i++) {
    prevFocused[i].classList.remove(FOCUS_CLASS)
  }

  const targets = document.querySelectorAll(`[data-impulse-id="${CSS.escape(highlightId)}"]`)
  if (targets.length === 0) return false

  const first = targets[0] as HTMLElement
  first.scrollIntoView({ behavior: "smooth", block: "center" })
  setTimeout(() => {
    first.classList.add(FOCUS_CLASS)
    setTimeout(() => first.classList.remove(FOCUS_CLASS), 2600)
  }, 250)

  return true
}

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "APPLY_HIGHLIGHTS") {
    try {
      const injections = (message.injections || []) as InjectionPayload[]
      const totalCount = injections.length > 0
        ? injectSentenceHighlights(injections)
        : 0
      sendResponse({ success: totalCount > 0, count: totalCount })
    } catch (e: any) {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    }
  } else if (message.type === "CLEAR_HIGHLIGHTS") {
    try {
      clearSentenceHighlights()
      sendResponse({ success: true })
    } catch (e: any) {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    }
  } else if (message.type === "FOCUS_HIGHLIGHT") {
    try {
      const found = focusHighlightById(message.highlightId as string)
      sendResponse({ success: found })
    } catch (e: any) {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    }
  }

  return true
})

export {}
