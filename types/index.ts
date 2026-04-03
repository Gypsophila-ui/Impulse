// Shared type definitions for Impulse

// Re-export existing types from storage
export type { LLMConfig, Note, Highlight } from "~utils/storage"

// Chat types
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatSession {
  id: string
  url: string
  pageTitle: string
  messages: ChatMessage[]
  paperContext: string
  timestamp: number
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
