import React, { useState, useRef, useEffect } from "react"
import { borderRadius } from "~utils/design-tokens"
import { Target, ChevronDown } from "lucide-react"

import type { ReadingGoal } from "~types"
import { READING_GOAL_CONFIG } from "~types"
import { t } from "~utils/i18n"

interface ReadingGoalSelectorProps {
  value: ReadingGoal
  onChange: (goal: ReadingGoal) => void
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
  }
}

const ReadingGoalSelector: React.FC<ReadingGoalSelectorProps> = ({
  value,
  onChange,
  colors
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (goal: ReadingGoal) => {
    onChange(goal)
    setIsOpen(false)
  }

  return (
    <div style={{ marginBottom: 12 }} ref={containerRef}>
      <div
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          marginBottom: 6,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}
      >
        <Target size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {t("readingGoal.title")}
      </div>
      
      {/* 自定义选择框 */}
      <div style={{ position: "relative" }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            borderRadius: borderRadius.sm,
            border: `2px solid ${isOpen ? "#0d9488" : colors.border}`,
            background: colors.cardBg,
            color: colors.text,
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "border-color 0.2s ease",
            userSelect: "none"
          }}
        >
          <span>{t(READING_GOAL_CONFIG[value].labelKey)}</span>
          <ChevronDown
            size={14}
            style={{
              color: colors.textSecondary,
              transition: "transform 0.2s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
            }}
          />
        </div>

        {/* 下拉选项 */}
        {isOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 4,
              borderRadius: borderRadius.sm,
              background: colors.cardBg,
              border: `2px solid ${colors.border}`,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              zIndex: 50,
              overflow: "hidden",
              animation: "fadeIn 0.15s ease"
            }}
          >
            {(Object.keys(READING_GOAL_CONFIG) as ReadingGoal[]).map((goal) => (
              <div
                key={goal}
                onClick={() => handleSelect(goal)}
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  color: colors.text,
                  cursor: "pointer",
                  background: goal === value ? "rgba(13, 148, 136, 0.1)" : "transparent",
                  transition: "background-color 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  if (goal !== value) {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.05)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (goal !== value) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                {goal === value && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#0d9488"
                    }}
                  />
                )}
                {goal !== value && <div style={{ width: 8 }} />}
                <span>{t(READING_GOAL_CONFIG[goal].labelKey)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>
        {t(READING_GOAL_CONFIG[value].descriptionKey)}
      </div>
    </div>
  )
}

export default ReadingGoalSelector
