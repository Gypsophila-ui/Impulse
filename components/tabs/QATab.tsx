import React, { useRef } from "react"
import { borderRadius } from "~utils/design-tokens"
import { AlertTriangle, Bot, FileText, Sparkles } from "lucide-react"

import type { ChatMessage, ReadingGoal } from "~types"
import { t } from "~utils/i18n"
import { chatWithContext } from "~utils/llm-client"
import { deleteChatSession, saveChatSession } from "~utils/storage"

import Spinner from "../common/Spinner"
import ReadingGoalSelector from "../common/ReadingGoalSelector"

interface QATabProps {
  selectedText: string
  chatMessages: ChatMessage[]
  chatInput: string
  chatLoading: boolean
  chatContext: string
  readingGoal: ReadingGoal
  currentUrl: string
  currentTitle: string
  hasKey: boolean
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
    sectionBg: string
  }
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onClearMessage: () => void
  onSetChatInput: (input: string) => void
  onSetChatLoading: (loading: boolean) => void
  onSetChatMessages: (messages: ChatMessage[]) => void
  onSetChatContext: (context: string) => void
  onSetReadingGoal: (goal: ReadingGoal) => void
}

const QATab: React.FC<QATabProps> = ({
  selectedText,
  chatMessages,
  chatInput,
  chatLoading,
  chatContext,
  readingGoal,
  currentUrl,
  currentTitle,
  hasKey,
  colors,
  onShowMessage,
  onClearMessage,
  onSetChatInput,
  onSetChatLoading,
  onSetChatMessages,
  onSetChatContext,
  onSetReadingGoal
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

    try {
      const context = chatContext || selectedText
      const reply = await chatWithContext(newMessages, context, readingGoal)
      const updatedMessages: ChatMessage[] = [...newMessages, { role: "assistant", content: reply }]
      onSetChatMessages(updatedMessages)
      await saveChatSession(currentUrl, currentTitle, updatedMessages, context)
    } catch (e: any) {
      const errorMessages: ChatMessage[] = [...newMessages, { role: "assistant", content: `Error: ${e?.message ?? String(e)}` }]
      onSetChatMessages(errorMessages)
    } finally {
      onSetChatLoading(false)
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
    <div style={{ animation: "fadeIn 0.4s ease", display: "flex", flexDirection: "column", height: "100%" }}>
      <ReadingGoalSelector
        value={readingGoal}
        onChange={onSetReadingGoal}
        colors={colors}
      />

      <div
        style={{
          padding: 10,
          background: chatContext ? "#f0f9ff" : "#fef3c7",
          border: `1px solid ${chatContext ? "#7dd3fc" : "#fcd34d"}`,
          borderRadius: borderRadius.sm,
          marginBottom: 12,
          fontSize: 12,
          color: chatContext ? "#0369a1" : "#92400e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {chatContext
            ? <><FileText size={12} /> Context: {chatContext.slice(0, 80)}{chatContext.length > 80 ? "..." : ""}</>
            : <><AlertTriangle size={12} /> Select text from PDF and refresh to set context</>}
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
              color: "#0ea5e9",
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
          flex: 1,
          overflowY: "auto",
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 200,
          maxHeight: 400,
          padding: 4
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
            <div style={{ fontSize: 32, marginBottom: 8 }}><Bot size={32} color="#0ea5e9" /></div>
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
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
                      : colors.sectionBg,
                  color: msg.role === "user" ? "#fff" : "#374151",
                  fontSize: 13,
                  lineHeight: "20px",
                  whiteSpace: "pre-wrap",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
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
                borderRadius: "14px 14px 14px 4px",
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
                  border: "2px solid #d1d5db",
                  borderTop: "2px solid #0ea5e9",
                  borderRadius: borderRadius.full,
                  animation: "spin 0.8s linear infinite"
                }}
              />
              Thinking...
            </div>
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
          placeholder="Ask a question about the paper..."
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: 13,
            border: `2px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.2s ease"
          }}
          onFocus={(e) => (e.target.style.borderColor = "#0ea5e9")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
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
                ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
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

export default QATab
