/**
 * 在所有可注入的 frame 中读取 window.getSelection()，取最长非空字符串。
 * 不读取剪贴板——用户可直接在 textarea 中粘贴。
 */
export async function getSelectionInTab(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => (window.getSelection()?.toString() ?? "").trim()
    })

    const texts = results
      .map((r) => (typeof r.result === "string" ? r.result.trim() : ""))
      .filter((t) => t.length > 0)

    if (texts.length === 0) {
      return ""
    }

    return texts.reduce((a, b) => (a.length >= b.length ? a : b))
  } catch {
    return ""
  }
}
