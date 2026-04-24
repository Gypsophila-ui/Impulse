import React, { useState } from "react"
import { borderRadius } from "~utils/design-tokens"
import { MessageSquare, X } from "lucide-react"

import type { AskUserQuestionParams, AskUserQuestionResult } from "~types"

interface AskUserQuestionModalProps {
  params: AskUserQuestionParams
  onSubmit: (result: AskUserQuestionResult) => void
  onCancel: () => void
  isDark: boolean
}

const AskUserQuestionModal: React.FC<AskUserQuestionModalProps> = ({
  params,
  onSubmit,
  onCancel,
  isDark
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState("")
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)

  const colors = {
    bg: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f3f4f6" : "#1f2937",
    textSecondary: isDark ? "#9ca3af" : "#6b7280",
    border: isDark ? "#374151" : "#e5e7eb",
    accent: "#0d9488",
    accentHover: "#0f766e",
    cardBg: isDark ? "#374151" : "#f9fafb"
  }

  const handleSubmit = () => {
    if (showCustomInput && customInput.trim()) {
      onSubmit({ selected: customInput.trim(), isCustomInput: true })
    } else if (selectedOption) {
      onSubmit({ selected: selectedOption, isCustomInput: false })
    }
  }

  const canSubmit = selectedOption || (showCustomInput && customInput.trim())

  const handleCustomOptionClick = () => {
    setShowCustomInput(true)
    setSelectedOption(null)
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
        animation: "fadeIn 0.2s ease"
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: colors.bg,
          borderRadius: borderRadius.lg,
          padding: 24,
          maxWidth: 400,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
          animation: "slideUp 0.3s ease"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: colors.text
            }}
          >
            {params.question}
          </h3>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: colors.textSecondary
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {params.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedOption(option.label)
                setShowCustomInput(false)
              }}
              onMouseEnter={() => setHoveredOption(option.label)}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                padding: "12px 16px",
                borderRadius: borderRadius.md,
                border: `2px solid ${
                  selectedOption === option.label
                    ? colors.accent
                    : hoveredOption === option.label
                      ? colors.accent
                      : colors.border
                }`,
                background: selectedOption === option.label
                  ? `${colors.accent}15`
                  : hoveredOption === option.label
                    ? `${colors.accent}10`
                    : colors.cardBg,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease"
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: selectedOption === option.label ? colors.accent : colors.text,
                  marginBottom: option.description ? 4 : 0
                }}
              >
                {option.label}
              </div>
              {option.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary
                  }}
                >
                  {option.description}
                </div>
              )}
            </button>
          ))}

          <button
            onClick={handleCustomOptionClick}
            onMouseEnter={() => setHoveredOption("__custom__")}
            onMouseLeave={() => setHoveredOption(null)}
            style={{
              padding: "12px 16px",
              borderRadius: borderRadius.md,
              border: `2px solid ${
                showCustomInput
                  ? "#0891b2"
                  : hoveredOption === "__custom__"
                    ? "#0891b2"
                    : colors.border
              }`,
              background: showCustomInput
                ? "rgba(8, 145, 178, 0.1)"
                : hoveredOption === "__custom__"
                  ? "rgba(8, 145, 178, 0.05)"
                  : colors.cardBg,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={16} color={showCustomInput ? "#0891b2" : colors.textSecondary} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: showCustomInput ? "#0891b2" : colors.text
                }}
              >
                Chat with Agent
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 4
              }}
            >
              输入自定义问题或指令
            </div>
          </button>
        </div>

        {showCustomInput && (
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={params.placeholder || "输入你想问的问题或指令..."}
              rows={3}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: borderRadius.md,
                border: `2px solid ${customInput ? "#0891b2" : colors.border}`,
                background: colors.cardBg,
                color: colors.text,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                resize: "vertical",
                minHeight: 80
              }}
              autoFocus
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: borderRadius.sm,
              border: "none",
              background: canSubmit
                ? showCustomInput
                  ? "linear-gradient(135deg, #0891b2 0%, #0d9488 100%)"
                  : `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`
                : colors.border,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.6
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

export default AskUserQuestionModal
