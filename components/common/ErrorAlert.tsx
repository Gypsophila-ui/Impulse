import React from "react"
import { AlertTriangle } from "lucide-react"

interface ErrorAlertProps {
  error: string | null
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error }) => {
  if (!error) return null

  return (
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
      <AlertTriangle size={16} color="#991b1b" />
      <div style={{ flex: 1 }}>{error}</div>
    </div>
  )
}

export default ErrorAlert
