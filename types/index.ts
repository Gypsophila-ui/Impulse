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
  /** Token usage / truncation report for the assembled prompt (context budgeting) */
  budgetReport?: { used: Record<string, number>; truncated: string[] }
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
  /** Legacy full-text context. Kept for backward compatibility; new sessions leave this empty. */
  paperContext: string
  /** Document hash linking to a structured PaperDocument */
  docHash?: string
  /** Snapshot of the last retrieved context for this session */
  retrievedContext?: RetrievedContext
  timestamp: number
  summary?: string
  /** Per-turn context provenance snapshots (page-index citation trace) */
  turns?: AgentTurnSnapshot[]
}

/**
 * Lightweight per-turn provenance record: which chunks (and page ranges)
 * were actually retrieved for a turn, so page-index citations in the reply
 * can be verified.
 */
export interface AgentTurnSnapshot {
  turnId: string
  query: string
  chunkIds: string[]
  pageRanges: Array<{ start: number; end: number }>
  /** Chunk indexes actually injected into the prompt */
  chunkIndexes: number[]
  tokenBudget?: { used: Record<string, number>; truncated: string[] }
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

// Skill — slash-command shortcut for Agent chat input
export type SkillPermission = "scripting" | "activeTab" | "storage" | "sidePanel" | "contextMenus"

export interface Skill {
  trigger: string
  label: string
  description: string
  prompt: string

  // Rich metadata for discovery and Agent system prompt
  detailedDescription?: string
  examples?: string[]
  inputExpectations?: string
  outputFormat?: string
  suggestedReadingGoal?: ReadingGoal
  tags?: string[]
  category?: string
  toolsUsed?: string[]

  // Runtime permission requirements
  permissions?: SkillPermission[]
  requiresHostPermission?: boolean
}

export interface SkillPermissionNotice {
  skillName: string
  permissions: string[]
  origins: string[]
  message: string
}

export type ShowSkillPermissionNoticeCallback = (notice: SkillPermissionNotice) => Promise<void>

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

// ─── Paper Context Types ───────────────────────────────────────────────────

/**
 * A single chunk of a paper, used as the minimum retrievable unit.
 */
export interface PaperChunk {
  /** Global unique id: `<docHash>_<index>` */
  id: string
  /** Sequential index within the document, 0-based */
  index: number
  /** Section path, e.g. ["Abstract", "1 Introduction", "1.1 Motivation"] */
  sectionPath: string[]
  /** Start page (1-based, inclusive) */
  startPage: number
  /** End page (1-based, inclusive) */
  endPage: number
  /** Character range in the full document text */
  charRange: { start: number; end: number }
  /** Full chunk text. Omitted in the lightweight index record. */
  text?: string
  /** Normalized text (headers/footers removed) used for retrieval */
  normalizedText?: string
  /** Character count */
  charCount: number
  /** Conservative token estimate (CJK / 2.5, others / 4) */
  estimatedTokens: number
  /** Extracted keywords (deduped, lowercased, stopwords removed) */
  keywords: string[]
  /** Term frequency for keyword weighting */
  termFrequency?: Record<string, number>
  /** Special block flags */
  isTable?: boolean
  isFormula?: boolean
  isHeaderFooter?: boolean
  /** Whether the chunk boundary cut through original content */
  truncatedBoundary?: boolean
  /** Reserved for future embedding support */
  embedding?: number[]
}

/**
 * Summary node for a section or the whole paper.
 */
export interface PaperSectionSummary {
  title: string
  text: string
  sourceChunkIndexes: number[]
  pageRange: { start: number; end: number }
  status: "pending" | "done" | "failed"
  error?: string
  estimatedTokens: number
  generatedAt?: number
}

/**
 * A structured paper document built from PDF extraction + chunking.
 */
export interface PaperDocument {
  url: string
  title: string
  docHash: string
  pageCount: number
  truncated: boolean
  chunks: PaperChunk[]
  sectionSummaries: Record<string, PaperSectionSummary>
  fullSummary?: PaperSectionSummary
  keywords: string[]
  version: number
  createdAt: number
  updatedAt: number
}

/** Lightweight persistence record: same shape as PaperDocument but chunk.text omitted */
export type PaperContextRecord = Omit<PaperDocument, "chunks"> & {
  chunks: Array<Omit<PaperChunk, "text">>
}

/**
 * Evidence citation returned by the agent for a claim.
 */
export type EvidenceType = "direct" | "inductive" | "inferred"
export type EvidenceConfidence = "high" | "medium" | "low"

export interface Evidence {
  chunkIndex: number
  sectionPath: string[]
  pageRange: { start: number; end: number }
  quote: string
  type: EvidenceType
  confidence: EvidenceConfidence
}

/**
 * Context retrieved for a single user query and injected into the LLM prompt.
 */
export interface RetrievedContext {
  fullSummary: string
  chunks: Array<PaperChunk & { score: number; matchReason?: string }>
  sectionSummaries: PaperSectionSummary[]
  neighborChunks: PaperChunk[]
  meta: {
    totalChunks: number
    retrievedChunks: number
    query: string
    confidence: "high" | "medium" | "low"
    reason?: string
    contextTruncated: boolean
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
  /** paperUrl → page-indexed evidence backing this row's cells (RAG mode) */
  evidence?: Record<string, Evidence[]>
}

export interface ComparisonResult {
  papers: PaperSnapshot[]
  dimensions: Array<ComparisonDimension | string>
  rows: ComparisonRow[]
  summary: string
  recommendation?: string
  generatedAt: number
  /** How the comparison was produced: retrieved evidence or snapshot fallback */
  mode?: "rag_evidence" | "snapshot_fallback"
  /** Retrieval provenance: which chunks were used per paper */
  trace?: { query: string; perPaperChunkIds: Record<string, string[]> }
}

export interface SavedComparison {
  id: string
  title: string
  paperUrls: string[]
  paperTitles: string[]
  result: ComparisonResult
  timestamp: number
}
