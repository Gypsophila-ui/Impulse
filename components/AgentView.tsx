import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, FileText, Sparkles, Zap } from "lucide-react"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import ReactMarkdown from "react-markdown"
import "katex/dist/katex.min.css"

import type { AgentChatResult, AskUserQuestionParams, AskUserQuestionResult, ChatMessage, ReadingGoal } from "~types"
import { type ToolExecutionContext } from "~utils/agent-tools"
import { borderRadius, shadows, transitions } from "~utils/design-tokens"
import { agentChat } from "~utils/llm-client"
import { extractPdfText, isPdfUrl } from "~utils/pdf-extractor"
import { deleteChatSession, saveChatSession } from "~utils/storage"

import Spinner from "./common/Spinner"
import ReadingGoalSelector from "./common/ReadingGoalSelector"

// Markdown renderer with LaTeX support via react-markdown + remark-math + rehype-katex
const MdText: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      p: ({ children }) => <span style={{ display: "block", marginBottom: 4 }}>{children}</span>,
      code: ({ children }) => (
        <code style={{ background: "rgba(0,0,0,0.08)", borderRadius: 3, padding: "1px 4px", fontFamily: "monospace", fontSize: "0.9em" }}>
          {children}
        </code>
      ),
      ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: 16 }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
      h1: ({ children }) => <div style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 15 }}>{children}</div>,
      h2: ({ children }) => <div style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 14 }}>{children}</div>,
      h3: ({ children }) => <div style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 13 }}>{children}</div>,
    }}
  >
    {children}
  </ReactMarkdown>
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
  onAskUserQuestion
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null)

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
        } else if (result.text) {
          onSetChatContext(result.text)
          setPdfPageCount(result.pageCount)
          setPdfTruncated(result.truncated)
        }
      } finally {
        setPdfExtracting(false)
      }
    }

    void run()
  }, [currentUrl])

  // Sync selectedText as fallback context when no PDF context exists
  useEffect(() => {
    if (!chatContext && selectedText.trim() && !isPdfUrl(currentUrl)) {
      onSetChatContext(selectedText)
    }
  }, [selectedText])

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return

    if (!hasKey) {
      onShowMessage(
        <><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> API Key Not Configured</>, "warning"
      )
      return
    }

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() }
    const newMessages = [...chatMessages, userMessage]
    onSetChatMessages(newMessages)
    onSetChatInput("")
    onSetChatLoading(true)
    onSetAgentStatus(null)
    onSetLastToolCalls([])

    try {
      const context = chatContext || selectedText

      const toolContext: ToolExecutionContext = {
        selectedText,
        paperText: chatContext || selectedText,
        currentUrl,
        currentTitle,
        currentTabId,
        askUserQuestion: onAskUserQuestion
      }

      const result: AgentChatResult = await agentChat(
        newMessages,
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
        const updatedMessages = [...newMessages, assistantMessage]
        onSetChatMessages(updatedMessages)
        if (result.newSummary) {
          onSetChatSummary(result.newSummary)
        }
        if (result.toolCallsExecuted) {
          onSetLastToolCalls(result.toolCallsExecuted)
        }
        await saveChatSession(currentUrl, currentTitle, updatedMessages, context, result.newSummary || chatSummary)
      } else {
        onSetChatMessages([...newMessages, { role: "assistant", content: `Error: ${result.message}` }])
      }
    } catch (e: any) {
      onSetChatMessages([...newMessages, { role: "assistant", content: `Error: ${e?.message ?? String(e)}` }])
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

  return (
    <div style={{ 
      padding: 16, 
      overflow: "auto", 
      flex: 1, 
      display: "flex", 
      flexDirection: "column",
      animation: "fadeIn 0.4s ease"
    }}>
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
        <Zap size={20} color="#8b5cf6" />
        <span>Agent Mode</span>
      </div>

      <ReadingGoalSelector
        value={readingGoal}
        onChange={onSetReadingGoal}
        colors={colors}
      />

      {/* PDF / Context status bar */}
      {pdfExtracting ? (
        <div
          style={{
            padding: "10px 12px",
            background: "#f5f3ff",
            border: "1px solid #c4b5fd",
            borderRadius: borderRadius.sm,
            marginBottom: 12,
            fontSize: 12,
            color: "#5b21b6",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              border: "2px solid #c4b5fd",
              borderTop: "2px solid #8b5cf6",
              borderRadius: borderRadius.full,
              animation: "spin 0.8s linear infinite",
              flexShrink: 0
            }}
          />
          正在提取 PDF 全文...
        </div>
      ) : pdfExtractError ? (
        <div
          style={{
            padding: "10px 12px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: borderRadius.sm,
            marginBottom: 12,
            fontSize: 12,
            color: "#92400e",
            display: "flex",
            alignItems: "flex-start",
            gap: 6
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{pdfExtractError}</div>
            <div style={{ opacity: 0.8 }}>请在 PDF 中选中文字后，它会自动作为上下文</div>
          </div>
        </div>
      ) : chatContext ? (
        <div
          style={{
            padding: "10px 12px",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: borderRadius.sm,
            marginBottom: 12,
            fontSize: 12,
            color: "#166534",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8
          }}
        >
          <span style={{ display: "flex", alignItems: "flex-start", gap: 4, flex: 1, minWidth: 0 }}>
            <FileText size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {isPdfUrl(currentUrl) && pdfPageCount !== null ? (
                <>
                  <span style={{ fontWeight: 600 }}>已加载 PDF 全文</span>
                  {" · "}
                  {pdfPageCount} 页
                  {pdfTruncated && " · 已截取前 60k 字符"}
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600 }}>已设置上下文</span>
                  {" · "}
                  {chatContext.slice(0, 50)}{chatContext.length > 50 ? "..." : ""}
                </>
              )}
            </span>
          </span>
          {!isPdfUrl(currentUrl) && selectedText.trim() && selectedText !== chatContext && (
            <button
              onClick={() => {
                onSetChatContext(selectedText)
                onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> 上下文已更新</>, "success")
                setTimeout(() => onClearMessage(), 2000)
              }}
              style={{
                background: "none",
                border: "none",
                color: "#16a34a",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 4px",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              更新
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "10px 12px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: borderRadius.sm,
            marginBottom: 12,
            fontSize: 12,
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>请在 PDF 中选中一段文字，Agent 将以此作为上下文</span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 200
        }}
      >
        {chatMessages.length === 0 ? (
          <div
            style={{
              padding: 20,
              border: `2px dashed ${colors.border}`,
              borderRadius: borderRadius.md,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}><Zap size={32} color="#8b5cf6" /></div>
            <div style={{ fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Agent Mode</div>
            <div>AI 可以帮你执行复杂任务</div>
            <div style={{ fontSize: 11, marginTop: 4, color: "#9ca3af" }}>
              例如：高亮这段话、添加笔记、搜索相关内容...
            </div>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? borderRadius.bubble.user : borderRadius.bubble.assistant,
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                      : colors.sectionBg,
                  color: msg.role === "user" ? "#fff" : "#374151",
                  fontSize: 13,
                  lineHeight: "20px",
                  whiteSpace: "pre-wrap",
                  boxShadow: shadows.sm
                }}
              >
                {msg.role === "assistant" ? (
                  <MdText>{msg.content}</MdText>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {chatLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: borderRadius.bubble.assistant,
                background: colors.sectionBg,
                color: "#6b7280",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid #c4b5fd",
                  borderTop: "2px solid #8b5cf6",
                  borderRadius: borderRadius.full,
                  animation: "spin 0.8s linear infinite"
                }}
              />
              {agentStatus || "Thinking..."}
            </div>
          </div>
        )}
        {lastToolCalls.length > 0 && !chatLoading && (
          <div
            style={{
              padding: "8px 12px",
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: borderRadius.sm,
              fontSize: 11,
              color: "#166534"
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>已执行工具：</div>
            {lastToolCalls.map((tc, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <span style={{ color: tc.result.success ? "#22c55e" : "#ef4444" }}>
                  {tc.result.success ? "✓" : "✗"}
                </span>
                <span style={{ fontWeight: 500 }}>{tc.name}</span>
                <span style={{ color: "#6b7280" }}>- {tc.result.message}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={chatInput}
          onChange={(e) => onSetChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSendChat()
            }
          }}
          placeholder="让 Agent 帮你完成任务..."
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: 13,
            border: `2px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            outline: "none",
            fontFamily: "inherit",
            background: colors.inputBg,
            color: colors.text,
            transition: transitions.normal
          }}
          onFocus={(e) => (e.target.style.borderColor = "#8b5cf6")}
          onBlur={(e) => (e.target.style.borderColor = colors.border)}
        />
        <button
          onClick={() => void handleSendChat()}
          disabled={!chatInput.trim() || chatLoading}
          className="btn-hover"
          style={{
            padding: "10px 16px",
            borderRadius: borderRadius.md,
            background:
              chatInput.trim() && !chatLoading
                ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                : "#cbd5e1",
            color: "#fff",
            border: "none",
            cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: 13
          }}
        >
          {chatLoading ? <Spinner /> : "Send"}
        </button>
      </div>

      {chatMessages.length > 0 && (
        <button
          onClick={handleClearChat}
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
          }}
        >
          Clear Chat History
        </button>
      )}
    </div>
  )
}

export default AgentView
