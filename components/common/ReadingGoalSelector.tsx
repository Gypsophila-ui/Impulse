import React from "react"
import { Target } from "lucide-react"

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
  return (
    <div style={{ marginBottom: 12 }}>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ReadingGoal)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: `2px solid ${colors.border}`,
          background: colors.cardBg,
          color: colors.text,
          fontSize: 13,
          cursor: "pointer",
          outline: "none",
          fontFamily: "inherit"
        }}
      >
        {(Object.keys(READING_GOAL_CONFIG) as ReadingGoal[]).map((goal) => (
          <option key={goal} value={goal}>
            {t(READING_GOAL_CONFIG[goal].labelKey)}
          </option>
        ))}
      </select>
      <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>
        {t(READING_GOAL_CONFIG[value].descriptionKey)}
      </div>
    </div>
  )
}

export default ReadingGoalSelector
