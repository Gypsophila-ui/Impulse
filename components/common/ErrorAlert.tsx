import React from "react"
import { borderRadius } from "~utils/ui/design-tokens"
import { AlertTriangle, Sparkles } from "lucide-react"

interface ErrorAlertProps {
  error: string | null
  onDiagnose?: () => void
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onDiagnose }) => {
  if (!error) return null

  return (
    <div
      style={{
        margin: "12px 12px 0",
        padding: "12px",
        background: "#fee2e2",
        border: "1px solid #fca5a5",
        borderRadius: borderRadius.sm,
        color: "#991b1b",
        fontSize: 12,
        lineHeight: "18px",
        animation: "fadeIn 0.3s ease",
        display: "flex",
        alignItems: "start",
        gap: 8
      }}>
      <AlertTriangle size={16} color="#991b1b" />
      <div style={{ flex: 1 }}>{error}</div>
      {onDiagnose && (
        <button
          onClick={onDiagnose}
          title="AI Diagnose"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: borderRadius.xs,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "opacity 0.15s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
          <Sparkles size={11} /> Diagnose
        </button>
      )}
    </div>
  )
}

export default ErrorAlert
