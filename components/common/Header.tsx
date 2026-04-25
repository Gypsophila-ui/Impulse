import React from "react"
import { Bot, FileText, Globe, MessageSquare, Moon, Settings, Sparkles, Sun, Zap } from "lucide-react"

import type { ChatMessage, Language, PaperMetadata, Theme } from "~types"
import { borderRadius, shadows } from "~utils/design-tokens"
import { downloadMarkdown, generateMarkdown } from "~utils/export"
import { getCurrentLanguage, setCurrentLanguage, t } from "~utils/i18n"
import { getLLMConfig } from "~utils/storage"
import type { Highlight, Note } from "~utils/storage"

type TabKey = "summary" | "translation" | "highlight" | "comment" | "qa"
type AppMode = "assistant" | "agent"

const tabKeys: Array<{ key: TabKey; labelKey: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = [
  { key: "summary", labelKey: "tab.summary", icon: FileText },
  { key: "translation", labelKey: "tab.translate", icon: Globe },
  { key: "highlight", labelKey: "tab.highlight", icon: Sparkles },
  { key: "comment", labelKey: "tab.comment", icon: MessageSquare },
  { key: "qa", labelKey: "tab.qa", icon: Bot }
]

interface HeaderProps {
  lang: Language
  theme: Theme
  mode: AppMode
  activeTab: TabKey
  metadata: PaperMetadata | null
  notes: Note[]
  highlights: Highlight[]
  chatMessages: ChatMessage[]
  currentTitle: string
  onSetActiveTab: (tab: TabKey) => void
  onSetLang: (lang: Language) => void
  onSetTheme: (theme: Theme) => void
  onSetMode: (mode: AppMode) => void
  onStoreLanguage: (lang: Language) => void
  onStoreTheme: (theme: Theme) => void
  onShowConfig: () => void
  onSetConfigApiKey: (key: string) => void
  onSetConfigBaseURL: (url: string) => void
  onSetConfigModel: (model: string) => void
  onSetConfigMessage: (message: string) => void
}

const Header: React.FC<HeaderProps> = ({
  lang,
  theme,
  mode,
  activeTab,
  metadata,
  notes,
  highlights,
  chatMessages,
  currentTitle,
  onSetActiveTab,
  onSetLang,
  onSetTheme,
  onSetMode,
  onStoreLanguage,
  onStoreTheme,
  onShowConfig,
  onSetConfigApiKey,
  onSetConfigBaseURL,
  onSetConfigModel,
  onSetConfigMessage
}) => {
  const isDark = theme === "dark"
  const isAgentMode = mode === "agent"

  const handleOpenConfig = () => {
    getLLMConfig().then((config) => {
      if (config) {
        onSetConfigApiKey(config.apiKey)
        if (config.model) onSetConfigModel(config.model)
        if (config.baseURL) onSetConfigBaseURL(config.baseURL)
        else onSetConfigBaseURL("")
      }
    })
    onSetConfigMessage("")
    onShowConfig()
  }

  const handleExport = () => {
    const md = generateMarkdown(metadata, notes, highlights, chatMessages)
    const title = (currentTitle || "paper").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)
    const date = new Date().toISOString().slice(0, 10)
    downloadMarkdown(md, `impulse-${title}-${date}.md`)
  }

  const handleToggleLanguage = () => {
    const newLang = lang === "en" ? "zh" : "en"
    onSetLang(newLang as Language)
    setCurrentLanguage(newLang as Language)
    onStoreLanguage(newLang as Language)
  }

  const handleToggleTheme = () => {
    const newTheme = isDark ? "light" : "dark"
    onSetTheme(newTheme)
    onStoreTheme(newTheme)
  }

  const handleToggleMode = () => {
    onSetMode(isAgentMode ? "assistant" : "agent")
  }

  return (
    <div
      style={{
        padding: "16px",
        borderBottom: "1px solid #e5e7eb",
        borderRadius: borderRadius.sm,
        background: isAgentMode
          ? "linear-gradient(135deg, #efd083 0%, #d4b65a 100%)"
          : "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
        color: "#fff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, lineHeight: "24px", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            {isAgentMode ? <Zap size={18} /> : <MessageSquare size={16} />} Impulse
            <span style={{ 
              fontSize: 10, 
              padding: "2px 6px", 
              background: "rgba(255,255,255,0.2)", 
              borderRadius: borderRadius.xs,
              fontWeight: 600
            }}>
              {isAgentMode ? "Agent" : "Assistant"}
            </span>
          </div>
          <div style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 12 }}>
            {isAgentMode ? "AI-Powered PDF Explorer" : "AI-Powered PDF Assistant"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleToggleMode}
            className="btn-hover"
            title={isAgentMode ? "Switch to Assistant Mode" : "Switch to Agent Mode"}
            style={{
              padding: "8px 10px",
              fontSize: 14,
              background: isAgentMode ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: borderRadius.sm,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
            {isAgentMode ? <MessageSquare size={16} /> : <Zap size={16} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>{isAgentMode ? "Assistant" : "Agent"}</span>
          </button>
          <button
            onClick={handleOpenConfig}
            className="btn-hover"
            title="Configure API"
            style={{
              padding: "8px 10px",
              fontSize: 14,
              background: "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: borderRadius.sm,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center"
            }}>
            <Settings size={16} />
          </button>
          <button
            onClick={handleExport}
            className="btn-hover"
            title="Export to Markdown"
            style={{
              padding: "8px 10px",
              fontSize: 14,
              background: "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: borderRadius.sm,
              cursor: "pointer",
              backdropFilter: "blur(10px)"
            }}>
            📥
          </button>
          <button
            onClick={handleToggleLanguage}
            className="btn-hover"
            title="Toggle Language"
            style={{
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: borderRadius.sm,
              cursor: "pointer",
              backdropFilter: "blur(10px)"
            }}>
            {lang === "en" ? "中" : "EN"}
          </button>
          <button
            onClick={handleToggleTheme}
            className="btn-hover"
            title="Toggle Theme"
            style={{
              padding: "8px 10px",
              fontSize: 14,
              background: "rgba(255, 255, 255, 0.25)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: borderRadius.sm,
              cursor: "pointer",
              backdropFilter: "blur(10px)"
            }}>
            {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#c4b5fd" />}
          </button>
        </div>
      </div>

      {!isAgentMode && (
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {tabKeys.map((tab) => {
            const isActive = activeTab === tab.key
            const tabColors: Record<string, string> = {
              summary: "#0d9488",
              translation: "#10b981",
              highlight: "#f59e0b",
              comment: "#f43f5e",
              qa: "#0ea5e9"
            }
            const activeColor = tabColors[tab.key] || "#0d9488"
            return (
              <button
                key={tab.key}
                onClick={() => onSetActiveTab(tab.key)}
                className="tab-btn"
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: borderRadius.sm,
                  border: "none",
                  background: isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.15)",
                  color: isActive ? activeColor : "rgba(255, 255, 255, 0.9)",
                  cursor: "pointer",
                  backdropFilter: "blur(10px)",
                  boxShadow: isActive ? "0 2px 8px rgba(0, 0, 0, 0.1)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3
                }}>
                <div><tab.icon size={16} /></div>
                <div>{t(tab.labelKey)}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Header
export type { TabKey, AppMode }
