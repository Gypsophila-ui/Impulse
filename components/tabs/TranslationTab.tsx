import React from "react"
import { borderRadius } from "~utils/ui/design-tokens"
import { AlertTriangle, Globe, X } from "lucide-react"

import { translate } from "~utils/agent/llm-client"
import { recordComponentEvent } from "~utils/bug-report"
import { trackEvent } from "~utils/reading/reading-tracker"

import Spinner from "../common/Spinner"

interface TranslationTabProps {
  selectedText: string
  output: React.ReactNode
  loading: boolean
  hasKey: boolean
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
  }
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onSetLoading: (loading: boolean) => void
}

const TranslationTab: React.FC<TranslationTabProps> = ({
  selectedText,
  output,
  loading,
  hasKey,
  colors,
  onShowMessage,
  onSetLoading
}) => {
  const canUseSelection = selectedText.trim().length > 0

  const handleTranslate = async () => {
    if (!hasKey) {
      onShowMessage(
        <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured{"\n\n"}Please configure your OpenAI API Key first:{"\n"}1. Right-click extension icon{"\n"}2. Select 'Options'{"\n"}3. Enter your API Key</>, "warning"
      )
      return
    }
    onSetLoading(true)
    onShowMessage(<><Globe size={14} style={{ marginRight: 4, color: "#10b981" }} /> Translating to Chinese...</>, "success")
    recordComponentEvent("TranslationTab", "translate_start", `chars=${selectedText.length}`)
    try {
      const result = await translate(selectedText)
      onShowMessage(result, "success")
      recordComponentEvent("TranslationTab", "translate_success")
      trackEvent("translation", { text_length: selectedText.length })
    } catch (e: any) {
      onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Translation failed:{"\n\n"}{e?.message ?? String(e)}</>, "error")
      recordComponentEvent("TranslationTab", "translate_error", e?.message || String(e))
    } finally {
      onSetLoading(false)
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <button
        disabled={!canUseSelection || loading}
        onClick={handleTranslate}
        className="btn-hover"
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: borderRadius.md,
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
        }}
      >
        {loading ? (
          <>
            <Spinner /> Translating...
          </>
        ) : (
          <><Globe size={14} /> Translate to Chinese</>
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
              Select text from PDF and click Translate
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TranslationTab
