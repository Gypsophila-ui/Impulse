const isProbablyPdfUrl = (url?: string) => {
  if (!url) return false
  const u = url.toLowerCase()
  // 简单启发式：大多数 PDF URL 会包含 ".pdf"
  if (u.endsWith(".pdf")) return true
  // arXiv 等常见页面是 /pdf/<paperId>，不带 .pdf 后缀
  return u.includes("/pdf/")
}

/**
 * Chrome 限制：`sidePanel.open()` 只能在用户手势上下文中调用。
 * 后台事件（tabs.onUpdated 等）里调用会抛错（日志已证实）。
 * 这里仅注册当前标签页的侧边栏页面，实际打开由 popup 按钮等用户手势触发。
 */
const configureSidePanelForTab = async (tabId: number) => {
  try {
    if (!("sidePanel" in chrome)) return

    // #region debug log: background configuring side panel
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "post-fix",
        hypothesisId: "H1",
        location: "background.ts:configureSidePanelForTab:start",
        message: "setOptions sidepanel for tab",
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

    // #region debug log: background side panel configured
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "post-fix",
        hypothesisId: "H1",
        location: "background.ts:configureSidePanelForTab:success",
        message: "setOptions ok (no auto open)",
        data: { tabId },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
  } catch (e: any) {
    // #region debug log: background setOptions failed
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "post-fix",
        hypothesisId: "H1",
        location: "background.ts:configureSidePanelForTab:error",
        message: "setOptions failed",
        data: {
          error: e?.message ?? String(e),
          name: e?.name
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
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
  void configureSidePanelForTab(tabId)
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

