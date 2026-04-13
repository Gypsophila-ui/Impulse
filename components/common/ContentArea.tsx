import React from "react"
import { FileText } from "lucide-react"

import type { TabKey } from "./Header"
import { t } from "~utils/i18n"

const tabKeys: Array<{ key: TabKey; labelKey: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = [
  { key: "summary", labelKey: "tab.summary", icon: FileText },
  { key: "translation", labelKey: "tab.translate", icon: FileText },
  { key: "highlight", labelKey: "tab.highlight", icon: FileText },
  { key: "comment", labelKey: "tab.comment", icon: FileText },
  { key: "qa", labelKey: "tab.qa", icon: FileText }
]

interface ContentAreaProps {
  activeTab: TabKey
  selectedText: string
  colors: {
    headingText: string
    textSecondary: string
    border: string
    inputBg: string
    text: string
  }
  onSetSelectedText: (text: string) => void
  children: React.ReactNode
}

const ContentArea: React.FC<ContentAreaProps> = ({
  activeTab,
  selectedText,
  colors,
  onSetSelectedText,
  children
}) => {
  const IconComponent = tabKeys.find((tab) => tab.key === activeTab)?.icon

  const getTabTitle = () => {
    switch (activeTab) {
      case "summary":
        return t("summary.title")
      case "translation":
        return t("translate.title")
      case "highlight":
        return t("highlight.title")
      case "comment":
        return t("comment.title")
      case "qa":
        return t("qa.title")
      default:
        return ""
    }
  }

  return (
    <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
      <div
        style={{
          color: colors.headingText,
          fontWeight: 700,
          marginBottom: 12,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
        {IconComponent && <IconComponent size={20} />}
        <span>{getTabTitle()}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            marginBottom: 8,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
          <FileText size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {t("common.selectedText")}
        </div>
        <textarea
          value={selectedText}
          onChange={(e) => onSetSelectedText(e.target.value)}
          placeholder="Select text in the PDF page — it will appear here automatically.Or paste text directly (Ctrl+V)."
          style={{
            width: "100%",
            minHeight: 100,
            fontSize: 12,
            lineHeight: "18px",
            resize: "vertical",
            boxSizing: "border-box",
            padding: 12,
            border: `2px solid ${colors.border}`,
            borderRadius: 10,
            background: colors.inputBg,
            color: colors.text,
            fontFamily: "inherit",
            transition: "border-color 0.2s ease",
            outline: "none"
          }}
          onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
          onBlur={(e) => (e.target.style.borderColor = colors.border)}
        />
        {selectedText && (
          <div style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary }}>
            {selectedText.length} {t("common.charsSelected")}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}

export default ContentArea
