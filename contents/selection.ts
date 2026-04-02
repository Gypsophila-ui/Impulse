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

/**
 * 扩展热重载/更新后，旧页面里的 content script 仍会执行，但 `chrome.runtime` 已失效，
 * 此时访问会抛出 `Extension context invalidated`。
 */
const isExtensionContextValid = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === “GET_SELECTION”) {
    if (!isExtensionContextValid()) {
      return
    }

    const text = getSelectionText()

    // 始终响应，避免当 selection 在顶层 frame 读取为空时，
    // 请求端出现”Receiving end does not exist / 无反应”。
    try {
      sendResponse({ text })
    } catch {
      // 上下文可能在 sendResponse 瞬间已失效
    }
  }
})

export {}

