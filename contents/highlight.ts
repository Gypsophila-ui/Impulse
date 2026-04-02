import type { PlasmoCSConfig } from "plasmo"

// Run on all pages, in all frames (for PDF iframes)
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Track highlighted elements to enable cleanup
const highlightedElements: HTMLElement[] = []

/**
 * Apply highlight to text in the page
 */
function highlightText(phrase: string, color: string = "#fef08a"): number {
  let count = 0

  // Create a TreeWalker to find all text nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip script, style, and already highlighted elements
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT
      }
      if (parent.classList.contains("impulse-highlight")) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Node[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node)
  }

  // Highlight matching text in each text node
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || ""
    const lowerText = text.toLowerCase()
    const lowerPhrase = phrase.toLowerCase()

    let index = lowerText.indexOf(lowerPhrase)
    if (index === -1) return

    // Create highlighted version
    const parent = textNode.parentNode
    if (!parent) return

    const fragment = document.createDocumentFragment()
    let lastIndex = 0

    while (index !== -1) {
      // Add text before match
      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)))
      }

      // Add highlighted match
      const mark = document.createElement("mark")
      mark.className = "impulse-highlight"
      mark.style.backgroundColor = color
      mark.style.padding = "2px 0"
      mark.style.borderRadius = "2px"
      mark.textContent = text.substring(index, index + phrase.length)
      fragment.appendChild(mark)
      highlightedElements.push(mark)
      count++

      lastIndex = index + phrase.length
      index = lowerText.indexOf(lowerPhrase, lastIndex)
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)))
    }

    parent.replaceChild(fragment, textNode)
  })

  return count
}

/**
 * Remove all highlights from the page
 */
function clearHighlights(): void {
  highlightedElements.forEach((element) => {
    const parent = element.parentNode
    if (parent) {
      const textNode = document.createTextNode(element.textContent || "")
      parent.replaceChild(textNode, element)
    }
  })
  highlightedElements.length = 0
}

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "APPLY_HIGHLIGHTS") {
    try {
      clearHighlights()
      const phrases = message.phrases as string[]
      const color = message.color || "#fef08a"
      let totalCount = 0

      phrases.forEach((phrase) => {
        const count = highlightText(phrase, color)
        totalCount += count
      })

      sendResponse({ success: true, count: totalCount })
    } catch (e: any) {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    }
  } else if (message.type === "CLEAR_HIGHLIGHTS") {
    try {
      clearHighlights()
      sendResponse({ success: true })
    } catch (e: any) {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    }
  }

  return true // Keep the message channel open for async response
})

export {}
