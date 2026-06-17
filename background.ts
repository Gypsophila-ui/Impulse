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
  return url.includes("pdfviewer.html")
}

/**
 * Build the Impulse PDF viewer URL for a given PDF source URL.
 */
const buildViewerUrl = (pdfUrl: string): string => {
  const viewerUrl = chrome.runtime.getURL("pdfviewer.html")
  return `${viewerUrl}?url=${encodeURIComponent(pdfUrl)}`
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
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id) handleTab(tab.id, tab.url)
  }
})

chrome.runtime.onStartup.addListener(() => {
  ensureOpenSidePanelOnActionClick()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return
  handleTab(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  handleTab(activeInfo.tabId, tab.url)
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

