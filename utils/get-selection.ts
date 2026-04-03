/**
 * 在所有可注入的 frame 中读取 window.getSelection()，取最长非空字符串。
 * 避免 chrome.tabs.sendMessage 只收到顶层 frame 的空响应。
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

    const best = texts.reduce((a, b) => (a.length >= b.length ? a : b))

    return best
  } catch (e: any) {
    // 提供更清晰的错误信息
    const msg = e?.message ?? String(e)
    if (msg.includes("Cannot access")) {
      throw new Error("无法访问此页面，请确保扩展已授权访问该网站")
    }
    if (msg.includes("file://")) {
      throw new Error('需要授权访问本地文件。请在扩展详情页启用"允许访问文件网址"')
    }
    throw new Error(`读取选中文本失败: ${msg}`)
  }
}
