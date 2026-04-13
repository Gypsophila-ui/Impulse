import React from "react"
import { AlertTriangle, Pencil, Sparkles, X } from "lucide-react"

import type { ReadingGoal } from "~types"
import { summarize } from "~utils/llm-client"

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
    try {
      const result = await summarize(selectedText, readingGoal)
      onShowMessage(result, "success")
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to generate summary:{"\n\n"}{e?.message ?? String(e)}</>, "error")
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
            borderRadius: 10,
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
