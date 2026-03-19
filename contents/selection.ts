import type { PlasmoCSConfig } from "plasmo"

// 允许在 PDF 查看器可能使用的 iframe/text-layer 等子 frame 中运行，
// 否则顶层 frame 里 `window.getSelection()` 可能永远为空。
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const getSelectionText = (): string => {
  const selection = window.getSelection()
  return selection ? selection.toString() : ""
}

const safeIsInIframe = (): boolean => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    // #region debug log: selection message received
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H2",
        location: "contents/selection.ts:GET_SELECTION",
        message: "content script got GET_SELECTION",
        data: {
          inIframe: safeIsInIframe(),
          href: window.location?.href
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    const text = getSelectionText()
    // #region debug log: selection text payload stats
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H3",
        location: "contents/selection.ts:selectionText",
        message: "selection extracted",
        data: {
          length: text.length,
          nonEmpty: text.trim().length > 0,
          sample: text.slice(0, 30)
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    // 始终响应，避免当 selection 在顶层 frame 读取为空时，
    // 请求端出现“Receiving end does not exist / 无反应”。
    sendResponse({ text })
  }
})

export {}

