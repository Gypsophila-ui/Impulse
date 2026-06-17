// Shared type definitions for Impulse

// Re-export existing types from storage
export type { LLMConfig, Note, Highlight } from "~utils/storage/storage"

// Re-export reading history types from SQLite db layer
export type {
  ReadingSession,
  ReadingEvent,
  DailyStats,
  ReadingSummary,
  ReadingSummaryBrief,
  ReadingEventType
} from "~utils/storage/db"

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

// Ask User Question types
export interface AskUserQuestionOption {
  label: string
  description?: string
}

export interface AskUserQuestionParams {
  question: string
  options: AskUserQuestionOption[]
  allowCustomInput?: boolean
  placeholder?: string
}

export interface AskUserQuestionResult {
  selected: string
  isCustomInput?: boolean
}

export type AskUserQuestionCallback = (params: AskUserQuestionParams) => Promise<AskUserQuestionResult>

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

// Skill — slash-command shortcut for Agent chat input
export interface Skill {
  trigger: string
  label: string
  description: string
  prompt: string
}

// Reading Goal - 阅读目标设定
export type ReadingGoal = "understand_method" | "find_details" | "evaluate_novelty" | "prepare_citation"

export const READING_GOAL_CONFIG: Record<ReadingGoal, { labelKey: string; descriptionKey: string }> = {
  understand_method: {
    labelKey: "readingGoal.understandMethod",
    descriptionKey: "readingGoal.understandMethodDesc"
  },
  find_details: {
    labelKey: "readingGoal.findDetails",
    descriptionKey: "readingGoal.findDetailsDesc"
  },
  evaluate_novelty: {
    labelKey: "readingGoal.evaluateNovelty",
    descriptionKey: "readingGoal.evaluateNoveltyDesc"
  },
  prepare_citation: {
    labelKey: "readingGoal.prepareCitation",
    descriptionKey: "readingGoal.prepareCitationDesc"
  }
}

// ─── Paper Comparison Types ────────────────────────────────────────────────

/**
 * A lightweight snapshot of a paper collected from storage.
 * Used by list_candidate_papers and get_paper_summary.
 */
export interface PaperSnapshot {
  url: string
  title: string
  authors: string[]
  year: string
  journal: string
  doi: string
  /** User's notes for this paper (max 3, truncated) */
  notes: Array<{ comment: string; selectedText: string }>
  /** Key highlight phrases for this paper */
  highlights: string[]
  /** First 800 chars of the paper's chat context (abstract / intro) */
  contextPreview: string
  lastVisited: number
  /** Reading history from SQLite (available when DB is initialized) */
  sessionCount?: number
  totalDurationSeconds?: number
  eventCount?: number
  topEventTypes?: Array<{ type: string; count: number }>
  firstVisitTime?: number
}

export type ComparisonDimension =
  | "contribution"
  | "method"
  | "experiment"
  | "limitation"
  | "novelty"
  | "practical_value"

export const COMPARISON_DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  contribution: "核心贡献",
  method: "方法",
  experiment: "实验",
  limitation: "局限性",
  novelty: "新颖性",
  practical_value: "实用价值"
}

export interface ComparisonRow {
  dimension: ComparisonDimension | string
  /** key = paper url, value = summary text for that dimension */
  values: Record<string, string>
  /** one-sentence contrast across papers */
  difference: string
}

export interface ComparisonResult {
  papers: PaperSnapshot[]
  dimensions: Array<ComparisonDimension | string>
  rows: ComparisonRow[]
  summary: string
  recommendation?: string
  generatedAt: number
}

export interface SavedComparison {
  id: string
  title: string
  paperUrls: string[]
  paperTitles: string[]
  result: ComparisonResult
  timestamp: number
}
