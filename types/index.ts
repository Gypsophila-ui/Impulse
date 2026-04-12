// Shared type definitions for Impulse

// Re-export existing types from storage
export type { LLMConfig, Note, Highlight } from "~utils/storage"

// Chat types
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// Agent types
export interface ToolCallMessage {
  role: "assistant"
  content: string | null
  tool_calls: Array<{
    id: string
    type: "function"
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface ToolResultMessage {
  role: "tool"
  tool_call_id: string
  content: string
}

export type AgentMessage = ChatMessage | ToolCallMessage | ToolResultMessage

export interface AgentChatResult {
  success: boolean
  message: string
  toolCallsExecuted: Array<{
    name: string
    args: Record<string, unknown>
    result: {
      success: boolean
      message: string
      data?: unknown
    }
  }>
  fallbackToSimpleChat: boolean
  newSummary?: string
}

export interface AgentStatusCallback {
  (status: string, phase: "thinking" | "tool_call" | "complete"): void
}

export interface ChatSession {
  id: string
  url: string
  pageTitle: string
  messages: ChatMessage[]
  paperContext: string
  timestamp: number
  summary?: string
}

// Paper metadata
export interface PaperMetadata {
  title: string
  authors: string[]
  year: string
  journal: string
  doi: string
}

// Theme
export type Theme = "light" | "dark"

// Language
export type Language = "en" | "zh"
