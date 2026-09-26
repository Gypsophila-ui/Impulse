import React from "react"
import { AlertTriangle, X } from "lucide-react"
import { borderRadius } from "~utils/ui/design-tokens"

interface PermissionNoticeModalProps {
  skillName: string
  message: string
  permissions: string[]
  origins: string[]
  onClose: () => void
  isDark: boolean
}

const PermissionNoticeModal: React.FC<PermissionNoticeModalProps> = ({
  skillName,
  message,
  permissions,
  origins,
  onClose,
  isDark
}) => {
  const colors = {
    bg: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f3f4f6" : "#1f2937",
    textSecondary: isDark ? "#9ca3af" : "#6b7280",
    border: isDark ? "#374151" : "#e5e7eb",
    accent: "#efd083",
    accentHover: "#d4b65a",
    cardBg: isDark ? "#374151" : "#f9fafb",
    warning: "#f59e0b"
  }

  const handleOpenSettings = () => {
    try {
      chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` })
    } catch {
      // Fallback if chrome.tabs is not available
      window.open(`chrome://extensions/?id=${chrome.runtime.id}`, "_blank")
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bg,
          color: colors.text,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          width: "100%",
          maxWidth: 420,
          maxHeight: "80vh",
          overflow: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.border}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} style={{ color: colors.warning }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>权限不足</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.textSecondary,
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 }}>
            使用技能 <strong>{skillName}</strong> 需要以下权限：
          </p>

          <div
            style={{
              background: colors.cardBg,
              borderRadius: borderRadius.md,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.6,
              color: colors.text
            }}
          >
            {message}
          </div>

          {permissions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary }}>所需 API 权限：</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {permissions.map((p) => (
                  <span
                    key={p}
                    style={{
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: borderRadius.sm,
                      padding: "2px 8px",
                      fontSize: 12,
                      color: colors.textSecondary
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {origins.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary }}>所需网站权限：</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {origins.map((o) => (
                  <span
                    key={o}
                    style={{
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: borderRadius.sm,
                      padding: "2px 8px",
                      fontSize: 12,
                      color: colors.textSecondary
                    }}
                  >
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "12px 20px 16px",
            borderTop: `1px solid ${colors.border}`
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.text,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500
            }}
          >
            知道了
          </button>
          <button
            onClick={handleOpenSettings}
            style={{
              padding: "8px 14px",
              borderRadius: borderRadius.md,
              border: "none",
              background: colors.accent,
              color: "#1f2937",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            去扩展设置开启
          </button>
        </div>
      </div>
    </div>
  )
}

export default PermissionNoticeModal
