import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  FileText,
  Globe,
  Lightbulb,
  MessageSquare,
  Moon,
  Pencil,
  Save,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X
} from "lucide-react"

import type { ChatMessage, Language, PaperMetadata, Theme } from "~types"
import { downloadMarkdown, generateMarkdown } from "~utils/export"
import { getSelectionInTab } from "~utils/get-selection"
import { getCurrentLanguage, setCurrentLanguage, t } from "~utils/i18n"
import {
  chatWithContext,
  extractMetadata,
  resetClient,
  summarize,
  translate
} from "~utils/llm-client"
import {
  clearConfig,
  deleteChatSession,
  deleteHighlight,
  deleteHighlightsByUrl,
  deleteNote,
  getChatSessionByUrl,
  getHighlightsByUrl,
  getLanguage,
  getLLMConfig,
  getMetadataByUrl,
  getNotesByUrl,
  getTheme,
  hasApiKey,
  saveChatSession,
  saveHighlights,
  saveLLMConfig,
  saveMetadata,
  saveNote,
  setLanguage as storeLanguage,
  setTheme as storeTheme,
  updateNote,
  type Highlight,
  type Note
} from "~utils/storage"

type TabKey = "summary" | "translation" | "highlight" | "comment" | "qa"

const tabKeys: Array<{ key: TabKey; labelKey: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = [
  { key: "summary", labelKey: "tab.summary", icon: FileText },
  { key: "translation", labelKey: "tab.translate", icon: Globe },
  { key: "highlight", labelKey: "tab.highlight", icon: Sparkles },
  { key: "comment", labelKey: "tab.comment", icon: MessageSquare },
  { key: "qa", labelKey: "tab.qa", icon: Bot }
]

// 加载动画组件
const Spinner = () => (
  <div
    style={{
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid rgba(255, 255, 255, 0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite"
    }}
  />
)

const isSameText = (a: string, b: string) => a === b

// Format timestamp to readable date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function Sidepanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary")
  const [error, setError] = useState<string | null>(null)

  const [selectedText, setSelectedText] = useState("")

  const [output, setOutput] = useState<React.ReactNode>("")
  const [outputType, setOutputType] = useState<"success" | "warning" | "error" | "">("")

  const showMessage = (message: React.ReactNode, type: "success" | "warning" | "error") => {
    setOutput(message)
    setOutputType(type)
  }

  const clearMessage = () => {
    setOutput("")
    setOutputType("")
  }

  const [commentDraft, setCommentDraft] = useState("")

  const [loading, setLoading] = useState(false)
  const [hasKey, setHasKey] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [currentUrl, setCurrentUrl] = useState("")
  const [currentTitle, setCurrentTitle] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  // Highlights state
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [generatingHighlights, setGeneratingHighlights] = useState(false)
  const [applyingHighlights, setApplyingHighlights] = useState(false)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  // Q&A Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatContext, setChatContext] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Metadata state
  const [metadata, setMetadata] = useState<PaperMetadata | null>(null)
  const [metadataExpanded, setMetadataExpanded] = useState(false)
  const [extractingMetadata, setExtractingMetadata] = useState(false)

  // i18n & Theme state
  const [lang, setLang] = useState<Language>("en")
  const [theme, setThemeState] = useState<Theme>("light")
  const isDark = theme === "dark"

  // Config modal state
  const configPresets = [
    { label: "OpenAI", baseURL: "", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
    { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"] },
    { label: "Qwen", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-turbo", "qwen-max"] },
    { label: "Custom", baseURL: "custom", models: [] }
  ]
  const [showConfig, setShowConfig] = useState(false)
  const [configApiKey, setConfigApiKey] = useState("")
  const [configBaseURL, setConfigBaseURL] = useState("")
  const [configModel, setConfigModel] = useState("gpt-4o-mini")
  const [configSaving, setConfigSaving] = useState(false)
  const [configMessage, setConfigMessage] = useState("")
  const [showConfigKey, setShowConfigKey] = useState(false)
  const activeConfigPreset = configPresets.find((p) =>
    p.label === "Custom" ? false : p.baseURL === configBaseURL
  ) || (configBaseURL ? configPresets.find((p) => p.label === "Custom") : configPresets[0])

  const fetchSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return

      const text = await getSelectionInTab(tab.id)

      if (text) {
        setSelectedText((prev) => (isSameText(prev, text) ? prev : text))
      }
    } catch {
      // Silently ignore — auto-refresh should not flash errors
    }
  }

  const loadNotes = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        setCurrentUrl(tab.url)
        setCurrentTitle(tab.title || "Untitled")
        setCurrentTabId(tab.id || null)
        const pageNotes = await getNotesByUrl(tab.url)
        setNotes(pageNotes)
      }
    } catch (e) {
      console.error("Failed to load notes:", e)
    }
  }

  const loadHighlights = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const pageHighlights = await getHighlightsByUrl(tab.url)
        setHighlights(pageHighlights)
      }
    } catch (e) {
      console.error("Failed to load highlights:", e)
    }
  }

  const applyHighlightsToPage = async (phrases: string[]) => {
    if (!currentTabId) return

    try {
      setApplyingHighlights(true)

      // Send message to all frames in the tab
      const response = await chrome.tabs.sendMessage(currentTabId, {
        type: "APPLY_HIGHLIGHTS",
        phrases,
        color: "#fef08a"
      })

      if (response?.success) {
        showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Applied {response.count} highlights on the page!</>, "success")
        setTimeout(() => clearMessage(), 3000)
      } else {
        showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> {response?.error || "Failed to apply highlights"}</>, "warning")
      }
    } catch (e: any) {
      showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to apply highlights: {e?.message ?? String(e)}</>, "error")
    } finally {
      setApplyingHighlights(false)
    }
  }

  const clearHighlightsFromPage = async () => {
    if (!currentTabId) return

    try {
      await chrome.tabs.sendMessage(currentTabId, {
        type: "CLEAR_HIGHLIGHTS"
      })
    } catch (e) {
      console.error("Failed to clear highlights:", e)
    }
  }

  const loadChatSession = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const session = await getChatSessionByUrl(tab.url)
        if (session) {
          setChatMessages(session.messages)
          setChatContext(session.paperContext)
        }
      }
    } catch (e) {
      console.error("Failed to load chat session:", e)
    }
  }

  const loadMetadata = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const stored = await getMetadataByUrl(tab.url)
        if (stored) setMetadata(stored)
      }
    } catch (e) {
      console.error("Failed to load metadata:", e)
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return

    const context = chatContext || selectedText
    if (!context.trim()) {
      showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please select text from the PDF first as context for Q&A</>, "warning")
      return
    }

    if (!hasKey) {
      showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured{"\n\n"}Please configure your OpenAI API Key first.</>, "warning")
      return
    }

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() }
    const newMessages = [...chatMessages, userMessage]
    setChatMessages(newMessages)
    setChatInput("")
    setChatLoading(true)

    if (!chatContext) setChatContext(context)

    try {
      const reply = await chatWithContext(newMessages, context)
      const assistantMessage: ChatMessage = { role: "assistant", content: reply }
      const updatedMessages = [...newMessages, assistantMessage]
      setChatMessages(updatedMessages)

      await saveChatSession(currentUrl, currentTitle, updatedMessages, context)
    } catch (e: any) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Error: ${e?.message ?? String(e)}`
      }
      setChatMessages([...newMessages, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  useEffect(() => {
    void fetchSelection()
    void loadNotes()
    void loadHighlights()
    void loadChatSession()
    void loadMetadata()
    // Load preferences
    getLanguage().then((l) => {
      setLang(l)
      setCurrentLanguage(l)
    })
    getTheme().then((t) => {
      setThemeState(t)
    })

    // Auto-refresh selection every 2 seconds
    const interval = setInterval(() => {
      void fetchSelection()
    }, 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    hasApiKey().then(setHasKey)
  }, [])

  // Reload data when switching tabs
  useEffect(() => {
    if (activeTab === "comment") {
      void loadNotes()
    } else if (activeTab === "highlight") {
      void loadHighlights()
    } else if (activeTab === "qa") {
      void loadChatSession()
    }
  }, [activeTab])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      if (isTyping) return

      // Number keys for tab switching
      const tabMap: Record<string, TabKey> = {
        "1": "summary",
        "2": "translation",
        "3": "highlight",
        "4": "comment",
        "5": "qa"
      }
      if (tabMap[e.key]) {
        e.preventDefault()
        setActiveTab(tabMap[e.key])
        return
      }

      // Alt shortcuts
      if (e.altKey) {
        const altMap: Record<string, TabKey> = {
          s: "summary",
          t: "translation",
          h: "highlight",
          c: "comment",
          q: "qa"
        }
        if (altMap[e.key]) {
          e.preventDefault()
          setActiveTab(altMap[e.key])
          return
        }
        if (e.key === "e") {
          e.preventDefault()
          const md = generateMarkdown(metadata, notes, highlights, chatMessages)
          const title = (currentTitle || "paper").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)
          const date = new Date().toISOString().slice(0, 10)
          downloadMarkdown(md, `impulse-${title}-${date}.md`)
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [metadata, notes, highlights, chatMessages, currentTitle])

  const canUseSelection = useMemo(() => selectedText.trim().length > 0, [selectedText])

  // Dark mode color scheme
  const colors = {
    bg: isDark ? "#1a1a2e" : "#f9fafb",
    cardBg: isDark ? "#2d2d44" : "#fff",
    text: isDark ? "#e5e5e5" : "#374151",
    textSecondary: isDark ? "#a0a0b8" : "#6b7280",
    border: isDark ? "#3d3d5c" : "#e5e7eb",
    inputBg: isDark ? "#2d2d44" : "#fff",
    sectionBg: isDark ? "#252540" : "#f9fafb",
    headingText: isDark ? "#f0f0f0" : "#111827"
  }

  return (
    <div
      style={{
        width: 380,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
        background: colors.bg,
        color: colors.text
      }}>
      {/* CSS 动画定义 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-hover {
          transition: all 0.2s ease;
        }
        .btn-hover:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .btn-hover:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .tab-btn {
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>

      {/* 头部区域 */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
          color: "#fff",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, lineHeight: "24px", marginBottom: 4 }}>
              ⚡ Impulse
            </div>
            <div style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 12 }}>
              AI-Powered PDF Assistant
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                getLLMConfig().then((config) => {
                  if (config) {
                    setConfigApiKey(config.apiKey)
                    if (config.model) setConfigModel(config.model)
                    if (config.baseURL) setConfigBaseURL(config.baseURL)
                    else setConfigBaseURL("")
                  }
                })
                setConfigMessage("")
                setShowConfig(true)
              }}
              className="btn-hover"
              title="Configure API"
              style={{
                padding: "8px 10px",
                fontSize: 14,
                background: "rgba(255, 255, 255, 0.25)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                cursor: "pointer",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center"
              }}>
              <Settings size={16} />
            </button>
            <button
              onClick={() => {
                const md = generateMarkdown(metadata, notes, highlights, chatMessages)
                const title = (currentTitle || "paper").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)
                const date = new Date().toISOString().slice(0, 10)
                downloadMarkdown(md, `impulse-${title}-${date}.md`)
              }}
              className="btn-hover"
              title="Export to Markdown"
              style={{
                padding: "8px 10px",
                fontSize: 14,
                background: "rgba(255, 255, 255, 0.25)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                cursor: "pointer",
                backdropFilter: "blur(10px)"
              }}>
              📥
            </button>
            <button
              onClick={() => {
                const newLang = lang === "en" ? "zh" : "en"
                setLang(newLang as Language)
                setCurrentLanguage(newLang as Language)
                void storeLanguage(newLang as Language)
              }}
              className="btn-hover"
              title="Toggle Language"
              style={{
                padding: "8px 10px",
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(255, 255, 255, 0.25)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                cursor: "pointer",
                backdropFilter: "blur(10px)"
              }}>
              {lang === "en" ? "中" : "EN"}
            </button>
            <button
              onClick={() => {
                const newTheme = isDark ? "light" : "dark"
                setThemeState(newTheme)
                void storeTheme(newTheme)
              }}
              className="btn-hover"
              title="Toggle Theme"
              style={{
                padding: "8px 10px",
                fontSize: 14,
                background: "rgba(255, 255, 255, 0.25)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                cursor: "pointer",
                backdropFilter: "blur(10px)"
              }}>
              {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#a5b4fc" />}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {tabKeys.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="tab-btn"
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.15)",
                  color: isActive ? "#3b82f6" : "rgba(255, 255, 255, 0.9)",
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

        {/* 错误提示 */}
        {error && (
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
        )}
      </div>

      {/* Metadata Card */}
      <div style={{ padding: "0 12px", marginTop: 8 }}>
        {metadata ? (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              overflow: "hidden",
              marginBottom: 4
            }}>
            <button
              onClick={() => setMetadataExpanded(!metadataExpanded)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151"
              }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> {metadata.title || "Paper Metadata"}
              </span>
              <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 8 }}>
                {metadataExpanded ? "▲" : "▼"}
              </span>
            </button>
            {metadataExpanded && (
              <div style={{ padding: "0 12px 10px", fontSize: 12, color: "#6b7280", lineHeight: "20px" }}>
                {metadata.authors.length > 0 && (
                  <div><strong>Authors:</strong> {metadata.authors.join(", ")}</div>
                )}
                {metadata.year && <div><strong>Year:</strong> {metadata.year}</div>}
                {metadata.journal && <div><strong>Journal:</strong> {metadata.journal}</div>}
                {metadata.doi && <div><strong>DOI:</strong> {metadata.doi}</div>}
                <button
                  onClick={() => {
                    const citation = `${metadata.authors.join(", ")} (${metadata.year}). ${metadata.title}. ${metadata.journal}.${metadata.doi ? ` DOI: ${metadata.doi}` : ""}`
                    navigator.clipboard.writeText(citation)
                    showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Citation copied!</>, "success")
                    setTimeout(() => clearMessage(), 2000)
                  }}
                  style={{
                    marginTop: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    background: "#eff6ff",
                    color: "#3b82f6",
                    border: "1px solid #bfdbfe",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600
                  }}>
                  Copy Citation
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={async () => {
              if (!selectedText.trim()) {
                setError("Please select paper header text first, then refresh")
                return
              }
              if (!hasKey) {
                setError("Please configure API Key first")
                return
              }
              setExtractingMetadata(true)
              try {
                const result = await extractMetadata(selectedText)
                setMetadata(result)
                await saveMetadata(currentUrl, result)
                setMetadataExpanded(true)
              } catch (e: any) {
                setError(`Metadata extraction failed: ${e?.message ?? String(e)}`)
              } finally {
                setExtractingMetadata(false)
              }
            }}
            disabled={extractingMetadata}
            style={{
              width: "100%",
              padding: "6px 12px",
              fontSize: 11,
              background: "#f9fafb",
              color: "#6b7280",
              border: "1px dashed #d1d5db",
              borderRadius: 8,
              cursor: extractingMetadata ? "not-allowed" : "pointer",
              fontWeight: 600,
              marginBottom: 4
            }}>
            {extractingMetadata ? "Extracting..." : (<><FileText size={14} style={{ marginRight: 4, color: "#3b82f6" }} /> Extract Paper Metadata</>)}
          </button>
        )}
      </div>

      {/* 内容区 */}
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
          {(() => {
            const IconComponent = tabKeys.find((tab) => tab.key === activeTab)?.icon
            return IconComponent ? <IconComponent size={20} /> : null
          })()}
          <span>
            {activeTab === "summary" && t("summary.title")}
            {activeTab === "translation" && t("translate.title")}
            {activeTab === "highlight" && t("highlight.title")}
            {activeTab === "comment" && t("comment.title")}
            {activeTab === "qa" && t("qa.title")}
          </span>
        </div>

        {/* 通用：展示选中文本 */}
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
            onChange={(e) => setSelectedText(e.target.value)}
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

        {/* 各栏操作 */}
        {activeTab === "summary" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <button
              disabled={!canUseSelection || loading}
              onClick={async () => {
                if (!hasKey) {
                  showMessage(
                    <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured{"\n\n"}Please configure your OpenAI API Key first:{"\n"}1. Right-click extension icon{"\n"}2. Select 'Options'{"\n"}3. Enter your API Key</>, "warning"
                  )
                  return
                }
                setLoading(true)
                showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Generating summary...</>, "success")
                try {
                  const result = await summarize(selectedText)
                  showMessage(result, "success")
                } catch (e: any) {
                  showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to generate summary:{"\n\n"}{e?.message ?? String(e)}</>, "error")
                } finally {
                  setLoading(false)
                }
              }}
              className="btn-hover"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background:
                  canUseSelection && !loading
                    ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
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
                boxShadow:
                  canUseSelection && !loading ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "none"
              }}>
              {loading ? (
                <>
                  <Spinner /> Generating...
                </>
              ) : (
                <><Pencil size={14} /> Generate Summary</>
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
                }}>
                <Lightbulb size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {t("common.output")}
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: `2px solid ${colors.border}`,
                  borderRadius: 10,
                  minHeight: 120,
                  background: colors.cardBg,
                  color: colors.text,
                  boxShadow: output ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none"
                }}>
                {output || (
                  <span style={{ color: colors.textSecondary, fontStyle: "italic" }}>
                    {t("summary.placeholder")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "translation" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <button
              disabled={!canUseSelection || loading}
              onClick={async () => {
                if (!hasKey) {
                  showMessage(
                    <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured{"\n\n"}Please configure your OpenAI API Key first:{"\n"}1. Right-click extension icon{"\n"}2. Select 'Options'{"\n"}3. Enter your API Key</>, "warning"
                  )
                  return
                }
                setLoading(true)
                showMessage(<><Globe size={14} style={{ marginRight: 4, color: "#10b981" }} /> Translating to Chinese...</>, "success")
                try {
                  const result = await translate(selectedText)
                  showMessage(result, "success")
                } catch (e: any) {
                  showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Translation failed:{"\n\n"}{e?.message ?? String(e)}</>, "error")
                } finally {
                  setLoading(false)
                }
              }}
              className="btn-hover"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
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
              }}>
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
                }}>
                <Lightbulb size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {t("common.output")}
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: "22px",
                  padding: 16,
                  border: `2px solid ${colors.border}`,
                  borderRadius: 10,
                  minHeight: 120,
                  background: colors.cardBg,
                  color: colors.text,
                  boxShadow: output ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none"
                }}>
                {output || (
                  <span style={{ color: colors.textSecondary, fontStyle: "italic" }}>
                    {t("translate.placeholder")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "highlight" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Highlight selected text button */}
            <button
              disabled={!canUseSelection || generatingHighlights}
              className="btn-hover"
              onClick={async () => {
                if (!canUseSelection) {
                  showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please select text first</>, "warning")
                  return
                }

                setGeneratingHighlights(true)

                try {
                  // Save highlight to storage
                  await saveHighlights(
                    [selectedText],
                    selectedText,
                    currentUrl,
                    currentTitle
                  )

                  // Apply highlight to the page
                  await applyHighlightsToPage([selectedText])

                  // Reload highlights list
                  await loadHighlights()

                  showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Highlighted successfully!</>, "success")
                } catch (e: any) {
                  showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to highlight:{"\n\n"}{e?.message ?? String(e)}</>, "error")
                } finally {
                  setGeneratingHighlights(false)
                }
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                background:
                  canUseSelection && !generatingHighlights
                    ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                    : "#cbd5e1",
                color: "#fff",
                border: "none",
                cursor:
                  canUseSelection && !generatingHighlights ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow:
                  canUseSelection && !generatingHighlights
                    ? "0 4px 12px rgba(245, 158, 11, 0.4)"
                    : "none"
              }}>
              {generatingHighlights ? (
                <>
                  <Spinner /> Highlighting...
                </>
              ) : (
                <><Sparkles size={14} /> {t("highlight.title")}</>
              )}
            </button>

            {/* Status message */}
            {output && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: outputType === "success"
                    ? "#d1fae5"
                    : outputType === "warning"
                      ? "#fef3c7"
                      : "#fee2e2",
                  color: outputType === "success"
                    ? "#065f46"
                    : outputType === "warning"
                      ? "#92400e"
                      : "#991b1b",
                  fontSize: 12,
                  lineHeight: "18px",
                  whiteSpace: "pre-wrap",
                  animation: "fadeIn 0.3s ease"
                }}>
                {output}
              </div>
            )}

            {/* Highlights list */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <span><Sparkles size={12} style={{ marginRight: 4, color: "#f59e0b" }} /> Active Highlights ({highlights.length})</span>
                {highlights.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        await clearHighlightsFromPage()
                        showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Cleared highlights from page</>, "success")
                        setTimeout(() => clearMessage(), 2000)
                      }}
                      disabled={applyingHighlights}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#3b82f6",
                        cursor: applyingHighlights ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 4
                      }}>
                      {applyingHighlights ? "Applying..." : "Reapply"}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete all ${highlights.length} highlights for this page?`)) {
                          try {
                            await deleteHighlightsByUrl(currentUrl)
                            await clearHighlightsFromPage()
                            await loadHighlights()
                            showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> All highlights deleted</>, "success")
                            setTimeout(() => clearMessage(), 2000)
                          } catch (e: any) {
                            showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
                          }
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 4
                      }}>
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {highlights.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 10,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}><Sparkles size={32} color="#f59e0b" /></div>
                  <div>No highlights yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Select text and click to highlight!
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {highlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      style={{
                        padding: 10,
                        border: "2px solid #fcd34d",
                        borderRadius: 8,
                        background: "#fefce8",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#f59e0b"
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(245, 158, 11, 0.15)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#fcd34d"
                        e.currentTarget.style.boxShadow = "none"
                      }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "start",
                          justifyContent: "space-between",
                          gap: 8
                        }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#92400e",
                              fontWeight: 600,
                              marginBottom: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#f59e0b"
                              }}
                            />
                            {highlight.phrase}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {formatDate(highlight.timestamp)}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this highlight?")) {
                              try {
                                await deleteHighlight(highlight.id)
                                await loadHighlights()
                                // Reapply remaining highlights
                                const remaining = highlights.filter((h) => h.id !== highlight.id)
                                if (remaining.length > 0) {
                                  await applyHighlightsToPage(remaining.map((h) => h.phrase))
                                } else {
                                  await clearHighlightsFromPage()
                                }
                                showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Highlight deleted</>, "success")
                                setTimeout(() => clearMessage(), 2000)
                              } catch (e: any) {
                                showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
                              }
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            fontSize: 14,
                            color: "#ef4444"
                          }}
                          title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "comment" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Add new note form */}
            <div
              style={{
                color: "#6b7280",
                fontSize: 11,
                marginBottom: 8,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              <Pencil size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {editingNoteId ? "Edit Note" : "New Note"}
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write your thoughts, questions, or key points here..."
              style={{
                width: "100%",
                minHeight: 100,
                fontSize: 13,
                lineHeight: "20px",
                resize: "vertical",
                boxSizing: "border-box",
                padding: 12,
                border: `2px solid ${colors.border}`,
                borderRadius: 10,
                background: colors.cardBg,
                color: "#374151",
                fontFamily: "inherit",
                transition: "border-color 0.2s ease",
                outline: "none"
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                disabled={
                  (editingNoteId ? false : !canUseSelection) ||
                  !commentDraft.trim() ||
                  savingNote
                }
                className="btn-hover"
                onClick={async () => {
                  if (editingNoteId) {
                    // Update existing note
                    try {
                      setSavingNote(true)
                      await updateNote(editingNoteId, commentDraft.trim())
                      setCommentDraft("")
                      setEditingNoteId(null)
                      await loadNotes()
                      showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note updated successfully!</>, "success")
                      setTimeout(() => clearMessage(), 2000)
                    } catch (e: any) {
                      showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to update note: {e?.message ?? String(e)}</>, "error")
                    } finally {
                      setSavingNote(false)
                    }
                  } else {
                    // Save new note
                    if (!canUseSelection) {
                      showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please select text first</>, "warning")
                      return
                    }
                    if (!commentDraft.trim()) {
                      showMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please write a note</>, "warning")
                      return
                    }
                    try {
                      setSavingNote(true)
                      await saveNote(
                        selectedText.trim(),
                        commentDraft.trim(),
                        currentUrl,
                        currentTitle
                      )
                      setCommentDraft("")
                      await loadNotes()
                      showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note saved successfully!</>, "success")
                      setTimeout(() => clearMessage(), 2000)
                    } catch (e: any) {
                      showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to save note: {e?.message ?? String(e)}</>, "error")
                    } finally {
                      setSavingNote(false)
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                      : "#cbd5e1",
                  color: "#fff",
                  border: "none",
                  cursor:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow:
                    ((editingNoteId ? true : canUseSelection) &&
                      commentDraft.trim() &&
                      !savingNote)
                      ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                      : "none"
                }}>
                {savingNote ? (
                  <>
                    <Spinner /> Saving...
                  </>
                ) : editingNoteId ? (
                  <><Save size={14} /> Update Note</>
                ) : (
                  <><Save size={14} /> Save Note</>
                )}
              </button>
              {editingNoteId && (
                <button
                  disabled={savingNote}
                  onClick={() => {
                    setEditingNoteId(null)
                    setCommentDraft("")
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: colors.cardBg,
                    color: "#6b7280",
                    border: `2px solid ${colors.border}`,
                    cursor: savingNote ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.2s ease"
                  }}>
                  <X size={14} /> Cancel
                </button>
              )}
              {!editingNoteId && (
                <button
                  disabled={!commentDraft.trim()}
                  onClick={() => setCommentDraft("")}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: colors.cardBg,
                    color: "#6b7280",
                    border: `2px solid ${colors.border}`,
                    cursor: commentDraft.trim() ? "pointer" : "not-allowed",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (commentDraft.trim()) {
                      e.currentTarget.style.borderColor = "#f87171"
                      e.currentTarget.style.color = "#ef4444"
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb"
                    e.currentTarget.style.color = "#6b7280"
                  }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Status message */}
            {output && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: outputType === "success" ? "#d1fae5" : "#fee2e2",
                  color: outputType === "success" ? "#065f46" : "#991b1b",
                  fontSize: 12,
                  animation: "fadeIn 0.3s ease"
                }}>
                {output}
              </div>
            )}

            {/* Notes list */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <span><FileText size={12} style={{ marginRight: 4, color: "#6b7280" }} /> Saved Notes ({notes.length})</span>
                {notes.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete all ${notes.length} notes for this page?`)) {
                        Promise.all(notes.map((note) => deleteNote(note.id)))
                          .then(() => loadNotes())
                          .then(() => {
                            showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> All notes deleted</>, "success")
                            setTimeout(() => clearMessage(), 2000)
                          })
                          .catch((e: any) => {
                            showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete notes: {e?.message ?? String(e)}</>, "error")
                          })
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: 4
                    }}>
                    Clear All
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 10,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}><MessageSquare size={32} color="#3b82f6" /></div>
                  <div>No notes yet</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Select text and create your first note!
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: 12,
                        border: `2px solid ${colors.border}`,
                        borderRadius: 10,
                        background: colors.cardBg,
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6"
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb"
                        e.currentTarget.style.boxShadow = "none"
                      }}>
                      {/* Note header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8
                        }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {formatDate(note.timestamp)}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id)
                              setCommentDraft(note.comment)
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 4,
                              fontSize: 14,
                              color: "#3b82f6"
                            }}
                            title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Delete this note?")) {
                                try {
                                  await deleteNote(note.id)
                                  await loadNotes()
                                  showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note deleted</>, "success")
                                  setTimeout(() => clearMessage(), 2000)
                                } catch (e: any) {
                                  showMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
                                }
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 4,
                              fontSize: 14,
                              color: "#ef4444"
                            }}
                            title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {/* Selected text (quote) */}
                      <div
                        style={{
                          padding: 8,
                          background: "#f9fafb",
                          borderLeft: "3px solid #3b82f6",
                          borderRadius: 4,
                          marginBottom: 8,
                          fontSize: 12,
                          color: "#6b7280",
                          fontStyle: "italic",
                          lineHeight: "18px"
                        }}>
                        "{note.selectedText.slice(0, 150)}
                        {note.selectedText.length > 150 ? "..." : ""}"
                      </div>
                      {/* User comment */}
                      <div
                        style={{
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: "20px",
                          whiteSpace: "pre-wrap"
                        }}>
                        {note.comment}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "qa" && (
          <div style={{ animation: "fadeIn 0.4s ease", display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Context indicator */}
            <div
              style={{
                padding: 10,
                background: chatContext ? "#eff6ff" : "#fef3c7",
                border: `1px solid ${chatContext ? "#bfdbfe" : "#fcd34d"}`,
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 12,
                color: chatContext ? "#1e40af" : "#92400e",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {chatContext
                  ? <><FileText size={12} /> Context: {chatContext.slice(0, 80)}{chatContext.length > 80 ? "..." : ""}</>
                  : <><AlertTriangle size={12} /> Select text from PDF and refresh to set context</>}
              </span>
              {chatContext && (
                <button
                  onClick={() => {
                    if (selectedText.trim()) {
                      setChatContext(selectedText)
                      showMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Context updated</>, "success")
                      setTimeout(() => clearMessage(), 2000)
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3b82f6",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: 4,
                    whiteSpace: "nowrap"
                  }}>
                  Update
                </button>
              )}
            </div>

            {/* Chat messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 200,
                maxHeight: 400,
                padding: 4
              }}>
              {chatMessages.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 10,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}><Bot size={32} color="#8b5cf6" /></div>
                  <div>Ask questions about the paper</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Select text, refresh, then start chatting!
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                    }}>
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: "10px 14px",
                        borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background:
                          msg.role === "user"
                            ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                            : colors.sectionBg,
                        color: msg.role === "user" ? "#fff" : "#374151",
                        fontSize: 13,
                        lineHeight: "20px",
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                      }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "14px 14px 14px 4px",
                      background: colors.sectionBg,
                      color: "#6b7280",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                    <div
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        border: "2px solid #d1d5db",
                        borderTop: "2px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                      }}
                    />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendChat()
                  }
                }}
                placeholder="Ask a question about the paper..."
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  fontSize: 13,
                  border: `2px solid ${colors.border}`,
                  borderRadius: 10,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s ease"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
              <button
                onClick={() => void handleSendChat()}
                disabled={!chatInput.trim() || chatLoading}
                className="btn-hover"
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background:
                    chatInput.trim() && !chatLoading
                      ? "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
                      : "#cbd5e1",
                  color: "#fff",
                  border: "none",
                  cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: 13
                }}>
                {chatLoading ? <Spinner /> : "Send"}
              </button>
            </div>

            {/* Clear chat button */}
            {chatMessages.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm("Clear chat history for this page?")) {
                    setChatMessages([])
                    setChatContext("")
                    await deleteChatSession(currentUrl)
                  }
                }}
                style={{
                  marginTop: 10,
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: 4,
                  textAlign: "center"
                }}>
                Clear Chat History
              </button>
            )}
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfig(false) }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 360,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
              animation: "fadeIn 0.2s ease"
            }}>
            {/* Modal header */}
            <div
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                padding: "16px 20px",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
                <Settings size={18} /> Configure API
              </div>
              <button
                onClick={() => setShowConfig(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 20 }}>
              {/* API Key */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  API Key *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfigKey ? "text" : "password"}
                    value={configApiKey}
                    onChange={(e) => setConfigApiKey(e.target.value)}
                    placeholder="sk-..."
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 10px",
                      fontSize: 13,
                      border: "2px solid #e5e7eb",
                      borderRadius: 8,
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                    onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfigKey(!showConfigKey)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>
                    {showConfigKey ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Provider */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Provider
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {configPresets.map((preset) => {
                    const isActive = preset.label === "Custom"
                      ? activeConfigPreset?.label === "Custom"
                      : configBaseURL === preset.baseURL
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          if (preset.label === "Custom") {
                            setConfigBaseURL("custom")
                          } else {
                            setConfigBaseURL(preset.baseURL)
                            if (preset.models.length > 0) setConfigModel(preset.models[0])
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          border: isActive ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                          borderRadius: 6,
                          background: isActive ? "#eff6ff" : "#fff",
                          color: isActive ? "#3b82f6" : "#374151",
                          cursor: "pointer"
                        }}>
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                {activeConfigPreset?.label === "Custom" && (
                  <input
                    type="text"
                    value={configBaseURL === "custom" ? "" : configBaseURL}
                    onChange={(e) => setConfigBaseURL(e.target.value || "custom")}
                    placeholder="https://your-api-endpoint.com/v1"
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "10px",
                      fontSize: 13,
                      border: "2px solid #e5e7eb",
                      borderRadius: 8,
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                    onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                  />
                )}
              </div>

              {/* Model */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Model
                </label>
                {activeConfigPreset && activeConfigPreset.models.length > 0 ? (
                  <select
                    value={configModel}
                    onChange={(e) => setConfigModel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: 13,
                      border: "2px solid #e5e7eb",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer",
                      outline: "none"
                    }}>
                    {activeConfigPreset.models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={configModel}
                    onChange={(e) => setConfigModel(e.target.value)}
                    placeholder="model-name"
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: 13,
                      border: "2px solid #e5e7eb",
                      borderRadius: 8,
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                    onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                  />
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  disabled={configSaving || !configApiKey.trim()}
                  onClick={async () => {
                    if (!configApiKey.trim()) {
                      setConfigMessage("error:Please enter your API Key")
                      return
                    }
                    setConfigSaving(true)
                    setConfigMessage("")
                    try {
                      const effectiveBaseURL = configBaseURL === "custom" ? "" : configBaseURL
                      await saveLLMConfig({
                        provider: "openai",
                        apiKey: configApiKey.trim(),
                        model: configModel,
                        baseURL: effectiveBaseURL || undefined
                      })
                      resetClient()
                      setHasKey(true)
                      setConfigMessage("success:Saved!")
                      setTimeout(() => {
                        setConfigMessage("")
                        setShowConfig(false)
                      }, 1200)
                    } catch (e: any) {
                      setConfigMessage(`error:${e?.message ?? String(e)}`)
                    } finally {
                      setConfigSaving(false)
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: configSaving || !configApiKey.trim() ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: configSaving || !configApiKey.trim() ? "not-allowed" : "pointer"
                  }}>
                  {configSaving ? "Saving..." : "Save"}
                </button>
                {configApiKey && (
                  <button
                    onClick={async () => {
                      if (confirm("Clear API configuration?")) {
                        await clearConfig()
                        setConfigApiKey("")
                        setConfigBaseURL("")
                        setConfigModel("gpt-4o-mini")
                        setHasKey(false)
                        setConfigMessage("success:Cleared")
                        setTimeout(() => setConfigMessage(""), 2000)
                      }
                    }}
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#fff",
                      color: "#ef4444",
                      border: "2px solid #ef4444",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}>
                    🗑️
                  </button>
                )}
              </div>

              {/* Message */}
              {configMessage && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    fontSize: 12,
                    borderRadius: 8,
                    background: configMessage.startsWith("success") ? "#d1fae5" : "#fee2e2",
                    color: configMessage.startsWith("success") ? "#065f46" : "#991b1b",
                    animation: "fadeIn 0.3s ease"
                  }}>
                  {configMessage.split(":").slice(1).join(":")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

