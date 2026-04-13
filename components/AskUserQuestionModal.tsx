import React, { useState } from "react"
import { X } from "lucide-react"

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

  const colors = {
    bg: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#f3f4f6" : "#1f2937",
    textSecondary: isDark ? "#9ca3af" : "#6b7280",
    border: isDark ? "#374151" : "#e5e7eb",
    accent: "#3b82f6",
    accentHover: "#2563eb",
    cardBg: isDark ? "#374151" : "#f9fafb"
  }

  const handleSubmit = () => {
    if (selectedOption) {
      onSubmit({ selected: selectedOption, isCustomInput: false })
    } else if (params.allowCustomInput && customInput.trim()) {
      onSubmit({ selected: customInput.trim(), isCustomInput: true })
    }
  }

  const canSubmit = selectedOption || (params.allowCustomInput && customInput.trim())

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
          borderRadius: 16,
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
              onClick={() => setSelectedOption(option.label)}
              onMouseEnter={() => setHoveredOption(option.label)}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
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
        </div>

        {params.allowCustomInput && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value)
                setSelectedOption(null)
              }}
              placeholder={params.placeholder || "输入自定义回答..."}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: `2px solid ${customInput ? colors.accent : colors.border}`,
                background: colors.cardBg,
                color: colors.text,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
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
              borderRadius: 8,
              border: "none",
              background: canSubmit
                ? `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`
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
