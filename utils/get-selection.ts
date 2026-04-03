/**
 * 在所有可注入的 frame 中读取 window.getSelection()，取最长非空字符串。
 * 若 executeScript 拿不到（Chrome PDF 查看器限制），则尝试从剪贴板读取。
 */
export async function getSelectionInTab(tabId: number): Promise<string> {
  // 方法 1：executeScript 注入所有 frame 读取 selection
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => (window.getSelection()?.toString() ?? "").trim()
    })

    const texts = results
      .map((r) => (typeof r.result === "string" ? r.result.trim() : ""))
      .filter((t) => t.length > 0)

    if (texts.length > 0) {
      return texts.reduce((a, b) => (a.length >= b.length ? a : b))
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    if (msg.includes("Cannot access")) {
      // 权限问题，继续尝试剪贴板
    } else if (msg.includes("file://")) {
      throw new Error('需要授权访问本地文件。请在扩展详情页启用"允许访问文件网址"')
    }
    // 其他错误也继续尝试剪贴板
  }

  // 方法 2：尝试从剪贴板读取（用户需先 Ctrl+C）
  try {
    const clipText = await navigator.clipboard.readText()
    if (clipText && clipText.trim().length > 0) {
      return clipText.trim()
    }
  } catch {
    // 剪贴板读取失败
  }

  return ""
}
