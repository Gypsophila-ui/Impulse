import React, { useEffect, useMemo, useState } from "react"

import { getSelectionInTab } from "~utils/get-selection"
import { generateHighlights, summarize, translate } from "~utils/llm-client"
import {
  deleteHighlight,
  deleteHighlightsByUrl,
  deleteNote,
  getHighlightsByUrl,
  getNotesByUrl,
  hasApiKey,
  saveHighlights,
  saveNote,
  updateNote,
  type Highlight,
  type Note
} from "~utils/storage"

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

// Format timestamp to readable date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

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

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [currentUrl, setCurrentUrl] = useState("")
  const [currentTitle, setCurrentTitle] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  // Highlights state
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [generatingHighlights, setGeneratingHighlights] = useState(false)
  const [applyingHighlights, setApplyingHighlights] = useState(false)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

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

  const loadNotes = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        setCurrentUrl(tab.url)
        setCurrentTitle(tab.title || "Untitled")
        setCurrentTabId(tab.id || null)
        const pageNotes = await getNotesByUrl(tab.url)
        setNotes(pageNotes)
      }
    } catch (e) {
      console.error("Failed to load notes:", e)
    }
  }

  const loadHighlights = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const pageHighlights = await getHighlightsByUrl(tab.url)
        setHighlights(pageHighlights)
      }
    } catch (e) {
      console.error("Failed to load highlights:", e)
    }
  }

  const applyHighlightsToPage = async (phrases: string[]) => {
    if (!currentTabId) return

    try {
      setApplyingHighlights(true)

      // Send message to all frames in the tab
      const response = await chrome.tabs.sendMessage(currentTabId, {
        type: "APPLY_HIGHLIGHTS",
        phrases,
        color: "#fef08a"
      })

      if (response?.success) {
        setOutput(`✅ Applied ${response.count} highlights on the page!`)
        setTimeout(() => setOutput(""), 3000)
      } else {
        setOutput(`⚠️ ${response?.error || "Failed to apply highlights"}`)
      }
    } catch (e: any) {
      setOutput(`❌ Failed to apply highlights: ${e?.message ?? String(e)}`)
    } finally {
      setApplyingHighlights(false)
    }
  }

  const clearHighlightsFromPage = async () => {
    if (!currentTabId) return

    try {
      await chrome.tabs.sendMessage(currentTabId, {
        type: "CLEAR_HIGHLIGHTS"
      })
    } catch (e) {
      console.error("Failed to clear highlights:", e)
    }
  }

  useEffect(() => {
    void fetchSelection()
    void loadNotes()
    void loadHighlights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    hasApiKey().then(setHasKey)
  }, [])

  // Reload notes when switching to comment tab
  useEffect(() => {
    if (activeTab === "comment") {
      void loadNotes()
    } else if (activeTab === "highlight") {
      void loadHighlights()
    }
  }, [activeTab])

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
            {/* Generate highlights button */}
            <button
              disabled={!canUseSelection || !hasKey || generatingHighlights}
              className="btn-hover"
              onClick={async () => {
                if (!hasKey) {
                  setOutput(
                    "⚠️ API Key Not Configured\n\nPlease configure your OpenAI API Key first:\n1. Right-click extension icon\n2. Select 'Options'\n3. Enter your API Key"
                  )
                  return
                }

                if (!canUseSelection) {
                  setOutput("⚠️ Please select text first")
                  return
                }

                setGeneratingHighlights(true)
                setOutput("✨ Analyzing text and generating highlights...")

                try {
                  // Generate highlights using LLM
                  const phrases = await generateHighlights(selectedText)

                  if (phrases.length === 0) {
                    setOutput("⚠️ No key phrases found in the selected text")
                    return
                  }

                  // Save highlights to storage
                  const saved = await saveHighlights(
                    phrases,
                    selectedText,
                    currentUrl,
                    currentTitle
                  )

                  // Apply highlights to the page
                  await applyHighlightsToPage(phrases)

                  // Reload highlights list
                  await loadHighlights()

                  setOutput(
                    `✅ Generated ${phrases.length} highlights!\n\nKey phrases:\n${phrases.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
                  )
                } catch (e: any) {
                  setOutput(`❌ Failed to generate highlights:\n\n${e?.message ?? String(e)}`)
                } finally {
                  setGeneratingHighlights(false)
                }
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background:
                  canUseSelection && hasKey && !generatingHighlights
                    ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                    : "#cbd5e1",
                color: "#fff",
                border: "none",
                cursor:
                  canUseSelection && hasKey && !generatingHighlights ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow:
                  canUseSelection && hasKey && !generatingHighlights
                    ? "0 4px 12px rgba(245, 158, 11, 0.4)"
                    : "none"
              }}>
              {generatingHighlights ? (
                <>
                  <Spinner /> Generating...
                </>
              ) : (
                <>✨ Generate Highlights</>
              )}
            </button>

            {/* Status message */}
            {output && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: output.startsWith("✅")
                    ? "#d1fae5"
                    : output.startsWith("⚠️")
                      ? "#fef3c7"
                      : "#fee2e2",
                  color: output.startsWith("✅")
                    ? "#065f46"
                    : output.startsWith("⚠️")
                      ? "#92400e"
                      : "#991b1b",
                  fontSize: 12,
                  lineHeight: "18px",
                  whiteSpace: "pre-wrap",
                  animation: "fadeIn 0.3s ease"
                }}>
                {output}
              </div>
            )}

            {/* Highlights list */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <span>✨ Active Highlights ({highlights.length})</span>
                {highlights.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        await clearHighlightsFromPage()
                        setOutput("✅ Cleared highlights from page")
                        setTimeout(() => setOutput(""), 2000)
                      }}
                      disabled={applyingHighlights}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#3b82f6",
                        cursor: applyingHighlights ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 4
                      }}>
                      {applyingHighlights ? "Applying..." : "Reapply"}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete all ${highlights.length} highlights for this page?`)) {
                          try {
                            await deleteHighlightsByUrl(currentUrl)
                            await clearHighlightsFromPage()
                            await loadHighlights()
                            setOutput("✅ All highlights deleted")
                            setTimeout(() => setOutput(""), 2000)
                          } catch (e: any) {
                            setOutput(`❌ Failed to delete: ${e?.message ?? String(e)}`)
                          }
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 4
                      }}>
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {highlights.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    border: "2px dashed #e5e7eb",
                    borderRadius: 10,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                  <div>No highlights yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Select text and generate smart highlights!
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {highlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      style={{
                        padding: 10,
                        border: "2px solid #fcd34d",
                        borderRadius: 8,
                        background: "#fefce8",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#f59e0b"
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(245, 158, 11, 0.15)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#fcd34d"
                        e.currentTarget.style.boxShadow = "none"
                      }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "start",
                          justifyContent: "space-between",
                          gap: 8
                        }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#92400e",
                              fontWeight: 600,
                              marginBottom: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#f59e0b"
                              }}
                            />
                            {highlight.phrase}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {formatDate(highlight.timestamp)}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this highlight?")) {
                              try {
                                await deleteHighlight(highlight.id)
                                await loadHighlights()
                                // Reapply remaining highlights
                                const remaining = highlights.filter((h) => h.id !== highlight.id)
                                if (remaining.length > 0) {
                                  await applyHighlightsToPage(remaining.map((h) => h.phrase))
                                } else {
                                  await clearHighlightsFromPage()
                                }
                                setOutput("✅ Highlight deleted")
                                setTimeout(() => setOutput(""), 2000)
                              } catch (e: any) {
                                setOutput(`❌ Failed to delete: ${e?.message ?? String(e)}`)
                              }
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            fontSize: 14,
                            color: "#ef4444"
                          }}
                          title="Delete">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "comment" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Add new note form */}
            <div
              style={{
                color: "#6b7280",
                fontSize: 11,
                marginBottom: 8,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              ✏️ {editingNoteId ? "Edit Note" : "New Note"}
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write your thoughts, questions, or key points here..."
              style={{
                width: "100%",
                minHeight: 100,
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
                disabled={
                  (editingNoteId ? false : !canUseSelection) ||
                  !commentDraft.trim() ||
                  savingNote
                }
                className="btn-hover"
                onClick={async () => {
                  if (editingNoteId) {
                    // Update existing note
                    try {
                      setSavingNote(true)
                      await updateNote(editingNoteId, commentDraft.trim())
                      setCommentDraft("")
                      setEditingNoteId(null)
                      await loadNotes()
                      setOutput("✅ Note updated successfully!")
                      setTimeout(() => setOutput(""), 2000)
                    } catch (e: any) {
                      setOutput(`❌ Failed to update note: ${e?.message ?? String(e)}`)
                    } finally {
                      setSavingNote(false)
                    }
                  } else {
                    // Save new note
                    if (!canUseSelection) {
                      setOutput("⚠️ Please select text first")
                      return
                    }
                    if (!commentDraft.trim()) {
                      setOutput("⚠️ Please write a note")
                      return
                    }
                    try {
                      setSavingNote(true)
                      await saveNote(
                        selectedText.trim(),
                        commentDraft.trim(),
                        currentUrl,
                        currentTitle
                      )
                      setCommentDraft("")
                      await loadNotes()
                      setOutput("✅ Note saved successfully!")
                      setTimeout(() => setOutput(""), 2000)
                    } catch (e: any) {
                      setOutput(`❌ Failed to save note: ${e?.message ?? String(e)}`)
                    } finally {
                      setSavingNote(false)
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                      : "#cbd5e1",
                  color: "#fff",
                  border: "none",
                  cursor:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                      : "none"
                }}>
                {savingNote ? (
                  <>
                    <Spinner /> Saving...
                  </>
                ) : editingNoteId ? (
                  <>💾 Update Note</>
                ) : (
                  <>💾 Save Note</>
                )}
              </button>
              {editingNoteId && (
                <button
                  disabled={savingNote}
                  onClick={() => {
                    setEditingNoteId(null)
                    setCommentDraft("")
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "#fff",
                    color: "#6b7280",
                    border: "2px solid #e5e7eb",
                    cursor: savingNote ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.2s ease"
                  }}>
                  ✖️ Cancel
                </button>
              )}
              {!editingNoteId && (
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
              )}
            </div>

            {/* Status message */}
            {output && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: output.startsWith("✅") ? "#d1fae5" : "#fee2e2",
                  color: output.startsWith("✅") ? "#065f46" : "#991b1b",
                  fontSize: 12,
                  animation: "fadeIn 0.3s ease"
                }}>
                {output}
              </div>
            )}

            {/* Notes list */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <span>📚 Saved Notes ({notes.length})</span>
                {notes.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete all ${notes.length} notes for this page?`)) {
                        Promise.all(notes.map((note) => deleteNote(note.id)))
                          .then(() => loadNotes())
                          .then(() => {
                            setOutput("✅ All notes deleted")
                            setTimeout(() => setOutput(""), 2000)
                          })
                          .catch((e: any) => {
                            setOutput(`❌ Failed to delete notes: ${e?.message ?? String(e)}`)
                          })
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: 4
                    }}>
                    Clear All
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    border: "2px dashed #e5e7eb",
                    borderRadius: 10,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  <div>No notes yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Select text and create your first note!
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: 12,
                        border: "2px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6"
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb"
                        e.currentTarget.style.boxShadow = "none"
                      }}>
                      {/* Note header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8
                        }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {formatDate(note.timestamp)}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id)
                              setCommentDraft(note.comment)
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 4,
                              fontSize: 14,
                              color: "#3b82f6"
                            }}
                            title="Edit">
                            ✏️
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Delete this note?")) {
                                try {
                                  await deleteNote(note.id)
                                  await loadNotes()
                                  setOutput("✅ Note deleted")
                                  setTimeout(() => setOutput(""), 2000)
                                } catch (e: any) {
                                  setOutput(`❌ Failed to delete: ${e?.message ?? String(e)}`)
                                }
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 4,
                              fontSize: 14,
                              color: "#ef4444"
                            }}
                            title="Delete">
                            🗑️
                          </button>
                        </div>
                      </div>
                      {/* Selected text (quote) */}
                      <div
                        style={{
                          padding: 8,
                          background: "#f9fafb",
                          borderLeft: "3px solid #3b82f6",
                          borderRadius: 4,
                          marginBottom: 8,
                          fontSize: 12,
                          color: "#6b7280",
                          fontStyle: "italic",
                          lineHeight: "18px"
                        }}>
                        "{note.selectedText.slice(0, 150)}
                        {note.selectedText.length > 150 ? "..." : ""}"
                      </div>
                      {/* User comment */}
                      <div
                        style={{
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: "20px",
                          whiteSpace: "pre-wrap"
                        }}>
                        {note.comment}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

