/**
 * Shared token estimation and prompt budget management.
 *
 * Single source of truth for:
 * - `estimateTokens` (CJK ≈ 1 token / 2.5 chars, others ≈ 1 token / 4 chars)
 * - Global prompt budget constants (tunable, kept at top of file)
 * - Structured truncation markers (replace blind slicing)
 */

const CHINESE_CHAR = /[一-龥぀-ゟ゠-ヿ]/

/**
 * Conservative token estimate.
 * CJK characters ≈ 1 token per 2.5 chars; others ≈ 1 token per 4 chars.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let tokens = 0
  for (const char of text) {
    if (/\s/.test(char)) continue
    if (CHINESE_CHAR.test(char)) {
      tokens += 0.4 // 1 / 2.5
    } else {
      tokens += 0.25 // 1 / 4
    }
  }
  return Math.ceil(tokens)
}

/**
 * Global token budget for assembling an LLM prompt in agentChat.
 * Sections are filled in priority order; overflow is dropped by priority.
 */
export const TOKEN_BUDGET = {
  /** Total context budget for the assembled prompt (system + history). */
  total: 16000,
  /** Fixed system instructions (persona, tool docs, rules). */
  systemFixed: 2500,
  /** Retrieved paper chunks (incl. neighbors + section summaries). */
  chunks: 6000,
  /** Conversation history (after tiered compression). */
  history: 4000,
  /** Tool results fed back into the loop, per result. */
  toolResults: 2000
} as const

export type TokenBudgetSection = keyof typeof TOKEN_BUDGET

export interface TokenBudgetReport {
  used: Partial<Record<TokenBudgetSection, number>>
  /** Sections that were truncated/dropped during assembly. */
  truncated: string[]
}

export function createBudgetReport(): TokenBudgetReport {
  return { used: {}, truncated: [] }
}

/**
 * Truncate text to `maxChars` characters with a structured marker so the
 * model knows content was cut instead of silently losing it.
 */
export function truncateWithMarker(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const kept = text.slice(0, maxChars)
  return `${kept}\n[已截断: 原始 ${text.length} 字符, 保留前 ${maxChars}]`
}
