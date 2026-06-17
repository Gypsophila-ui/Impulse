import React, { useMemo, useState } from "react"
import { borderRadius } from "~utils/ui/design-tokens"
import { AlertTriangle, Sparkles, Trash2, X, Crosshair, Filter } from "lucide-react"

import { applyHighlightsToPage, clearHighlightsOnPage, focusHighlightById } from "~utils/agent/agent-tools"
import type { HighlightInjection } from "~utils/agent/agent-tools"
import type { Highlight, HighlightCategory } from "~utils/storage/storage"
import {
  HIGHLIGHT_CATEGORIES,
  HIGHLIGHT_CATEGORY_ORDER,
  deleteHighlight,
  deleteHighlightsByUrl,
  saveHighlights
} from "~utils/storage/storage"
import { recordComponentEvent } from "~utils/bug-report"
import { trackEvent } from "~utils/reading/reading-tracker"

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
  const [selectedCategory, setSelectedCategory] = useState<HighlightCategory>("important")
  const [filterCategory, setFilterCategory] = useState<HighlightCategory | "all">("all")

  const canUseSelection = selectedText.trim().length > 0

  /** Build injection payloads from stored highlights (preserves IDs for click-to-focus). */
  const buildInjections = (items: Highlight[]): HighlightInjection[] =>
    items.map((h) => ({
      id: h.id,
      phrase: h.phrase,
      category: h.category,
      color: h.color || HIGHLIGHT_CATEGORIES[h.category ?? "default"].color
    }))

  const applyPageHighlights = async (items: Highlight[]) => {
    if (!currentTabId) return

    try {
      onSetApplyingHighlights(true)
      const injections = buildInjections(items)
      const result = await applyHighlightsToPage(currentTabId, injections)

      if (result.success) {
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Applied {result.count} sentence highlights on the page!</>, "success")
        setTimeout(() => onClearMessage(), 3000)
      } else {
        onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> {result.error || "Failed to apply highlights"}</>, "warning")
      }
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to apply highlights: {e?.message ?? String(e)}</>, "error")
    } finally {
      onSetApplyingHighlights(false)
    }
  }

  const clearPageHighlights = async () => {
    if (!currentTabId) return
    await clearHighlightsOnPage(currentTabId)
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
    recordComponentEvent("HighlightTab", "highlight_start", `chars=${selectedText.length}`)

    try {
      // Save first to get stable IDs, then inject with those IDs so click-to-focus works
      const saved = await saveHighlights(
        [selectedText],
        selectedText,
        currentUrl,
        currentTitle,
        selectedCategory
      )

      await applyPageHighlights(saved)

      await onLoadHighlights()

      onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Highlighted as "{HIGHLIGHT_CATEGORIES[selectedCategory].label}"!</>, "success")
      recordComponentEvent("HighlightTab", "highlight_success", `category=${selectedCategory}`)
      trackEvent("highlight", { text_length: selectedText.length, count: 1, category: selectedCategory })
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to highlight:{"\n\n"}{e?.message ?? String(e)}</>, "error")
      recordComponentEvent("HighlightTab", "highlight_error", e?.message || String(e))
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
          await applyPageHighlights(remaining)
        } else {
          await clearPageHighlights()
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
        await clearPageHighlights()
        await onLoadHighlights()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> All highlights deleted</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
      }
    }
  }

  const handleReapply = async () => {
    await clearPageHighlights()
    if (highlights.length > 0) {
      await applyPageHighlights(highlights)
    }
    onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Reapplied highlights to page</>, "success")
    setTimeout(() => onClearMessage(), 2000)
  }

  /** Click sidebar item → scroll to + flash the matching highlight on the page. */
  const handleFocusHighlight = async (highlight: Highlight) => {
    if (!currentTabId) return
    try {
      const result = await focusHighlightById(currentTabId, highlight.id)
      if (!result.success) {
        // Highlight may not be on the page yet — try reapplying all then focus again
        await applyPageHighlights(highlights)
        const retry = await focusHighlightById(currentTabId, highlight.id)
        if (!retry.success) {
          onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Could not locate this highlight on the page</>, "warning")
          setTimeout(() => onClearMessage(), 2500)
        }
      }
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to focus: {e?.message ?? String(e)}</>, "error")
    }
  }

  /** Filtered + grouped highlights for display. */
  const visibleHighlights = useMemo(() => {
    if (filterCategory === "all") return highlights
    return highlights.filter((h) => (h.category ?? "default") === filterCategory)
  }, [highlights, filterCategory])

  const groupedHighlights = useMemo(() => {
    const groups: Record<HighlightCategory, Highlight[]> = {
      important: [],
      question: [],
      definition: [],
      method: [],
      default: []
    }
    for (const h of visibleHighlights) {
      groups[h.category ?? "default"].push(h)
    }
    return groups
  }, [visibleHighlights])

  const categoryCounts = useMemo(() => {
    const counts: Record<HighlightCategory, number> = {
      important: 0,
      question: 0,
      definition: 0,
      method: 0,
      default: 0
    }
    for (const h of highlights) {
      counts[h.category ?? "default"]++
    }
    return counts
  }, [highlights])

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Category selector */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            marginBottom: 6,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}
        >
          Category
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {HIGHLIGHT_CATEGORY_ORDER.map((cat) => {
            const cfg = HIGHLIGHT_CATEGORIES[cat]
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                title={cfg.description}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: borderRadius.xs,
                  border: isSelected ? `1.5px solid ${cfg.color}` : `1px solid ${colors.border}`,
                  background: isSelected ? cfg.color : "transparent",
                  color: isSelected ? "#1f2937" : colors.text,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: cfg.color,
                    border: isSelected ? "1px solid #1f2937" : "1px solid rgba(0,0,0,0.15)"
                  }}
                />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Highlight button */}
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
              ? `linear-gradient(135deg, ${HIGHLIGHT_CATEGORIES[selectedCategory].color} 0%, ${HIGHLIGHT_CATEGORIES[selectedCategory].color}dd 100%)`
              : "#cbd5e1",
          color: "#1f2937",
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
              ? "0 4px 12px rgba(245, 158, 11, 0.3)"
              : "none"
        }}
      >
        {generatingHighlights ? (
          <>
            <Spinner /> Highlighting...
          </>
        ) : (
          <><Sparkles size={14} /> Highlight as "{HIGHLIGHT_CATEGORIES[selectedCategory].label}"</>
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
        {/* Header with actions */}
        <div
          style={{
            color: colors.textSecondary,
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
                  color: "#0d9488",
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

        {/* Category filter chips */}
        {highlights.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 12,
              alignItems: "center"
            }}
          >
            <Filter size={11} color={colors.textSecondary} style={{ marginRight: 2 }} />
            <button
              onClick={() => setFilterCategory("all")}
              style={{
                padding: "3px 8px",
                borderRadius: borderRadius.xs,
                border: filterCategory === "all" ? "1px solid #0d9488" : `1px solid ${colors.border}`,
                background: filterCategory === "all" ? "#ccfbf1" : "transparent",
                color: filterCategory === "all" ? "#0f766e" : colors.textSecondary,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              All ({highlights.length})
            </button>
            {HIGHLIGHT_CATEGORY_ORDER.map((cat) => {
              if (categoryCounts[cat] === 0) return null
              const cfg = HIGHLIGHT_CATEGORIES[cat]
              const isActive = filterCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(isActive ? "all" : cat)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: borderRadius.xs,
                    border: isActive ? `1px solid ${cfg.color}` : `1px solid ${colors.border}`,
                    background: isActive ? cfg.color : "transparent",
                    color: isActive ? "#1f2937" : colors.textSecondary,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: cfg.color,
                      border: "1px solid rgba(0,0,0,0.2)"
                    }}
                  />
                  {cfg.label} ({categoryCounts[cat]})
                </button>
              )
            })}
          </div>
        )}

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
              Select text, pick a category, and click to highlight!
            </div>
          </div>
        ) : visibleHighlights.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: `2px dashed ${colors.border}`,
              borderRadius: borderRadius.md,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 12
            }}
          >
            No highlights in this category
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {HIGHLIGHT_CATEGORY_ORDER.map((cat) => {
              const items = groupedHighlights[cat]
              if (items.length === 0) return null
              const cfg = HIGHLIGHT_CATEGORIES[cat]
              return (
                <div key={cat}>
                  {/* Category group header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: colors.textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cfg.color,
                        border: "1px solid rgba(0,0,0,0.15)"
                      }}
                    />
                    {cfg.label} · {items.length}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((highlight) => {
                      const catCfg = HIGHLIGHT_CATEGORIES[highlight.category ?? "default"]
                      return (
                        <div
                          key={highlight.id}
                          style={{
                            padding: 10,
                            borderLeft: `3px solid ${catCfg.color}`,
                            borderRadius: borderRadius.sm,
                            background: `${catCfg.color}33`,
                            transition: "all 0.2s ease",
                            cursor: "pointer"
                          }}
                          onClick={() => handleFocusHighlight(highlight)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = `${catCfg.color}66`
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = `${catCfg.color}33`
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#1f2937",
                                  fontWeight: 500,
                                  marginBottom: 4,
                                  lineHeight: "18px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6
                                }}
                              >
                                <Crosshair size={12} color={colors.textSecondary} style={{ flexShrink: 0 }} />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical"
                                  }}
                                >
                                  {highlight.phrase}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 8 }}>
                                <span>{catCfg.label}</span>
                                <span>·</span>
                                <span>{formatDate(highlight.timestamp)}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteHighlight(highlight)
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 4,
                                fontSize: 14,
                                color: "#ef4444",
                                flexShrink: 0
                              }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {highlights.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: colors.cardBg,
              borderRadius: borderRadius.sm,
              fontSize: 10,
              color: colors.textSecondary,
              textAlign: "center",
              border: `1px solid ${colors.border}`
            }}
          >
            Click any highlight above to jump to it on the page
          </div>
        )}
      </div>
    </div>
  )
}

export default HighlightTab
