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

    // #region agent log: per-frame injection results (H11/H12)
    const perFrame = results.map((r) => ({
      frameId: r.frameId,
      len: typeof r.result === "string" ? r.result.length : 0,
      err: r.error ? String(r.error) : undefined
    }))
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_sidepanel_sel",
        hypothesisId: "H11",
        location: "utils/get-selection.ts:getSelectionInTab:frames",
        message: "executeScript per-frame results (ISOLATED)",
        data: {
          tabId,
          totalFrames: results.length,
          perFrame,
          nonEmptyCount: texts.length
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    if (texts.length === 0) {
      // #region agent log: compare MAIN world if ISOLATED all empty (H14) — log only, no behavior change yet
      try {
        const mainResults = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: () => (window.getSelection()?.toString() ?? "").trim()
        })
        const mainTexts = mainResults
          .map((r) => (typeof r.result === "string" ? r.result.trim() : ""))
          .filter((t) => t.length > 0)
        const mainBestLen =
          mainTexts.length === 0
            ? 0
            : mainTexts.reduce((a, b) => (a.length >= b.length ? a : b)).length
        fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "90a69d"
          },
          body: JSON.stringify({
            sessionId: "90a69d",
            runId: "debug_sidepanel_sel",
            hypothesisId: "H14",
            location: "utils/get-selection.ts:getSelectionInTab:mainWorldProbe",
            message: "executeScript MAIN world probe (compare to ISOLATED)",
            data: {
              tabId,
              mainFrames: mainResults.length,
              mainNonEmpty: mainTexts.length,
              mainBestLen
            },
            timestamp: Date.now()
          })
        }).catch(() => {})
      } catch (me: any) {
        fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "90a69d"
          },
          body: JSON.stringify({
            sessionId: "90a69d",
            runId: "debug_sidepanel_sel",
            hypothesisId: "H14",
            location: "utils/get-selection.ts:getSelectionInTab:mainWorldProbeError",
            message: "MAIN world probe failed",
            data: { tabId, error: me?.message ?? String(me) },
            timestamp: Date.now()
          })
        }).catch(() => {})
      }
      // #endregion
      return ""
    }

    const best = texts.reduce((a, b) => (a.length >= b.length ? a : b))

    // #region debug log: selection aggregation across frames
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "post-fix",
        hypothesisId: "H9",
        location: "utils/get-selection.ts:getSelectionInTab",
        message: "executeScript allFrames selection aggregate",
        data: {
          frameResults: results.length,
          nonEmptyFrames: texts.length,
          bestLen: best.length
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    return best
  } catch (e: any) {
    // #region agent log: executeScript top-level failure (H13)
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_sidepanel_sel",
        hypothesisId: "H13",
        location: "utils/get-selection.ts:getSelectionInTab:catch",
        message: "getSelectionInTab executeScript failed",
        data: { tabId, error: e?.message ?? String(e) },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
    throw e
  }
}
