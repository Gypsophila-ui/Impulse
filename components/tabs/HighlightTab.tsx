import React from "react"
import { borderRadius } from "~utils/design-tokens"
import { AlertTriangle, Sparkles, Trash2, X } from "lucide-react"

import type { Highlight } from "~utils/storage"
import { deleteHighlight, deleteHighlightsByUrl, saveHighlights } from "~utils/storage"

import Spinner from "../common/Spinner"

interface HighlightTabProps {
  selectedText: string
  output: React.ReactNode
  outputType: string
  generatingHighlights: boolean
  applyingHighlights: boolean
  highlights: Highlight[]
  currentUrl: string
  currentTitle: string
  currentTabId: number | null
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
  }
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onClearMessage: () => void
  onSetGeneratingHighlights: (loading: boolean) => void
  onSetApplyingHighlights: (loading: boolean) => void
  onLoadHighlights: () => Promise<void>
}

const HighlightTab: React.FC<HighlightTabProps> = ({
  selectedText,
  output,
  outputType,
  generatingHighlights,
  applyingHighlights,
  highlights,
  currentUrl,
  currentTitle,
  currentTabId,
  colors,
  onShowMessage,
  onClearMessage,
  onSetGeneratingHighlights,
  onSetApplyingHighlights,
  onLoadHighlights
}) => {
  const canUseSelection = selectedText.trim().length > 0

  const applyHighlightsToPage = async (phrases: string[]) => {
    if (!currentTabId) return

    try {
      onSetApplyingHighlights(true)

      const response = await chrome.tabs.sendMessage(currentTabId, {
        type: "APPLY_HIGHLIGHTS",
        phrases,
        color: "#fef08a"
      })

      if (response?.success) {
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Applied {response.count} highlights on the page!</>, "success")
        setTimeout(() => onClearMessage(), 3000)
      } else {
        onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> {response?.error || "Failed to apply highlights"}</>, "warning")
      }
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to apply highlights: {e?.message ?? String(e)}</>, "error")
    } finally {
      onSetApplyingHighlights(false)
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleHighlight = async () => {
    if (!canUseSelection) {
      onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please select text first</>, "warning")
      return
    }

    onSetGeneratingHighlights(true)

    try {
      await saveHighlights(
        [selectedText],
        selectedText,
        currentUrl,
        currentTitle
      )

      await applyHighlightsToPage([selectedText])

      await onLoadHighlights()

      onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Highlighted successfully!</>, "success")
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to highlight:{"\n\n"}{e?.message ?? String(e)}</>, "error")
    } finally {
      onSetGeneratingHighlights(false)
    }
  }

  const handleDeleteHighlight = async (highlight: Highlight) => {
    if (confirm("Delete this highlight?")) {
      try {
        await deleteHighlight(highlight.id)
        await onLoadHighlights()
        const remaining = highlights.filter((h) => h.id !== highlight.id)
        if (remaining.length > 0) {
          await applyHighlightsToPage(remaining.map((h) => h.phrase))
        } else {
          await clearHighlightsFromPage()
        }
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Highlight deleted</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
      }
    }
  }

  const handleClearAll = async () => {
    if (confirm(`Delete all ${highlights.length} highlights for this page?`)) {
      try {
        await deleteHighlightsByUrl(currentUrl)
        await clearHighlightsFromPage()
        await onLoadHighlights()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> All highlights deleted</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
      }
    }
  }

  const handleReapply = async () => {
    await clearHighlightsFromPage()
    if (highlights.length > 0) {
      await applyHighlightsToPage(highlights.map((h) => h.phrase))
    }
    onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Cleared highlights from page</>, "success")
    setTimeout(() => onClearMessage(), 2000)
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <button
        disabled={!canUseSelection || generatingHighlights}
        className="btn-hover"
        onClick={handleHighlight}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: borderRadius.md,
          background:
            canUseSelection && !generatingHighlights
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : "#cbd5e1",
          color: "#fff",
          border: "none",
          cursor:
            canUseSelection && !generatingHighlights ? "pointer" : "not-allowed",
          fontWeight: 600,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow:
            canUseSelection && !generatingHighlights
              ? "0 4px 12px rgba(245, 158, 11, 0.4)"
              : "none"
        }}
      >
        {generatingHighlights ? (
          <>
            <Spinner /> Highlighting...
          </>
        ) : (
          <><Sparkles size={14} /> Highlight Selected Text</>
        )}
      </button>

      {output && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: borderRadius.sm,
            background: outputType === "success"
              ? "#d1fae5"
              : outputType === "warning"
                ? "#fef3c7"
                : "#fee2e2",
            color: outputType === "success"
              ? "#065f46"
              : outputType === "warning"
                ? "#92400e"
                : "#991b1b",
            fontSize: 12,
            lineHeight: "18px",
            whiteSpace: "pre-wrap",
            animation: "fadeIn 0.3s ease"
          }}
        >
          {output}
        </div>
      )}

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
          }}
        >
          <span><Sparkles size={12} style={{ marginRight: 4, color: "#f59e0b" }} /> Active Highlights ({highlights.length})</span>
          {highlights.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleReapply}
                disabled={applyingHighlights}
                style={{
                  background: "none",
                  border: "none",
                  color: "#3b82f6",
                  cursor: applyingHighlights ? "not-allowed" : "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: 4
                }}
              >
                {applyingHighlights ? "Applying..." : "Reapply"}
              </button>
              <button
                onClick={handleClearAll}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: 4
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {highlights.length === 0 ? (
          <div
            style={{
              padding: 20,
              border: `2px dashed ${colors.border}`,
              borderRadius: borderRadius.md,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}><Sparkles size={32} color="#f59e0b" /></div>
            <div>No highlights yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Select text and click to highlight!
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
                  borderRadius: borderRadius.sm,
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
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 8
                  }}
                >
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
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: borderRadius.full,
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
                    onClick={() => handleDeleteHighlight(highlight)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      fontSize: 14,
                      color: "#ef4444"
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HighlightTab
