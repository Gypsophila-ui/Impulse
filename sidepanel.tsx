import React, { useEffect, useMemo, useState } from "react"

import {
  AgentView,
  AskUserQuestionModal,
  ConfigModal,
  ContentArea,
  ErrorAlert,
  GlobalStyles,
  Header,
  HighlightTab,
  MetadataCard,
  NotesTab,
  QATab,
  SummaryTab,
  TranslationTab
} from "./components"

import type { AgentChatResult, AskUserQuestionParams, AskUserQuestionResult, ChatMessage, Language, PaperMetadata, ReadingGoal, Theme } from "./types"
import { downloadMarkdown, generateMarkdown } from "./utils/export"
import { getSelectionInTab } from "./utils/get-selection"
import { getCurrentLanguage, setCurrentLanguage } from "./utils/i18n"
import {
  resetClient,
  summarize,
  translate
} from "./utils/llm-client"
import {
  deleteChatSession,
  getChatSessionByUrl,
  getHighlightsByUrl,
  getLanguage,
  getMetadataByUrl,
  getNotesByUrl,
  getTheme,
  hasApiKey,
  saveChatSession,
  saveLLMConfig,
  setLanguage as storeLanguage,
  setTheme as storeTheme,
  type Highlight,
  type Note
} from "./utils/storage"

import type { AppMode, TabKey } from "./components/common/Header"

const isSameText = (a: string, b: string) => a === b

export default function Sidepanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary")
  const [mode, setMode] = useState<AppMode>("assistant")
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

  // Agent mode state
  const [agentMode, setAgentMode] = useState(true)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const [lastToolCalls, setLastToolCalls] = useState<AgentChatResult["toolCallsExecuted"]>([])
  const [chatSummary, setChatSummary] = useState<string | undefined>(undefined)

  // Reading goal state
  const [readingGoal, setReadingGoal] = useState<ReadingGoal>("understand_method")

  // Ask User Question state
  const [askQuestionParams, setAskQuestionParams] = useState<AskUserQuestionParams | null>(null)
  const [askQuestionResolve, setAskQuestionResolve] = useState<((result: AskUserQuestionResult) => void) | null>(null)

  // Ask User Question callback
  const handleAskUserQuestion = async (params: AskUserQuestionParams): Promise<AskUserQuestionResult> => {
    return new Promise((resolve) => {
      setAskQuestionParams(params)
      setAskQuestionResolve(() => resolve)
    })
  }

  const handleAskQuestionSubmit = (result: AskUserQuestionResult) => {
    setAskQuestionParams(null)
    setAskQuestionResolve(null)
    askQuestionResolve?.(result)
  }

  const handleAskQuestionCancel = () => {
    setAskQuestionParams(null)
    setAskQuestionResolve(null)
    askQuestionResolve?.({ selected: "", isCustomInput: false })
  }

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

  const loadChatSession = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const session = await getChatSessionByUrl(tab.url)
        if (session) {
          setChatMessages(session.messages)
          setChatContext(session.paperContext)
          setChatSummary(session.summary)
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
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
        background: colors.bg,
        color: colors.text
      }}>
      <GlobalStyles />

      {/* 头部区域 */}
      <Header
        lang={lang}
        theme={theme}
        mode={mode}
        activeTab={activeTab}
        metadata={metadata}
        notes={notes}
        highlights={highlights}
        chatMessages={chatMessages}
        currentTitle={currentTitle}
        onSetActiveTab={setActiveTab}
        onSetLang={setLang}
        onSetTheme={setThemeState}
        onSetMode={setMode}
        onStoreLanguage={storeLanguage}
        onStoreTheme={storeTheme}
        onShowConfig={() => setShowConfig(true)}
        onSetConfigApiKey={setConfigApiKey}
        onSetConfigBaseURL={setConfigBaseURL}
        onSetConfigModel={setConfigModel}
        onSetConfigMessage={setConfigMessage}
      />

      <ErrorAlert error={error} />

      {/* Agent Mode */}
      {mode === "agent" ? (
        <AgentView
          selectedText={selectedText}
          chatMessages={chatMessages}
          chatInput={chatInput}
          chatLoading={chatLoading}
          chatContext={chatContext}
          agentStatus={agentStatus}
          lastToolCalls={lastToolCalls}
          chatSummary={chatSummary}
          readingGoal={readingGoal}
          currentUrl={currentUrl}
          currentTitle={currentTitle}
          currentTabId={currentTabId}
          hasKey={hasKey}
          colors={colors}
          onShowMessage={showMessage}
          onClearMessage={clearMessage}
          onSetChatInput={setChatInput}
          onSetChatLoading={setChatLoading}
          onSetChatMessages={setChatMessages}
          onSetChatContext={setChatContext}
          onSetAgentStatus={setAgentStatus}
          onSetLastToolCalls={setLastToolCalls}
          onSetChatSummary={setChatSummary}
          onSetReadingGoal={setReadingGoal}
          onAskUserQuestion={handleAskUserQuestion}
        />
      ) : (
        <>
          {/* Metadata Card */}
          <div style={{ padding: "0 12px", marginTop: 8 }}>
            <MetadataCard
              metadata={metadata}
              metadataExpanded={metadataExpanded}
              selectedText={selectedText}
              hasKey={hasKey}
              currentUrl={currentUrl}
              extractingMetadata={extractingMetadata}
              onSetMetadata={setMetadata}
              onSetMetadataExpanded={setMetadataExpanded}
              onSetExtractingMetadata={setExtractingMetadata}
              onSetError={setError}
              onShowMessage={showMessage}
              onClearMessage={clearMessage}
            />
          </div>

          {/* 内容区 */}
          <ContentArea
            activeTab={activeTab}
            selectedText={selectedText}
            colors={colors}
            onSetSelectedText={setSelectedText}
          >
            {activeTab === "summary" && (
              <SummaryTab
                selectedText={selectedText}
                output={output}
                loading={loading}
                hasKey={hasKey}
                readingGoal={readingGoal}
                colors={colors}
                onReadingGoalChange={setReadingGoal}
                onShowMessage={showMessage}
                onSetLoading={setLoading}
              />
            )}

            {activeTab === "translation" && (
              <TranslationTab
                selectedText={selectedText}
                output={output}
                loading={loading}
                hasKey={hasKey}
                colors={colors}
                onShowMessage={showMessage}
                onSetLoading={setLoading}
              />
            )}

            {activeTab === "highlight" && (
              <HighlightTab
                selectedText={selectedText}
                output={output}
                outputType={outputType}
                generatingHighlights={generatingHighlights}
                applyingHighlights={applyingHighlights}
                highlights={highlights}
                currentUrl={currentUrl}
                currentTitle={currentTitle}
                currentTabId={currentTabId}
                colors={colors}
                onShowMessage={showMessage}
                onClearMessage={clearMessage}
                onSetGeneratingHighlights={setGeneratingHighlights}
                onSetApplyingHighlights={setApplyingHighlights}
                onLoadHighlights={loadHighlights}
              />
            )}

            {activeTab === "comment" && (
              <NotesTab
                selectedText={selectedText}
                output={output}
                outputType={outputType}
                commentDraft={commentDraft}
                savingNote={savingNote}
                editingNoteId={editingNoteId}
                notes={notes}
                currentUrl={currentUrl}
                currentTitle={currentTitle}
                colors={colors}
                onShowMessage={showMessage}
                onClearMessage={clearMessage}
                onSetSavingNote={setSavingNote}
                onSetCommentDraft={setCommentDraft}
                onSetEditingNoteId={setEditingNoteId}
                onLoadNotes={loadNotes}
              />
            )}

            {activeTab === "qa" && (
              <QATab
                selectedText={selectedText}
                chatMessages={chatMessages}
                chatInput={chatInput}
                chatLoading={chatLoading}
                chatContext={chatContext}
                readingGoal={readingGoal}
                currentUrl={currentUrl}
                currentTitle={currentTitle}
                hasKey={hasKey}
                colors={colors}
                onShowMessage={showMessage}
                onClearMessage={clearMessage}
                onSetChatInput={setChatInput}
                onSetChatLoading={setChatLoading}
                onSetChatMessages={setChatMessages}
                onSetChatContext={setChatContext}
                onSetReadingGoal={setReadingGoal}
              />
            )}
          </ContentArea>
        </>
      )}

      {/* Config Modal */}
      {showConfig && (
        <ConfigModal
          show={showConfig}
          onClose={() => setShowConfig(false)}
          initialApiKey={configApiKey}
          initialBaseURL={configBaseURL}
          initialModel={configModel}
          onSave={(hasKey) => {
            setHasKey(hasKey)
            if (hasKey) {
              setConfigApiKey("")
              setConfigBaseURL("")
              setConfigModel("gpt-4o-mini")
            }
          }}
        />
      )}

      {/* Ask User Question Modal */}
      {askQuestionParams && (
        <AskUserQuestionModal
          params={askQuestionParams}
          onSubmit={handleAskQuestionSubmit}
          onCancel={handleAskQuestionCancel}
          isDark={isDark}
        />
      )}
    </div>
  )
}

