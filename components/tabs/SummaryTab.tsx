import React from "react"
import { borderRadius } from "~utils/ui/design-tokens"
import { AlertTriangle, Pencil, Sparkles, X } from "lucide-react"

import type { ReadingGoal } from "~types"
import { summarize } from "~utils/agent/llm-client"
import { recordComponentEvent } from "~utils/bug-report"
import { trackEvent } from "~utils/reading/reading-tracker"

import Spinner from "../common/Spinner"
import ReadingGoalSelector from "../common/ReadingGoalSelector"

interface SummaryTabProps {
  selectedText: string
  output: React.ReactNode
  loading: boolean
  hasKey: boolean
  readingGoal: ReadingGoal
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
  }
  onReadingGoalChange: (goal: ReadingGoal) => void
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onSetLoading: (loading: boolean) => void
}

const SummaryTab: React.FC<SummaryTabProps> = ({
  selectedText,
  output,
  loading,
  hasKey,
  readingGoal,
  colors,
  onReadingGoalChange,
  onShowMessage,
  onSetLoading
}) => {
  const canUseSelection = selectedText.trim().length > 0

  const handleSummarize = async () => {
    if (!hasKey) {
      onShowMessage(
        <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured{"\n\n"}Please configure your OpenAI API Key first:{"\n"}1. Right-click extension icon{"\n"}2. Select 'Options'{"\n"}3. Enter your API Key</>, "warning"
      )
      return
    }
    onSetLoading(true)
    onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Generating summary...</>, "success")
    recordComponentEvent("SummaryTab", "summarize_start", `chars=${selectedText.length}`)
    try {
      const result = await summarize(selectedText, readingGoal)
      onShowMessage(result, "success")
      recordComponentEvent("SummaryTab", "summarize_success")
      trackEvent("summary", { goal: readingGoal, text_length: selectedText.length })
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to generate summary:{"\n\n"}{e?.message ?? String(e)}</>, "error")
      recordComponentEvent("SummaryTab", "summarize_error", e?.message || String(e))
    } finally {
      onSetLoading(false)
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <ReadingGoalSelector
        value={readingGoal}
        onChange={onReadingGoalChange}
        colors={colors}
      />

      <button
        disabled={!canUseSelection || loading}
        onClick={handleSummarize}
        className="btn-hover"
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: borderRadius.md,
          background:
            canUseSelection && !loading
              ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
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
            canUseSelection && !loading ? "0 4px 12px rgba(13, 148, 136, 0.4)" : "none"
        }}
      >
        {loading ? (
          <>
            <Spinner /> Generating...
          </>
        ) : (
          <><Pencil size={14} /> Generate Summary</>
        )}
      </button>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            marginBottom: 8,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}
        >
          Output
        </div>
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: "22px",
            padding: 16,
            border: `2px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            minHeight: 120,
            background: colors.cardBg,
            color: colors.text,
            boxShadow: output ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none"
          }}
        >
          {output || (
            <span style={{ color: colors.textSecondary, fontStyle: "italic" }}>
              Select text from PDF and click Generate Summary
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default SummaryTab
