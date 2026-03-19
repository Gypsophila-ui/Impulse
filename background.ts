const isProbablyPdfUrl = (url?: string) => {
  if (!url) return false
  const u = url.toLowerCase()
  // 简单启发式：大多数 PDF URL 会包含 ".pdf"
  if (u.endsWith(".pdf")) return true
  // arXiv 等常见页面是 /pdf/<paperId>，不带 .pdf 后缀
  return u.includes("/pdf/")
}

const openSidePanelForTab = async (tabId: number) => {
  try {
    if (!("sidePanel" in chrome)) return

    // 启用并切到指定页面
    // #region debug log: background opening side panel
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H1",
        location: "background.ts:openSidePanelForTab:start",
        message: "try open sidepanel",
        data: { tabId },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true
    })

    // 可能需要用户交互权限；失败的话也不影响 UI 可手动打开。
    await chrome.sidePanel.open({ tabId })

    // #region debug log: background opened side panel ok
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H1",
        location: "background.ts:openSidePanelForTab:success",
        message: "sidepanel opened",
        data: { tabId },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
  } catch (e: any) {
    // #region debug log: background open side panel failed
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H1",
        location: "background.ts:openSidePanelForTab:error",
        message: "sidepanel open failed",
        data: {
          error: e?.message ?? String(e),
          name: e?.name
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
    // ignore
  }
}

const handleTab = (tabId: number, url?: string) => {
  if (!isProbablyPdfUrl(url)) return
  // #region debug log: background matched pdf url
  fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "90a69d"
    },
    body: JSON.stringify({
      sessionId: "90a69d",
      runId: "debug_001",
      hypothesisId: "H1",
      location: "background.ts:handleTab",
      message: "matched pdf url",
      data: { tabId, url },
      timestamp: Date.now()
    })
  }).catch(() => {})
  // #endregion
  void openSidePanelForTab(tabId)
}

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id) handleTab(tab.id, tab.url)
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return
  handleTab(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  handleTab(activeInfo.tabId, tab.url)
})

