import React, { useEffect, useMemo, useState } from "react"

import { getSelectionInTab } from "~utils/get-selection"

type TabKey = "summary" | "translation" | "highlight" | "comment"

const tabList: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "summary" },
  { key: "translation", label: "translation" },
  { key: "highlight", label: "highlight" },
  { key: "comment", label: "comment" }
]

const isSameText = (a: string, b: string) => a === b

export default function Sidepanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary")
  const [loadingSelection, setLoadingSelection] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedText, setSelectedText] = useState("")

  // 下面的 result 先做占位：你后续接 LLM 时只需要把对应 tab 的逻辑补上即可。
  const [output, setOutput] = useState<string>("")

  const [commentDraft, setCommentDraft] = useState("")

  const fetchSelection = async () => {
    setLoadingSelection(true)
    setError(null)

    try {
      // #region debug log: sidepanel requesting selection
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
          location: "sidepanel.tsx:fetchSelection:start",
          message: "sidepanel fetchSelection started",
          data: {
            activeTab,
            prevSelectedLen: selectedText.length
          },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error("未找到当前活动标签页")
      }

      // #region agent log: tab context for sidepanel selection (H10)
      fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "90a69d"
        },
        body: JSON.stringify({
          sessionId: "90a69d",
          runId: "debug_sidepanel_sel",
          hypothesisId: "H10",
          location: "sidepanel.tsx:fetchSelection:tabContext",
          message: "tabs.query active tab before getSelectionInTab",
          data: {
            tabId: tab.id,
            url: tab.url?.slice(0, 120),
            windowId: tab.windowId,
            active: tab.active
          },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      const text = await getSelectionInTab(tab.id)
      // #region debug log: sidepanel got selection via executeScript
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
          location: "sidepanel.tsx:fetchSelection:response",
          message: "sidepanel received selection (executeScript allFrames)",
          data: {
            tabId: tab.id,
            length: text.length,
            nonEmpty: text.trim().length > 0
          },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      setSelectedText((prev) => (isSameText(prev, text) ? prev : text))

      // 切到不同栏目时，output 的语义会变化：这里简单清空，避免“上一个 tab 的输出污染当前 tab”。
      setOutput("")
    } catch (e: any) {
      // #region debug log: sidepanel fetchSelection error
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
          location: "sidepanel.tsx:fetchSelection:error",
          message: "sidepanel fetchSelection failed",
          data: { error: e?.message ?? String(e) },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion

      setError(e?.message ?? "读取选中文本失败")
    } finally {
      setLoadingSelection(false)
    }
  }

  useEffect(() => {
    // #region debug log: sidepanel mounted
    fetch("http://127.0.0.1:7737/ingest/52952637-7620-4e97-8ad5-b06f4329efb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "90a69d"
      },
      body: JSON.stringify({
        sessionId: "90a69d",
        runId: "debug_001",
        hypothesisId: "H8",
        location: "sidepanel.tsx:mount",
        message: "sidepanel mounted",
        data: { activeTab },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion

    void fetchSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canUseSelection = useMemo(() => selectedText.trim().length > 0, [selectedText])

  return (
    <div
      style={{
        width: 380,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial'
      }}>
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #e5e7eb",
          background: "#fff"
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: "18px" }}>Impulse</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>PDF 右侧阅读助手</div>
          </div>
          <button
            onClick={() => void fetchSelection()}
            disabled={loadingSelection}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              cursor: loadingSelection ? "not-allowed" : "pointer"
            }}>
            {loadingSelection ? "读取中..." : "刷新选中"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {tabList.map((t) => {
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: isActive ? "1px solid #111827" : "1px solid #e5e7eb",
                  background: isActive ? "#111827" : "#f9fafb",
                  color: isActive ? "#fff" : "#111827",
                  cursor: "pointer"
                }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {error && (
          <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{error}</div>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ padding: 12, overflow: "auto" }}>
        <div style={{ color: "#111827", fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
          {activeTab === "summary" && "Summary（当前选中文本摘要）"}
          {activeTab === "translation" && "Translation（当前选中文本翻译）"}
          {activeTab === "highlight" && "Highlight（为选中文本生成高亮/标签，后续实现）"}
          {activeTab === "comment" && "Comment（给选中文本做笔记，后续可保存）"}
        </div>

        {/* 通用：展示选中文本 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>当前选中</div>
          <textarea
            readOnly
            value={selectedText}
            placeholder="先在 PDF 页面选中一段文字，然后点击“刷新选中”或切换栏目。"
            style={{
              width: "100%",
              minHeight: 120,
              fontSize: 12,
              resize: "vertical",
              boxSizing: "border-box",
              padding: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 10
            }}
          />
        </div>

        {/* 各栏操作（先放占位逻辑） */}
        {activeTab === "summary" && (
          <div>
            <button
              disabled={!canUseSelection}
              onClick={() => {
                // TODO: 接 LLM，总结 selectedText。
                setOutput(canUseSelection ? "（占位）后续将调用 LLM 生成摘要。" : "请先选择文本。")
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: canUseSelection ? "#2563eb" : "#93c5fd",
                color: "#fff",
                border: "none",
                cursor: canUseSelection ? "pointer" : "not-allowed"
              }}>
              生成摘要
            </button>
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>输出</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 80
                }}>
                {output || "（尚无输出）"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "translation" && (
          <div>
            <button
              disabled={!canUseSelection}
              onClick={() => {
                // TODO: 接 LLM 翻译 selectedText。
                setOutput(canUseSelection ? "（占位）后续将调用 LLM 生成翻译。" : "请先选择文本。")
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: canUseSelection ? "#10b981" : "#6ee7b7",
                color: "#fff",
                border: "none",
                cursor: canUseSelection ? "pointer" : "not-allowed"
              }}>
              翻译
            </button>
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>输出</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 80
                }}>
                {output || "（尚无输出）"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "highlight" && (
          <div>
            <button
              disabled={!canUseSelection}
              onClick={() => {
                // TODO: 接 LLM 生成标签/要点，然后再映射回页面高亮（需要 dom 定位）。
                setOutput(
                  canUseSelection
                    ? "（占位）后续将根据选中文本生成高亮建议。"
                    : "请先选择文本。"
                )
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: canUseSelection ? "#f59e0b" : "#fde68a",
                color: "#111827",
                border: "none",
                cursor: canUseSelection ? "pointer" : "not-allowed"
              }}>
              生成高亮建议
            </button>
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>输出</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 80
                }}>
                {output || "（尚无输出）"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "comment" && (
          <div>
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>
              注释（后续可以绑定到选中文本并保存）
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="输入你的评论/疑问/复现要点..."
              style={{
                width: "100%",
                minHeight: 120,
                fontSize: 12,
                resize: "vertical",
                boxSizing: "border-box",
                padding: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 10
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                disabled={!canUseSelection}
                onClick={() => {
                  // TODO: 将 commentDraft + selectedText 保存为笔记。
                  setOutput(
                    canUseSelection
                      ? "（占位）后续将保存笔记，并关联到选中文本。"
                      : "请先选择文本。"
                  )
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: canUseSelection ? "#111827" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  cursor: canUseSelection ? "pointer" : "not-allowed"
                }}>
                保存笔记（占位）
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>输出</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: "16px",
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 80
                }}>
                {output || "（尚无输出）"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

