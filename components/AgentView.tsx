import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, FileText, Slash, Sparkles, Zap } from "lucide-react"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import ReactMarkdown from "react-markdown"
import "katex/dist/katex.min.css"

import type { AgentChatResult, AskUserQuestionParams, AskUserQuestionResult, ChatMessage, ReadingGoal } from "~types"
import { type ToolExecutionContext } from "~utils/agent/agent-tools"
import { borderRadius, shadows, transitions } from "~utils/ui/design-tokens"
import { searchSkills, SKILLS, type Skill } from "~utils/skills"
import { agentChat } from "~utils/agent/llm-client"
import { extractPdfText, isPdfUrl, processPdfBuffer } from "~utils/reading/pdf-extractor"
import { deleteChatSession, saveChatSession } from "~utils/storage/storage"
import { trackEvent } from "~utils/reading/reading-tracker"

import Spinner from "./common/Spinner"
import ReadingGoalSelector from "./common/ReadingGoalSelector"

const agentStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  @keyframes agent-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes agent-pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.35); }
    70%  { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
  }
  @keyframes agent-dot-blink {
    0%, 80%, 100% { opacity: 0.15; transform: scaleY(0.6); }
    40%           { opacity: 1;    transform: scaleY(1); }
  }
  @keyframes agent-scan {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  @keyframes agent-spin {
    to { transform: rotate(360deg); }
  }

  .agent-root {
    font-family: 'DM Sans', system-ui, sans-serif;
    --ink: #3d2914;
    --ink-2: #5c3d1e;
    --ink-3: #8b6914;
    --violet: #efd083;
    --violet-soft: #faf6e7;
    --violet-mid: #d4b65a;
    --emerald: #059669;
    --amber: #8b6914;
    --red: #dc2626;
    --surface: #fef9e7;
    --card: #fffff8;
    --border: #e8dcc8;
    --border-strong: #d4c4a8;
  }

  .agent-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    animation: agent-fade-up 0.4s ease both;
  }
  .agent-header-icon {
    width: 32px; height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, #efd083 0%, #d4b65a 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(239,208,131,0.35);
    flex-shrink: 0;
  }
  .agent-header-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 17px;
    color: var(--ink);
    letter-spacing: -0.3px;
    line-height: 1;
  }
  .agent-header-badge {
    margin-left: auto;
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--violet);
    background: var(--violet-soft);
    border: 1px solid var(--violet-mid);
    border-radius: 4px;
    padding: 2px 7px;
  }

  /* Status bar */
  .agent-status-bar {
    border-radius: 10px;
    margin-bottom: 12px;
    font-size: 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 13px;
    border: 1px solid transparent;
    animation: agent-fade-up 0.4s ease 0.05s both;
    position: relative;
    overflow: hidden;
  }
  .agent-status-bar.loading {
    background: linear-gradient(90deg, #fef9e7 0%, #fff8dc 100%);
    border-color: var(--violet-mid);
    color: #8b6914;
  }
  .agent-status-bar.error {
    background: #fffbeb;
    border-color: #fcd34d;
    color: var(--amber);
  }
  .agent-status-bar.success {
    background: #f0fdf7;
    border-color: #6ee7b7;
    color: #065f46;
  }
  .agent-status-bar.warning {
    background: #fffbeb;
    border-color: #fcd34d;
    color: var(--amber);
  }
  .agent-scan-line {
    position: absolute; top: 0; left: 0;
    width: 25%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(239,208,131,0.12), transparent);
    animation: agent-scan 1.8s linear infinite;
  }
  .agent-spin-ring {
    width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px;
    border: 2px solid var(--violet-mid);
    border-top-color: var(--violet);
    border-radius: 50%;
    animation: agent-spin 0.75s linear infinite;
  }

  /* Chat area */
  .agent-chat-area {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 160px;
    padding-right: 2px;
    scrollbar-width: thin;
    scrollbar-color: var(--violet-mid) transparent;
  }
  .agent-chat-area::-webkit-scrollbar { width: 4px; }
  .agent-chat-area::-webkit-scrollbar-track { background: transparent; }
  .agent-chat-area::-webkit-scrollbar-thumb { background: var(--violet-mid); border-radius: 4px; }

  /* Empty state */
  .agent-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
    padding: 32px 20px;
    border: 1.5px dashed var(--border-strong);
    border-radius: 14px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 8px,
      rgba(239,208,131,0.025) 8px,
      rgba(239,208,131,0.025) 9px
    );
    animation: agent-fade-up 0.5s ease 0.1s both;
  }
  .agent-empty-icon-wrap {
    width: 52px; height: 52px; border-radius: 16px;
    background: linear-gradient(135deg, #efd083 0%, #d4b65a 100%);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 14px;
    box-shadow: 0 4px 16px rgba(239,208,131,0.3);
    animation: agent-pulse-ring 2.5s ease infinite;
  }
  .agent-empty-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 15px;
    color: var(--ink);
    margin-bottom: 6px;
    letter-spacing: -0.2px;
  }
  .agent-empty-sub {
    font-size: 12px;
    color: var(--ink-3);
    line-height: 1.55;
    max-width: 200px;
  }
  .agent-empty-hint {
    margin-top: 10px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--violet);
    background: var(--violet-soft);
    border: 1px solid var(--violet-mid);
    border-radius: 5px;
    padding: 3px 9px;
    letter-spacing: 0.5px;
  }

  /* Bubbles */
  .agent-bubble-row {
    display: flex;
    animation: agent-fade-up 0.3s ease both;
  }
  .agent-bubble-row.user { justify-content: flex-end; }
  .agent-bubble-row.assistant { justify-content: flex-start; }

  .agent-bubble {
    max-width: 86%;
    padding: 10px 14px;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
  }
  .agent-bubble.user {
    background: linear-gradient(135deg, #efd083 0%, #d4b65a 100%);
    color: #fff;
    border-radius: 16px 16px 4px 16px;
    box-shadow: 0 2px 10px rgba(239,208,131,0.3);
  }
  .agent-bubble.assistant {
    background: var(--card);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 4px 16px 16px 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }

  /* Typing indicator */
  .agent-typing {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px 16px 16px 16px;
    font-size: 12.5px;
    color: var(--ink-2);
    font-family: 'DM Mono', monospace;
    animation: agent-fade-up 0.3s ease both;
  }
  .agent-typing-dots {
    display: flex; gap: 3px; align-items: center;
  }
  .agent-typing-dot {
    width: 4px; height: 14px;
    background: var(--violet);
    border-radius: 2px;
    animation: agent-dot-blink 1.2s ease infinite;
  }
  .agent-typing-dot:nth-child(1) { animation-delay: 0s; }
  .agent-typing-dot:nth-child(2) { animation-delay: 0.18s; }
  .agent-typing-dot:nth-child(3) { animation-delay: 0.36s; }

  /* Tool calls */
  .agent-tool-calls {
    padding: 10px 13px;
    background: #f0fdf7;
    border: 1px solid #6ee7b7;
    border-radius: 10px;
    font-size: 11px;
    color: #065f46;
    animation: agent-fade-up 0.3s ease both;
  }
  .agent-tool-calls-title {
    font-family: 'DM Mono', monospace;
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 6px;
    color: #059669;
  }
  .agent-tool-call-item {
    display: flex; align-items: center; gap: 6px;
    padding: 2px 0;
  }
  .agent-tool-call-name {
    font-family: 'DM Mono', monospace;
    font-weight: 500;
  }

  /* Input row */
  .agent-input-row {
    display: flex; gap: 8px; position: relative;
    animation: agent-fade-up 0.4s ease 0.15s both;
  }
  .agent-input {
    flex: 1;
    padding: 11px 14px;
    font-size: 13px;
    font-family: 'DM Sans', system-ui, sans-serif;
    border: 1.5px solid var(--border);
    border-radius: 12px;
    outline: none;
    background: var(--card);
    color: var(--ink);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .agent-input:focus {
    border-color: var(--violet);
    box-shadow: 0 0 0 3px rgba(239,208,131,0.12);
  }
  .agent-input::placeholder { color: var(--ink-3); }
  .agent-send-btn {
    padding: 11px 16px;
    border-radius: 12px;
    border: none;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .agent-send-btn.active {
    background: linear-gradient(135deg, #efd083 0%, #d4b65a 100%);
    color: #fff;
    box-shadow: 0 2px 10px rgba(239,208,131,0.35);
  }
  .agent-send-btn.active:hover {
    box-shadow: 0 4px 16px rgba(239,208,131,0.5);
    transform: translateY(-1px);
  }
  .agent-send-btn.disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }
  .agent-clear-btn {
    margin-top: 8px;
    background: none; border: none;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.5px;
    color: #ef4444;
    cursor: pointer;
    text-align: center;
    width: 100%;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.15s;
    text-transform: uppercase;
  }
  .agent-clear-btn:hover { opacity: 1; }

  /* Skill menu */
  .agent-skill-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0; right: 52px;
    background: var(--card);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    box-shadow: 0 8px 28px rgba(239,208,131,0.18);
    z-index: 100;
    overflow: hidden;
    max-height: 280px;
    animation: agent-fade-up 0.2s ease both;
  }
  .agent-skill-menu-header {
    padding: 7px 12px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--ink-3);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 5px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .agent-skill-item {
    padding: 9px 13px;
    cursor: pointer;
    display: flex; align-items: center; gap: 10px;
    border-left: 3px solid transparent;
    transition: background 0.12s, border-color 0.12s;
  }
  .agent-skill-item:hover, .agent-skill-item.selected {
    background: var(--violet-soft);
    border-left-color: var(--violet);
  }
  .agent-skill-trigger {
    font-family: 'DM Mono', monospace;
    font-size: 10.5px;
    font-weight: 500;
    color: var(--violet);
    min-width: 72px;
  }
  .agent-skill-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink);
    min-width: 56px;
  }
  .agent-skill-desc {
    font-size: 11px;
    color: var(--ink-3);
    flex: 1;
  }

  /* Markdown in assistant bubbles */
  .agent-md p, .agent-md span[style] { display: block; margin-bottom: 4px; }
  .agent-md code {
    background: rgba(239,208,131,0.08);
    border: 1px solid rgba(239,208,131,0.15);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: 'DM Mono', monospace;
    font-size: 0.88em;
    color: #8b6914;
  }
  .agent-md ul, .agent-md ol { margin: 4px 0; padding-left: 18px; }
  .agent-md li { margin-bottom: 2px; }
  .agent-md h1, .agent-md h2, .agent-md h3 {
    font-family: 'DM Serif Display', Georgia, serif;
    margin: 8px 0 3px;
    color: var(--ink);
  }
  .agent-md h1 { font-size: 16px; }
  .agent-md h2 { font-size: 14px; }
  .agent-md h3 { font-size: 13px; }
  .agent-md table {
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 12px;
    width: 100%;
  }
  .agent-md th, .agent-md td {
    border: 1px solid var(--border-strong);
    padding: 6px 10px;
    text-align: left;
  }
  .agent-md th {
    background: var(--violet-soft);
    font-weight: 600;
    font-size: 11.5px;
  }
  .agent-md td {
    background: var(--card);
  }
  .agent-md thead { border-bottom: 2px solid var(--violet-mid); }
`

const MdText: React.FC<{ children: string }> = ({ children }) => (
  <div className="agent-md">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span style={{ display: "block", marginBottom: 4 }}>{children}</span>,
        code: ({ children }) => <code>{children}</code>,
        ul: ({ children }) => <ul>{children}</ul>,
        ol: ({ children }) => <ol>{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <h1>{children}</h1>,
        h2: ({ children }) => <h2>{children}</h2>,
        h3: ({ children }) => <h3>{children}</h3>,
        table: ({ children }) => <table>{children}</table>,
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => <td>{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
)

interface AgentViewProps {
  selectedText: string
  chatMessages: ChatMessage[]
  chatInput: string
  chatLoading: boolean
  chatContext: string
  agentStatus: string | null
  lastToolCalls: AgentChatResult["toolCallsExecuted"]
  chatSummary: string | undefined
  readingGoal: ReadingGoal
  currentUrl: string
  currentTitle: string
  currentTabId: number | null
  hasKey: boolean
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
    sectionBg: string
    headingText: string
    inputBg: string
  }
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onClearMessage: () => void
  onSetChatInput: (input: string) => void
  onSetChatLoading: (loading: boolean) => void
  onSetChatMessages: (messages: ChatMessage[]) => void
  onSetChatContext: (context: string) => void
  onSetAgentStatus: (status: string | null) => void
  onSetLastToolCalls: (calls: AgentChatResult["toolCallsExecuted"]) => void
  onSetChatSummary: (summary: string | undefined) => void
  onSetReadingGoal: (goal: ReadingGoal) => void
  onAskUserQuestion: (params: AskUserQuestionParams) => Promise<AskUserQuestionResult>
  onScrollChange?: (scrolled: boolean) => void
}

const AgentView: React.FC<AgentViewProps> = ({
  selectedText,
  chatMessages,
  chatInput,
  chatLoading,
  chatContext,
  agentStatus,
  lastToolCalls,
  chatSummary,
  readingGoal,
  currentUrl,
  currentTitle,
  currentTabId,
  hasKey,
  colors,
  onShowMessage,
  onClearMessage,
  onSetChatInput,
  onSetChatLoading,
  onSetChatMessages,
  onSetChatContext,
  onSetAgentStatus,
  onSetLastToolCalls,
  onSetChatSummary,
  onSetReadingGoal,
  onAskUserQuestion,
  onScrollChange
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoSendRef = useRef(false)

  // Skill slash-command menu state
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [skillQuery, setSkillQuery] = useState("")
  const [skillResults, setSkillResults] = useState<Skill[]>([])
  const [skillIndex, setSkillIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const openSkillMenu = useCallback((query: string) => {
    const results = searchSkills(query)
    setSkillResults(results)
    setSkillIndex(0)
    setSkillMenuOpen(results.length > 0)
    setSkillQuery(query)
  }, [])

  const closeSkillMenu = useCallback(() => {
    setSkillMenuOpen(false)
    setSkillQuery("")
    setSkillResults([])
    setSkillIndex(0)
  }, [])

  const applySkill = useCallback((skill: Skill) => {
    onSetChatInput(`/${skill.trigger} `)
    closeSkillMenu()
    // Focus input after selection
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [onSetChatInput, closeSkillMenu])

  const resolveSkillInput = useCallback((input: string): string => {
    const trimmed = input.trim()
    if (!trimmed.startsWith("/")) return trimmed
    const parts = trimmed.split(/\s+/)
    const trigger = parts[0].slice(1).toLowerCase()
    const skill = SKILLS.find((s) => s.trigger === trigger)
    if (!skill) return trimmed
    const extra = parts.slice(1).join(" ")
    return extra ? `${skill.prompt}\n\n${extra}` : skill.prompt
  }, [])

  const handleInputChange = useCallback((value: string) => {
    onSetChatInput(value)
    if (value.startsWith("/")) {
      openSkillMenu(value.slice(1))
    } else {
      closeSkillMenu()
    }
  }, [onSetChatInput, openSkillMenu, closeSkillMenu])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (skillMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSkillIndex((i) => Math.min(i + 1, skillResults.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSkillIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (skillResults[skillIndex]) applySkill(skillResults[skillIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeSkillMenu()
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSendChat()
    }
  }, [skillMenuOpen, skillResults, skillIndex, applySkill, closeSkillMenu])

  // PDF auto-extraction state
  const [pdfExtracting, setPdfExtracting] = useState(false)
  const [pdfExtractError, setPdfExtractError] = useState<string | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [pdfTruncated, setPdfTruncated] = useState(false)
  // Track which URL we've already extracted so we don't re-extract on re-renders
  const extractedUrlRef = useRef<string>("")

  // Auto-extract PDF text when AgentView mounts or URL changes
  useEffect(() => {
    if (!currentUrl || !isPdfUrl(currentUrl)) return
    // Already have context (manually set or previously extracted)
    if (chatContext && extractedUrlRef.current === currentUrl) return
    // Already extracted this URL
    if (extractedUrlRef.current === currentUrl) return

    const run = async () => {
      setPdfExtracting(true)
      setPdfExtractError(null)
      extractedUrlRef.current = currentUrl

      try {
        const result = await extractPdfText(currentUrl)
        if (result.error) {
          setPdfExtractError(result.error)
          // 即使提取失败，也设置一个空的上下文，避免阻塞渲染
          onSetChatContext("")
        } else if (result.text) {
          onSetChatContext(result.text)
          setPdfPageCount(result.pageCount)
          setPdfTruncated(result.truncated)
        }
      } catch (e: any) {
        // 捕获任何未预期的错误
        setPdfExtractError(`PDF 提取异常: ${e?.message ?? String(e)}`)
        onSetChatContext("")
      } finally {
        setPdfExtracting(false)
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl])

  // Sync selectedText as fallback context when no PDF context exists
  useEffect(() => {
    if (!chatContext && selectedText.trim() && !isPdfUrl(currentUrl)) {
      onSetChatContext(selectedText)
    }
  }, [selectedText])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !onScrollChange) return

    const handleScroll = () => {
      onScrollChange(container.scrollTop > 10)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [onScrollChange])

  const handleSendChat = async (overrideInput?: string) => {
    const rawInput = (overrideInput ?? chatInput).trim()
    if (!rawInput || chatLoading) return
    const input = resolveSkillInput(rawInput)

    if (!hasKey) {
      onShowMessage(
        <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured</>, "warning"
      )
      return
    }

    // Display message keeps original /skill form; API version uses resolved prompt
    const userMessage: ChatMessage = { role: "user", content: rawInput }
    const apiUserMessage: ChatMessage = { role: "user", content: input }
    const displayMessages = [...chatMessages, userMessage]
    const apiMessages = [...chatMessages, apiUserMessage]
    onSetChatMessages(displayMessages)
    onSetChatInput("")
    onSetChatLoading(true)
    onSetAgentStatus(null)
    onSetLastToolCalls([])

    try {
      const context = chatContext || selectedText

      // Fetch reading history for agent context (sync, safe — returns null if DB not ready)
      const { getSafeReadingSummary, getSafeReadingStatsForUrl } = await import("~utils/reading/reading-tracker")
      const readingSummary = getSafeReadingSummary()
      const currentUrlStats = getSafeReadingStatsForUrl(currentUrl)

      const toolContext: ToolExecutionContext = {
        selectedText,
        paperText: chatContext || selectedText,
        currentUrl,
        currentTitle,
        currentTabId,
        askUserQuestion: onAskUserQuestion,
        readingSummary,
        currentUrlStats
      }

      const result: AgentChatResult = await agentChat(
        apiMessages,
        context,
        toolContext,
        (status, phase) => {
          onSetAgentStatus(status)
        },
        chatSummary,
        readingGoal
      )

      if (result.success) {
        const assistantMessage: ChatMessage = { role: "assistant", content: result.message }
        const updatedMessages = [...displayMessages, assistantMessage]
        onSetChatMessages(updatedMessages)
        if (result.newSummary) {
          onSetChatSummary(result.newSummary)
        }
        if (result.toolCallsExecuted) {
          onSetLastToolCalls(result.toolCallsExecuted)
        }
        await saveChatSession(currentUrl, currentTitle, updatedMessages, context, result.newSummary || chatSummary)
        trackEvent("agent_message", { messages_count: updatedMessages.length, tool_calls: result.toolCallsExecuted?.length || 0, goal: readingGoal })
      } else {
        onSetChatMessages([...displayMessages, { role: "assistant", content: `Error: ${result.message}` }])
      }
    } catch (e: any) {
      onSetChatMessages([...displayMessages, { role: "assistant", content: `Error: ${e?.message ?? String(e)}` }])
    } finally {
      onSetChatLoading(false)
      onSetAgentStatus(null)
    }
  }

  const handleClearChat = async () => {
    if (confirm("Clear chat history for this page?")) {
      onSetChatMessages([])
      onSetChatContext("")
      await deleteChatSession(currentUrl)
    }
  }

  const getStartAnalysisPrompt = useCallback((goal: ReadingGoal): string => {
    const prompts: Record<ReadingGoal, string> = {
      understand_method: "请按照「了解方法」的阅读目标分析这篇论文，重点分析方法论和技术路线。",
      find_details: "请按照「寻找实现细节」的阅读目标分析这篇论文，重点分析具体实现和参数设置。",
      evaluate_novelty: "请按照「评估新颖性」的阅读目标分析这篇论文，重点分析创新点和学术贡献。",
      prepare_citation: "请按照「准备引用」的阅读目标分析这篇论文，重点分析关键发现和结论。"
    }
    return prompts[goal]
  }, [])

  return (
    <div className="agent-root" ref={scrollContainerRef} style={{ 
      padding: 16, 
      overflow: "auto", 
      flex: 1, 
      display: "flex", 
      flexDirection: "column",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "#faf9fc",
      color: "#1a1523"
    }}>
      <style>{agentStyles}</style>

      {/* Header */}
      <div className="agent-header">
        <div className="agent-header-icon">
          <Zap size={16} color="#fff" />
        </div>
        <span className="agent-header-title">Agent</span>
      </div>

      <ReadingGoalSelector
        value={readingGoal}
        onChange={onSetReadingGoal}
        colors={colors}
      />

      {/* Context status bar */}
      {pdfExtracting ? (
        <div className="agent-status-bar loading">
          <div className="agent-scan-line" />
          <div className="agent-spin-ring" />
          <span>正在提取 PDF 全文...</span>
        </div>
      ) : pdfExtractError ? (
        <div className="agent-status-bar error">
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{pdfExtractError}</div>
            <div style={{ opacity: 0.75, marginBottom: 8 }}>请在 PDF 中选中文字后，它会自动作为上下文</div>
            {currentUrl?.startsWith('file://') && (
              <div style={{ marginTop: 6 }}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setPdfExtracting(true)
                      setPdfExtractError(null)
                      const arrayBuffer = await file.arrayBuffer()
                      const result = await processPdfBuffer(arrayBuffer)
                      if (result.error) {
                        setPdfExtractError(result.error)
                        onSetChatContext("")
                      } else {
                        onSetChatContext(result.text)
                        setPdfPageCount(result.pageCount)
                        setPdfTruncated(result.truncated)
                        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4 }} /> PDF 上传成功</>, "success")
                        setTimeout(() => onClearMessage(), 2000)
                      }
                    } catch (err: any) {
                      setPdfExtractError(`文件读取失败: ${err?.message ?? String(err)}`)
                      onSetChatContext("")
                    } finally {
                      setPdfExtracting(false)
                    }
                  }}
                  style={{ display: 'none' }}
                  id="pdf-upload-input"
                />
                <label
                  htmlFor="pdf-upload-input"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: 6,
                    color: '#92400e',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FileText size={12} />
                  上传本地 PDF 文件
                </label>
              </div>
            )}
          </div>
        </div>
      ) : chatContext ? (
        <div className="agent-status-bar success" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1, minWidth: 0 }}>
            <FileText size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {isPdfUrl(currentUrl) && pdfPageCount !== null ? (
                <>
                  <span style={{ fontWeight: 600 }}>已加载 PDF 全文</span>
                  {" · "}{pdfPageCount} 页
                  {pdfTruncated && " · 已截取前 60k 字符"}
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600 }}>已设置上下文</span>
                  {" · "}{chatContext.slice(0, 50)}{chatContext.length > 50 ? "…" : ""}
                </>
              )}
            </span>
          </span>
          {!isPdfUrl(currentUrl) && selectedText.trim() && selectedText !== chatContext && (
            <button
              onClick={() => {
                onSetChatContext(selectedText)
                onShowMessage(<><Sparkles size={14} style={{ marginRight: 4 }} /> 上下文已更新</>, "success")
                setTimeout(() => onClearMessage(), 2000)
              }}
              style={{ background: "none", border: "none", color: "#059669", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 4px", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              更新
            </button>
          )}
        </div>
      ) : (
        <div className="agent-status-bar warning">
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>请在 PDF 中选中一段文字，Agent 将以此作为上下文</span>
        </div>
      )}

      {/* Chat messages */}
      <div className="agent-chat-area">
        {chatMessages.length === 0 ? (
          <div className="agent-empty">
            <div className="agent-empty-icon-wrap">
              <Zap size={22} color="#fff" />
            </div>
            <div className="agent-empty-title">准备就绪</div>
            <div className="agent-empty-sub">AI 可以帮你执行复杂任务，理解论文，提取关键信息</div>
            <div className="agent-empty-hint">输入 / 触发技能命令</div>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div key={idx} className={`agent-bubble-row ${msg.role}`} style={{ animationDelay: `${idx * 0.04}s` }}>
              <div className={`agent-bubble ${msg.role}`}>
                {msg.role === "assistant" ? <MdText>{msg.content}</MdText> : msg.content}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <div className="agent-bubble-row assistant">
            <div className="agent-typing">
              <div className="agent-typing-dots">
                <div className="agent-typing-dot" />
                <div className="agent-typing-dot" />
                <div className="agent-typing-dot" />
              </div>
              <span>{agentStatus || "思考中..."}</span>
            </div>
          </div>
        )}

        {lastToolCalls.length > 0 && !chatLoading && (
          <div className="agent-tool-calls">
            <div className="agent-tool-calls-title">已执行工具</div>
            {lastToolCalls.map((tc, idx) => (
              <div key={idx} className="agent-tool-call-item">
                <span style={{ color: tc.result.success ? "#059669" : "#dc2626", fontSize: 12 }}>
                  {tc.result.success ? "✓" : "✗"}
                </span>
                <span className="agent-tool-call-name">{tc.name}</span>
                <span style={{ color: "#6b7280" }}>— {tc.result.message}</span>
              </div>
            ))}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input row */}
      <div className="agent-input-row">
        {skillMenuOpen && (
          <div className="agent-skill-menu">
            <div className="agent-skill-menu-header">
              <Slash size={10} />
              <span>技能命令 · ↑↓ 导航 · Enter 选择 · Esc 关闭</span>
            </div>
            {skillResults.map((skill, i) => (
              <div
                key={skill.trigger}
                className={`agent-skill-item${i === skillIndex ? " selected" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); applySkill(skill) }}
                onMouseEnter={() => setSkillIndex(i)}
              >
                <span className="agent-skill-trigger">/{skill.trigger}</span>
                <span className="agent-skill-label">{skill.label}</span>
                <span className="agent-skill-desc">{skill.description}</span>
              </div>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className="agent-input"
          value={chatInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="让 Agent 帮你完成任务..."
        />
        <button
          className={`agent-send-btn ${chatInput.trim() && !chatLoading ? "active" : "disabled"}`}
          onClick={() => void handleSendChat()}
          disabled={!chatInput.trim() || chatLoading}
        >
          {chatLoading ? <Spinner /> : "发送"}
        </button>
      </div>

      {chatMessages.length > 0 && (
        <button className="agent-clear-btn" onClick={handleClearChat}>
          清除对话记录
        </button>
      )}
    </div>
  )
}

export default AgentView
