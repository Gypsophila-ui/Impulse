const isProbablyPdfUrl = (url?: string) => {
  if (!url) return false
  const u = url.toLowerCase()
  // 简单启发式：大多数 PDF URL 会包含 ".pdf"
  if (u.endsWith(".pdf")) return true
  // arXiv 等常见页面是 /pdf/<paperId>，不带 .pdf 后缀
  return u.includes("/pdf/")
}

/**
 * Check if a URL is already the Impulse PDF viewer page.
 */
const isImpulseViewerUrl = (url?: string) => {
  if (!url) return false
  return url.includes("tabs/pdfviewer.html")
}

/**
 * Build the Impulse PDF viewer URL for a given PDF source URL.
 */
const buildViewerUrl = (pdfUrl: string): string => {
  const viewerUrl = chrome.runtime.getURL("tabs/pdfviewer.html")
  return `${viewerUrl}?url=${encodeURIComponent(pdfUrl)}`
}

// ─── Context menu for highlight ──────────────────────────────────────────────
// Menu structure:
//   "Impulse 高亮" (parent, only visible when text is selected)
//     ├─ 重要 (important)
//     ├─ 疑问 (question)
//     ├─ 定义 (definition)
//     ├─ 方法 (method)
//     └─ 普通 (default)

const CONTEXT_MENU_PARENT_ID = "impulse-highlight-parent"
const CONTEXT_MENU_CATEGORY_PREFIX = "impulse-highlight-"

const CATEGORY_LABELS: Record<string, string> = {
  important: "重要",
  question: "疑问",
  definition: "定义",
  method: "方法",
  default: "普通"
}

const CATEGORY_COLORS: Record<string, string> = {
  important: "#fef08a",
  question: "#fecaca",
  definition: "#bfdbfe",
  method: "#bbf7d0",
  default: "#fed7aa"
}

const CATEGORY_ORDER = ["important", "question", "definition", "method", "default"]

const setupContextMenu = () => {
  // Remove all existing entries first (safe to call on every install/startup)
  chrome.contextMenus.removeAll(() => {
    // Parent item — only visible when text is selected
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PARENT_ID,
      title: "Impulse 高亮",
      contexts: ["selection"]
    })

    // Child items — one per category
    for (const cat of CATEGORY_ORDER) {
      chrome.contextMenus.create({
        id: `${CONTEXT_MENU_CATEGORY_PREFIX}${cat}`,
        parentId: CONTEXT_MENU_PARENT_ID,
        title: `${CATEGORY_LABELS[cat]} (${cat})`,
        contexts: ["selection"]
      })
    }
  })
}

/**
 * Chrome 限制：`sidePanel.open()` 只能在用户手势上下文中调用。
 * 后台事件（tabs.onUpdated 等）里调用会抛错（日志已证实）。
 * 这里仅注册当前标签页的侧边栏页面；用户点击工具栏图标打开侧栏（见下方 setPanelBehavior）。
 */
const configureSidePanelForTab = async (tabId: number) => {
  try {
    if (!("sidePanel" in chrome)) return

    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true
    })
  } catch (e: any) {
    // Silently handle errors
  }
}

const handleTab = (tabId: number, url?: string) => {
  if (!isProbablyPdfUrl(url) && !isImpulseViewerUrl(url)) return
  void configureSidePanelForTab(tabId)
}

const ensureOpenSidePanelOnActionClick = () => {
  if (!("sidePanel" in chrome)) return
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
}

chrome.runtime.onInstalled.addListener(async () => {
  ensureOpenSidePanelOnActionClick()
  setupContextMenu()
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id) handleTab(tab.id, tab.url)
  }
})

chrome.runtime.onStartup.addListener(() => {
  ensureOpenSidePanelOnActionClick()
  setupContextMenu()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return
  handleTab(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  handleTab(activeInfo.tabId, tab.url)
})

// ─── Context menu click handler ──────────────────────────────────────────────
// When user selects a category from the right-click menu:
//   1. Save the highlight to chrome.storage.local (with category + color)
//   2. Inject the highlight into the page DOM:
//      - Impulse PDF viewer page → sendMessage (viewer has its own logic)
//      - Normal web page → chrome.scripting.executeScript
//   3. Notify the sidebar to refresh its highlight list

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Type guard: info.menuItemId can be string | number. Only handle our string IDs.
  const menuItemId = info.menuItemId
  if (typeof menuItemId !== "string") return
  // Only handle our category child items
  if (!menuItemId.startsWith(CONTEXT_MENU_CATEGORY_PREFIX)) return
  if (!info.selectionText || !tab?.id || !tab.url) return

  const category = menuItemId.slice(CONTEXT_MENU_CATEGORY_PREFIX.length) as
    | "important" | "question" | "definition" | "method" | "default"

  const selectedText = info.selectionText.trim()
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default

  // Determine effective URL (for Impulse viewer pages, use the original PDF URL as storage key)
  let storageUrl = tab.url
  if (isImpulseViewerUrl(tab.url)) {
    try {
      const params = new URLSearchParams(tab.url.split("?")[1])
      const originalUrl = params.get("url")
      if (originalUrl) storageUrl = originalUrl
    } catch {
      // fall through with tab.url
    }
  }

  try {
    // 1. Save highlight to storage
    const STORAGE_KEY = "impulse_highlights"
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const highlights = result[STORAGE_KEY] || []
    const newHighlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phrase: selectedText,
      sourceText: selectedText,
      url: storageUrl,
      pageTitle: tab.title || "Untitled",
      timestamp: Date.now(),
      color,
      category
    }
    highlights.push(newHighlight)
    await chrome.storage.local.set({ [STORAGE_KEY]: highlights })

    // 2. Inject highlight into the page
    const injection = {
      id: newHighlight.id,
      phrase: newHighlight.phrase,
      category,
      color
    }

    if (isImpulseViewerUrl(tab.url)) {
      // Impulse PDF viewer page — send message
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "APPLY_HIGHLIGHTS",
          injections: [injection]
        })
      } catch (e) {
        console.error("[Impulse] Failed to send highlight to viewer:", e)
      }
    } else if (isProbablyPdfUrl(tab.url)) {
      // Native Chrome PDF viewer (e.g. arxiv.org/pdf/xxxx) — executeScript cannot
      // inject into the privileged pdf-viewer page. Redirect the user to the
      // Impulse viewer, which can render highlights. The saved highlight will be
      // applied automatically because storageUrl matches the original PDF URL.
      const viewerUrl = buildViewerUrl(tab.url)
      await chrome.tabs.update(tab.id, { url: viewerUrl })
      // Note: highlight injection will happen via the viewer's auto-apply on load,
      // or the sidebar can re-apply once the viewer is ready.
    } else {
      // Normal web page — use executeScript with inline injection function
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: (inj: { id: string; phrase: string; category: string; color: string }) => {
            const HIGHLIGHT_CLASS = "impulse-sentence-hl"
            const lowerPhrase = inj.phrase.toLowerCase()

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
            for (const textNode of textNodes) {
              const text = textNode.textContent || ""
              if (!text.trim()) continue

              const sentences: { text: string; match: boolean }[] = []
              const sentenceRegex = /[^.!?\n]+[.!?]*\n*/g
              let m: RegExpExecArray | null
              while ((m = sentenceRegex.exec(text)) !== null) {
                const sentenceText = m[0]
                const match = sentenceText.toLowerCase().indexOf(lowerPhrase) !== -1
                sentences.push({ text: sentenceText, match })
              }

              let hasMatch = false
              for (const s of sentences) {
                if (s.match) { hasMatch = true; break }
              }
              if (!hasMatch) continue

              const parent = textNode.parentNode
              if (!parent) continue

              const fragment = document.createDocumentFragment()
              for (const s of sentences) {
                if (s.match) {
                  const span = document.createElement("span")
                  span.className = HIGHLIGHT_CLASS
                  span.setAttribute("data-impulse-id", inj.id)
                  span.setAttribute("data-impulse-category", inj.category)
                  span.style.backgroundColor = inj.color
                  span.style.padding = "2px 4px"
                  span.style.borderRadius = "3px"
                  span.style.transition = "box-shadow 0.3s ease"
                  span.style.cursor = "pointer"
                  span.title = `Impulse 高亮 · ${inj.category}`
                  span.textContent = s.text
                  fragment.appendChild(span)
                  count++
                } else {
                  fragment.appendChild(document.createTextNode(s.text))
                }
              }

              parent.replaceChild(fragment, textNode)
            }

            // Inject focus-flash keyframes once
            if (!document.getElementById("impulse-hl-focus-style")) {
              const style = document.createElement("style")
              style.id = "impulse-hl-focus-style"
              style.textContent = `
                @keyframes impulse-hl-flash {
                  0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
                  30%  { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.55); background-color: #fde68a !important; }
                  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
                }
                .impulse-hl-focus { animation: impulse-hl-flash 1.2s ease-out 2; z-index: 5; position: relative; }
              `
              document.head.appendChild(style)
            }

            return count
          },
          args: [injection]
        })
      } catch (e) {
        console.error("[Impulse] Failed to inject highlight into page:", e)
      }
    }

    // 3. Notify sidebar to refresh highlights
    chrome.runtime.sendMessage({
      type: "HIGHLIGHT_UPDATED",
      url: storageUrl
    }).catch(() => {
      // Sidebar might not be open; silently ignore
    })
  } catch (e: any) {
    console.error("[Impulse] Context menu highlight failed:", e)
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "QUICK_ACTION") {
    chrome.runtime.sendMessage({
      type: "QUICK_ACTION_FROM_BG",
      action: message.action,
      text: message.text,
      url: message.url,
      title: message.title
    }).catch(() => {})
    return false
  }

  // Open a PDF URL in the Impulse PDF viewer (new tab)
  if (message.type === "OPEN_IN_IMPULSE_VIEWER") {
    const pdfUrl = message.url as string
    if (!pdfUrl) {
      sendResponse({ success: false, error: "No URL provided" })
      return false
    }
    const viewerUrl = buildViewerUrl(pdfUrl)
    chrome.tabs.create({ url: viewerUrl }).then((tab) => {
      sendResponse({ success: true, tabId: tab.id })
    }).catch((e: any) => {
      sendResponse({ success: false, error: e?.message ?? String(e) })
    })
    return true
  }

  return false
})

