import React, { useEffect, useMemo, useState } from "react"

import { getSelectionInTab } from "~utils/get-selection"
import { summarize, translate } from "~utils/llm-client"
import { hasApiKey } from "~utils/storage"

type TabKey = "summary" | "translation" | "highlight" | "comment"

const tabList: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "translation", label: "Translate", icon: "🌐" },
  { key: "highlight", label: "Highlight", icon: "✨" },
  { key: "comment", label: "Comment", icon: "💬" }
]

// 加载动画组件
const Spinner = () => (
  <div
    style={{
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid rgba(255, 255, 255, 0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite"
    }}
  />
)

const isSameText = (a: string, b: string) => a === b

export default function Sidepanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary")
  const [loadingSelection, setLoadingSelection] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedText, setSelectedText] = useState("")

  // 下面的 result 先做占位：你后续接 LLM 时只需要把对应 tab 的逻辑补上即可。
  const [output, setOutput] = useState<string>("")

  const [commentDraft, setCommentDraft] = useState("")

  const [loading, setLoading] = useState(false)
  const [hasKey, setHasKey] = useState(false)

  const fetchSelection = async () => {
    setLoadingSelection(true)
    setError(null)

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error(“未找到当前活动标签页”)
      }

      const text = await getSelectionInTab(tab.id)

      setSelectedText((prev) => (isSameText(prev, text) ? prev : text))

      // 切到不同栏目时，output 的语义会变化：这里简单清空，避免”上一个 tab 的输出污染当前 tab”。
      setOutput(“”)
    } catch (e: any) {
      setError(e?.message ?? “读取选中文本失败”)
    } finally {
      setLoadingSelection(false)
    }
  }

  useEffect(() => {
    void fetchSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    hasApiKey().then(setHasKey)
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
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial',
        background: "#f9fafb"
      }}>
      {/* CSS 动画定义 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-hover {
          transition: all 0.2s ease;
        }
        .btn-hover:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .btn-hover:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .tab-btn {
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>

      {/* 头部区域 */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
          color: "#fff",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, lineHeight: "24px", marginBottom: 4 }}>
              ⚡ Impulse
            </div>
            <div style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 12 }}>
              AI-Powered PDF Assistant
            </div>
          </div>
          <button
            onClick={() => void fetchSelection()}
            disabled={loadingSelection}
            className="btn-hover"
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: loadingSelection ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: 8,
              cursor: loadingSelection ? "not-allowed" : "pointer",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
            {loadingSelection ? (
              <>
                <Spinner /> Loading...
              </>
            ) : (
              "🔄 Refresh"
            )}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {tabList.map((t) => {
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="tab-btn"
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.15)",
                  color: isActive ? "#3b82f6" : "rgba(255, 255, 255, 0.9)",
                  cursor: "pointer",
                  backdropFilter: "blur(10px)",
                  boxShadow: isActive ? "0 2px 8px rgba(0, 0, 0, 0.1)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4
                }}>
                <div style={{ fontSize: 16 }}>{t.icon}</div>
                <div>{t.label}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            margin: "12px 12px 0",
            padding: "12px",
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#991b1b",
            fontSize: 12,
            lineHeight: "18px",
            animation: "fadeIn 0.3s ease",
            display: "flex",
            alignItems: "start",
            gap: 8
          }}>
          <div style={{ fontSize: 16 }}>⚠️</div>
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}
      </div>

      {/* 内容区 */}
      <div style={{ padding: 16, overflow: “auto”, flex: 1 }}>
        <div
          style={{
            color: “#111827”,
            fontWeight: 700,
            marginBottom: 12,
            fontSize: 14,
            display: “flex”,
            alignItems: “center”,
            gap: 8
          }}>
          <span style={{ fontSize: 20 }}>{tabList.find((t) => t.key === activeTab)?.icon}</span>
          <span>
            {activeTab === “summary” && “AI Summary”}
            {activeTab === “translation” && “AI Translation”}
            {activeTab === “highlight” && “Smart Highlight”}
            {activeTab === “comment” && “Quick Notes”}
          </span>
        </div>

        {/* 通用：展示选中文本 */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              color: “#6b7280”,
              fontSize: 11,
              marginBottom: 8,
              fontWeight: 600,
              textTransform: “uppercase”,
              letterSpacing: “0.5px”
            }}>
            📄 Selected Text
          </div>
          <textarea
            readOnly
            value={selectedText}
            placeholder=”Select text from the PDF page, then click 'Refresh' button above.”
            style={{
              width: “100%”,
              minHeight: 100,
              fontSize: 12,
              lineHeight: “18px”,
              resize: “vertical”,
              boxSizing: “border-box”,
              padding: 12,
              border: “2px solid #e5e7eb”,
              borderRadius: 10,
              background: “#fff”,
              color: “#374151”,
              fontFamily: “inherit”,
              transition: “border-color 0.2s ease”,
              outline: “none”
            }}
            onFocus={(e) => (e.target.style.borderColor = “#3b82f6”)}
            onBlur={(e) => (e.target.style.borderColor = “#e5e7eb”)}
          />
          {selectedText && (
            <div style={{ marginTop: 6, fontSize: 11, color: “#6b7280” }}>
              {selectedText.length} characters selected
            </div>
          )}
        </div>

        {/* 各栏操作 */}
        {activeTab === "summary" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <button
              disabled={!canUseSelection || loading}
              onClick={async () => {
                if (!hasKey) {
                  setOutput(
                    "⚠️ API Key Not Configured\n\nPlease configure your OpenAI API Key first:\n1. Right-click extension icon\n2. Select 'Options'\n3. Enter your API Key"
                  )
                  return
                }
                setLoading(true)
                setOutput("✨ Generating summary...")
                try {
                  const result = await summarize(selectedText)
                  setOutput(result)
                } catch (e: any) {
                  setOutput(`❌ Failed to generate summary:\n\n${e?.message ?? String(e)}`)
                } finally {
                  setLoading(false)
                }
              }}
              className="btn-hover"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background:
                  canUseSelection && !loading
                    ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                    : "#cbd5e1",
                color: "#fff",
                border: "none",
                cursor: canUseSelection && !loading ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow:
                  canUseSelection && !loading ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "none"
              }}>
              {loading ? (
                <>
                  <Spinner /> Generating...
                </>
              ) : (
                <>📝 Generate Summary</>
              )}
            </button>
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 8,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                💡 Output
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 120,
                  background: "#fff",
                  color: "#374151",
                  boxShadow: output ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none"
                }}>
                {output || (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    Summary will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "translation" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <button
              disabled={!canUseSelection || loading}
              onClick={async () => {
                if (!hasKey) {
                  setOutput(
                    "⚠️ API Key Not Configured\n\nPlease configure your OpenAI API Key first:\n1. Right-click extension icon\n2. Select 'Options'\n3. Enter your API Key"
                  )
                  return
                }
                setLoading(true)
                setOutput("🌐 Translating to Chinese...")
                try {
                  const result = await translate(selectedText)
                  setOutput(result)
                } catch (e: any) {
                  setOutput(`❌ Translation failed:\n\n${e?.message ?? String(e)}`)
                } finally {
                  setLoading(false)
                }
              }}
              className="btn-hover"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background:
                  canUseSelection && !loading
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "#cbd5e1",
                color: "#fff",
                border: "none",
                cursor: canUseSelection && !loading ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: canUseSelection && !loading ? "0 4px 12px rgba(16, 185, 129, 0.4)" : "none"
              }}>
              {loading ? (
                <>
                  <Spinner /> Translating...
                </>
              ) : (
                <>🌐 Translate to Chinese</>
              )}
            </button>
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 8,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                💡 Output
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 120,
                  background: "#fff",
                  color: "#374151",
                  boxShadow: output ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none"
                }}>
                {output || (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    Translation will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "highlight" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div
              style={{
                padding: 12,
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                color: "#92400e",
                display: "flex",
                alignItems: "start",
                gap: 8
              }}>
              <div style={{ fontSize: 16 }}>🚧</div>
              <div>
                <strong>Coming Soon!</strong>
                <br />
                This feature will generate smart highlight suggestions based on your selected text.
              </div>
            </div>
            <button
              disabled={!canUseSelection}
              className="btn-hover"
              onClick={() => {
                setOutput(
                  canUseSelection
                    ? "🚧 Feature in development\n\nThis will generate intelligent highlight suggestions and map them back to the PDF page."
                    : "⚠️ Please select text first."
                )
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background: canUseSelection
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "#cbd5e1",
                color: canUseSelection ? "#fff" : "#64748b",
                border: "none",
                cursor: canUseSelection ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: canUseSelection ? "0 4px 12px rgba(245, 158, 11, 0.4)" : "none"
              }}>
              ✨ Generate Highlights
            </button>
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 8,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                💡 Output
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 120,
                  background: "#fff",
                  color: "#374151"
                }}>
                {output || (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    Highlight suggestions will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "comment" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div
              style={{
                padding: 12,
                background: "#dbeafe",
                border: "1px solid #93c5fd",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                color: "#1e40af",
                display: "flex",
                alignItems: "start",
                gap: 8
              }}>
              <div style={{ fontSize: 16 }}>🚧</div>
              <div>
                <strong>Coming Soon!</strong>
                <br />
                Save notes linked to specific text selections. Notes will be persisted locally.
              </div>
            </div>
            <div
              style={{
                color: "#6b7280",
                fontSize: 11,
                marginBottom: 8,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              ✏️ Your Note
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write your thoughts, questions, or key points here..."
              style={{
                width: "100%",
                minHeight: 120,
                fontSize: 13,
                lineHeight: "20px",
                resize: "vertical",
                boxSizing: "border-box",
                padding: 12,
                border: "2px solid #e5e7eb",
                borderRadius: 10,
                background: "#fff",
                color: "#374151",
                fontFamily: "inherit",
                transition: "border-color 0.2s ease",
                outline: "none"
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                disabled={!canUseSelection || !commentDraft.trim()}
                className="btn-hover"
                onClick={() => {
                  setOutput(
                    canUseSelection && commentDraft.trim()
                      ? `🚧 Feature in development\n\nYour note will be saved and linked to:\n"${selectedText.slice(0, 100)}${selectedText.length > 100 ? "..." : ""}"\n\nNote content:\n${commentDraft}`
                      : "⚠️ Please select text and write a note first."
                  )
                }}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background:
                    canUseSelection && commentDraft.trim()
                      ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                      : "#cbd5e1",
                  color: "#fff",
                  border: "none",
                  cursor: canUseSelection && commentDraft.trim() ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow:
                    canUseSelection && commentDraft.trim()
                      ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                      : "none"
                }}>
                💾 Save Note
              </button>
              <button
                disabled={!commentDraft.trim()}
                onClick={() => setCommentDraft("")}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#fff",
                  color: "#6b7280",
                  border: "2px solid #e5e7eb",
                  cursor: commentDraft.trim() ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: 13,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (commentDraft.trim()) {
                    e.currentTarget.style.borderColor = "#f87171"
                    e.currentTarget.style.color = "#ef4444"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb"
                  e.currentTarget.style.color = "#6b7280"
                }}>
                🗑️
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 8,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                💡 Output
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  minHeight: 120,
                  background: "#fff",
                  color: "#374151"
                }}>
                {output || (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    Saved notes will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

