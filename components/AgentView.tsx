import React, { useRef } from "react"
import { AlertTriangle, Bot, FileText, Sparkles, Zap } from "lucide-react"

import type { AgentChatResult, AskUserQuestionParams, AskUserQuestionResult, ChatMessage, ReadingGoal } from "~types"
import { type ToolExecutionContext } from "~utils/agent-tools"
import { borderRadius, shadows, transitions } from "~utils/design-tokens"
import { agentChat } from "~utils/llm-client"
import { deleteChatSession, saveChatSession } from "~utils/storage"

import Spinner from "./common/Spinner"
import ReadingGoalSelector from "./common/ReadingGoalSelector"

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

      <div
        style={{
          padding: 10,
          background: chatContext ? "#f0fdf4" : "#fef3c7",
          border: `1px solid ${chatContext ? "#86efac" : "#fcd34d"}`,
          borderRadius: borderRadius.sm,
          marginBottom: 12,
          fontSize: 12,
          color: chatContext ? "#166534" : "#92400e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {chatContext
            ? <><FileText size={12} /> Context: {chatContext.slice(0, 60)}{chatContext.length > 60 ? "..." : ""}</>
            : <><AlertTriangle size={12} /> Select text from PDF to set context</>}
        </span>
        {chatContext && (
          <button
            onClick={() => {
              if (selectedText.trim()) {
                onSetChatContext(selectedText)
                onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Context updated</>, "success")
                setTimeout(() => onClearMessage(), 2000)
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "#22c55e",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              padding: 4,
              whiteSpace: "nowrap"
            }}
          >
            Update
          </button>
        )}
      </div>

      <div
        style={{
          padding: "8px 12px",
          background: "#f5f3ff",
          border: "1px solid #c4b5fd",
          borderRadius: borderRadius.sm,
          marginBottom: 12,
          fontSize: 11,
          color: "#5b21b6",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <Bot size={14} />
        <span>Agent 模式 - AI 可以执行工具操作（高亮、笔记、搜索等）</span>
      </div>

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
