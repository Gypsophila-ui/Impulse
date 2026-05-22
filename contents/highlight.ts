import type { PlasmoCSConfig } from "plasmo"

// Run on all pages, in all frames (for PDF iframes)
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const HIGHLIGHT_CLASS = "impulse-sentence-hl"
const COLORS = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ddd6fe", "#fed7aa"]

function injectSentenceHighlights(phrases: string[]): number {
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

// Listen for messages from sidepanel (backward compatibility)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "APPLY_HIGHLIGHTS") {
    try {
      const phrases = message.phrases as string[]
      const totalCount = injectSentenceHighlights(phrases)
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
  }

  return true
})

export {}
