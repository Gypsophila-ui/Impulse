import { useState } from "react"

function IndexPopup() {
  const [selectedText, setSelectedText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReadSelection = async () => {
    setLoading(true)
    setError(null)

    try {
      // #region debug log: popup requesting selection
      fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "90a69d"
        },
        body: JSON.stringify({
          sessionId: "90a69d",
          runId: "debug_001",
          hypothesisId: "H4",
          location: "popup.tsx:handleReadSelection:start",
          message: "popup handleReadSelection started",
          data: { prevSelectedLen: selectedText.length },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab?.id) {
        throw new Error("未找到当前活动标签页")
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_SELECTION"
      })

      const text = response?.text ?? ""
      // #region debug log: popup received selection response
      fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "90a69d"
        },
        body: JSON.stringify({
          sessionId: "90a69d",
          runId: "debug_001",
          hypothesisId: "H4",
          location: "popup.tsx:handleReadSelection:response",
          message: "popup received selection",
          data: { tabId: tab.id, length: text.length, nonEmpty: text.trim().length > 0 },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      setSelectedText(text)
    } catch (e: any) {
      // #region debug log: popup fetchSelection error
      fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "90a69d"
        },
        body: JSON.stringify({
          sessionId: "90a69d",
          runId: "debug_001",
          hypothesisId: "H4",
          location: "popup.tsx:handleReadSelection:error",
          message: "popup handleReadSelection failed",
          data: { error: e?.message ?? String(e) },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      setError(e.message ?? "获取选中文本失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding: 16,
        width: 320
      }}>
      <h2>Impulse 论文助手</h2>

      <button
        onClick={handleReadSelection}
        disabled={loading}
        style={{
          padding: "6px 12px",
          marginBottom: 8,
          cursor: loading ? "not-allowed" : "pointer"
        }}>
        {loading ? "正在读取选中文本..." : "读取当前页选中文本"}
      </button>

      {error && (
        <div
          style={{
            color: "red",
            marginBottom: 8,
            fontSize: 12
          }}>
          {error}
        </div>
      )}

      <textarea
        readOnly
        value={selectedText}
        placeholder="在论文页面选中一段文字，然后点击上方按钮，这里会显示选中的文本。"
        style={{
          width: "100%",
          height: 160,
          resize: "vertical",
          fontSize: 12,
          boxSizing: "border-box"
        }}
      />
    </div>
  )
}

export default IndexPopup
