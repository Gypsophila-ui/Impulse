/**
 * Structured paper context management: chunking, section detection, keyword
 * indexing, local retrieval, token budgeting and context formatting.
 *
 * This module is intentionally free of React / Chrome API dependencies so it
 * can be unit tested and later moved to a worker.
 */

import type {
  Evidence,
  EvidenceConfidence,
  EvidenceType,
  PaperChunk,
  PaperContextRecord,
  PaperDocument,
  PaperSectionSummary,
  RetrievedContext
} from "~types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfPageText {
  pageNumber: number
  text: string
  charCount: number
}

export interface SectionMarker {
  pageNumber: number
  charOffset: number
  level: number
  title: string
  sectionPath: string[]
}

export interface SegmentationOptions {
  /** Target tokens per chunk (default 800) */
  targetChunkTokens?: number
  /** Max tokens per chunk (default 1200) */
  maxChunkTokens?: number
  /** Min tokens per chunk (default 100) */
  minChunkTokens?: number
  /** Overlap tokens between adjacent chunks (default 80) */
  overlapTokens?: number
  /** Max chars to extract from the PDF (default 60_000) */
  maxChars?: number
}

export interface RetrievalOptions {
  /** Top-K chunks to retrieve (default 5) */
  topK?: number
  /** Max total tokens for retrieved chunks (default 3500) */
  maxContextTokens?: number
  /** Number of neighbor chunks to include per top chunk (default 1) */
  neighborCount?: number
  /** Boost score for terms appearing in the selected text */
  selectedTextBoost?: number
}

export interface ContextBudgetConfig {
  totalContextWindow: number
  outputTokens: number
  safetyMargin: number
  systemFixedTokens: number
  historyTokens: number
}

export const DEFAULT_CONTEXT_BUDGET: ContextBudgetConfig = {
  totalContextWindow: 8192,
  outputTokens: 2000,
  safetyMargin: 500,
  systemFixedTokens: 1500,
  historyTokens: 2000
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_CHARS = 60_000

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "and", "but", "or", "yet", "so", "if",
  "because", "although", "though", "while", "where", "when", "that",
  "which", "who", "whom", "whose", "what", "this", "these", "those",
  "i", "we", "you", "he", "she", "it", "they", "them", "their", "its",
  "our", "my", "your", "his", "her",
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
  "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会",
  "着", "没有", "看", "好", "自己", "这"
])

const SECTION_PATTERNS = [
  // Numbered headings: "1 Introduction", "3.2 Experiments"
  /^\s*(\d+(?:\.\d+)*)\s+([\p{L}\p{Han}][\p{L}\p{Han}\p{N}\s\-,:;.]+)\s*$/u,
  // "Chapter 1 Introduction"
  /^\s*(Chapter|Section)\s+\d+(?:\.\d+)*\s*[\p{L}\p{Han}]/iu,
  // Roman numerals: "I. Introduction"
  /^\s*(I{1,3}|IV|V[I]{0,3})\.\s+([\p{L}\p{Han}][\p{L}\p{Han}\p{N}\s\-,:;.]+)\s*$/u,
  // Common academic section words (single line, short)
  /^\s*(Abstract|Introduction|Related Work|Background|Methods?|Methodology|Experiments?|Results?|Discussion|Conclusions?|References?|Acknowledgments?|Appendix|摘要|引言|相关工作|背景|方法|实验|结果|讨论|结论|参考文献|致谢|附录)\s*$/iu
]

const CHINESE_CHAR = /[一-龥぀-ゟ゠-ヿ]/

// ─────────────────────────────────────────────────────────────────────────────
// Token estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conservative token estimate.
 * CJK characters ≈ 1 token per 2.5 chars; others ≈ 1 token per 4 chars.
 */
export function estimateTokens(text: string): number {
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
 * Estimate Chinese-weighted char count for sorting/budgeting.
 */
function weightedCharCount(text: string): number {
  let count = 0
  for (const char of text) {
    if (/\s/.test(char)) continue
    count += CHINESE_CHAR.test(char) ? 2.5 : 1
  }
  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Text normalization
// ─────────────────────────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function removeHeaderFooterNoise(text: string): string {
  // Remove lines that are just a number (likely page number) or very short repeated lines
  const lines = text.split("\n")
  const cleaned: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Skip isolated page numbers
    if (/^\d+$/.test(trimmed) && trimmed.length <= 3) continue
    // Skip extremely short lines that appear multiple times (headers/footers)
    if (trimmed.length < 20) {
      if (seen.has(trimmed)) continue
      seen.add(trimmed)
    }
    cleaned.push(line)
  }

  return cleaned.join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// Section detection
// ─────────────────────────────────────────────────────────────────────────────

function looksLikeHeading(line: string): { isHeading: boolean; level: number; title: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 120) return null

  for (const pattern of SECTION_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      // Determine level from numbering depth or known heading pattern
      let level = 0
      let title = trimmed
      if (match[1] && /^\d/.test(match[1])) {
        level = match[1].split(".").length - 1
        title = match[2] || trimmed
      } else if (match[1] && /^(Chapter|Section)$/i.test(match[1])) {
        level = 0
      } else if (match[1] && /^(I{1,3}|IV|V[I]{0,3})$/i.test(match[1])) {
        level = 0
        title = match[2] || trimmed
      } else {
        level = 0
      }
      return { isHeading: true, level, title }
    }
  }

  // Heuristic: all caps or title case short line
  if (trimmed.length < 60 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,5}$/.test(trimmed)) {
    return { isHeading: true, level: 0, title: trimmed }
  }

  return null
}

export function detectSections(pages: PdfPageText[]): SectionMarker[] {
  const markers: SectionMarker[] = []
  let charOffset = 0

  for (const page of pages) {
    const lines = page.text.split("\n")
    for (const line of lines) {
      const heading = looksLikeHeading(line)
      if (heading) {
        markers.push({
          pageNumber: page.pageNumber,
          charOffset,
          level: heading.level,
          title: heading.title,
          sectionPath: [] // filled later
        })
      }
      charOffset += line.length + 1 // +1 for newline
    }
  }

  // Build section paths from markers
  const pathStack: string[] = []
  for (const marker of markers) {
    while (pathStack.length > marker.level) {
      pathStack.pop()
    }
    pathStack.push(marker.title)
    marker.sectionPath = [...pathStack]
  }

  return markers
}

function findSectionForOffset(offset: number, markers: SectionMarker[]): string[] {
  let best: SectionMarker | null = null
  for (const marker of markers) {
    if (marker.charOffset <= offset && (!best || marker.charOffset > best.charOffset)) {
      best = marker
    }
  }
  return best ? [...best.sectionPath] : ["Document"]
}

// ─────────────────────────────────────────────────────────────────────────────
// Paragraph classification
// ─────────────────────────────────────────────────────────────────────────────

type ParagraphType = "normal" | "heading" | "table" | "formula"

interface Paragraph {
  text: string
  type: ParagraphType
  startPage: number
  endPage: number
  charStart: number
  charEnd: number
}

function classifyParagraph(text: string): ParagraphType {
  const trimmed = text.trim()
  if (!trimmed) return "normal"

  const heading = looksLikeHeading(trimmed)
  if (heading) return "heading"

  // Table heuristics
  const pipeCount = (trimmed.match(/\|/g) || []).length
  const tabCount = (trimmed.match(/\t/g) || []).length
  const digitRatio = (trimmed.match(/\d/g) || []).length / trimmed.length
  const lineCount = trimmed.split("\n").length
  if ((pipeCount >= 4 || tabCount >= 4) && lineCount >= 2) return "table"
  if (digitRatio > 0.35 && lineCount >= 3 && /[-=]{3,}/.test(trimmed)) return "table"

  // Formula heuristics
  const mathSymbols = (trimmed.match(/[∑∫∏√∞∂∆α-ωΑ-Ω←→⇒⇔≤≥≠±×÷]/g) || []).length
  const operatorRatio = (trimmed.match(/[+=\-*/^_{}\\]/g) || []).length / trimmed.length
  if (mathSymbols >= 3 || operatorRatio > 0.15) return "formula"

  return "normal"
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword extraction
// ─────────────────────────────────────────────────────────────────────────────

export function extractKeywords(text: string): string[] {
  const normalized = removeHeaderFooterNoise(text).toLowerCase()
  const tokens: string[] = []

  // English terms: camelCase, hyphenated, alphanumeric, plain words
  const englishMatches = normalized.match(/\b[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*\b/g) || []
  for (const term of englishMatches) {
    if (term.length >= 2 && !STOPWORDS.has(term)) {
      tokens.push(term)
    }
  }

  // Chinese terms: 2-4 character sequences
  const chineseMatches = normalized.match(/[一-龥]{2,4}/g) || []
  for (const term of chineseMatches) {
    if (!STOPWORDS.has(term)) {
      tokens.push(term)
    }
  }

  // Numbers with units
  const numberMatches = normalized.match(/\b\d+(?:\.\d+)?\s*(?:%|kb|mb|gb|ms|s|m|h|hz|px|pt|em)?\b/g) || []
  for (const term of numberMatches) {
    tokens.push(term.replace(/\s+/g, ""))
  }

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const result: string[] = []
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t)
      result.push(t)
    }
  }
  return result.slice(0, 30)
}

function buildTermFrequency(keywords: string[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const kw of keywords) {
    tf[kw] = (tf[kw] || 0) + 1
  }
  return tf
}

// ─────────────────────────────────────────────────────────────────────────────
// Document hashing
// ─────────────────────────────────────────────────────────────────────────────

export function hashDocument(pages: PdfPageText[]): string {
  const fullText = pages.map((p) => p.text).join("\n")
  let hash = 0
  for (let i = 0; i < fullText.length; i++) {
    const char = fullText.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, "0")
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentence splitting for overflow
// ─────────────────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  // Split on sentence terminators followed by space or newline
  const parts = text.split(/(?<=[.!?。！？])\s+/)
  return parts.map((s) => s.trim()).filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// Build paper document
// ─────────────────────────────────────────────────────────────────────────────

export function buildPaperDocument(
  url: string,
  title: string,
  pages: PdfPageText[],
  options: SegmentationOptions = {}
): PaperDocument {
  const {
    targetChunkTokens = 800,
    maxChunkTokens = 1200,
    minChunkTokens = 100,
    overlapTokens = 80,
    maxChars = DEFAULT_MAX_CHARS
  } = options

  const docHash = hashDocument(pages)
  const totalChars = pages.reduce((sum, p) => sum + p.charCount, 0)
  const truncated = totalChars > maxChars

  // Detect sections from raw pages
  const sectionMarkers = detectSections(pages)

  // Build a single normalized text stream with page boundaries
  let fullText = ""
  const pageBoundaries: { pageNumber: number; charOffset: number }[] = []
  for (const page of pages) {
    pageBoundaries.push({ pageNumber: page.pageNumber, charOffset: fullText.length })
    fullText += page.text + "\n\n"
  }

  // Paragraph splitting
  const rawParagraphs = fullText.split(/\n\n+/)
  const paragraphs: Paragraph[] = []
  let currentOffset = 0

  for (const raw of rawParagraphs) {
    const text = normalizeWhitespace(raw)
    if (!text) {
      currentOffset += raw.length + 2
      continue
    }

    const charStart = currentOffset
    const charEnd = currentOffset + raw.length
    const type = classifyParagraph(text)

    // Determine page range
    let startPage = 1
    let endPage = 1
    for (let i = pageBoundaries.length - 1; i >= 0; i--) {
      if (charStart >= pageBoundaries[i].charOffset) {
        startPage = pageBoundaries[i].pageNumber
        break
      }
    }
    for (let i = pageBoundaries.length - 1; i >= 0; i--) {
      if (charEnd >= pageBoundaries[i].charOffset) {
        endPage = pageBoundaries[i].pageNumber
        break
      }
    }

    paragraphs.push({ text, type, startPage, endPage, charStart, charEnd })
    currentOffset += raw.length + 2
  }

  // Assemble chunks
  const chunks: PaperChunk[] = []
  let currentSegmentText = ""
  let currentTokens = 0
  let currentStartPage = 1
  let currentEndPage = 1
  let currentCharStart = 0
  let currentCharEnd = 0
  let currentSectionPath: string[] = ["Document"]
  let currentType: ParagraphType = "normal"
  let pendingOverlap = ""

  function flushChunk(force: boolean = false) {
    if (!currentSegmentText) return
    if (!force && currentTokens < minChunkTokens) return

    const chunkText = pendingOverlap + currentSegmentText
    const normalized = removeHeaderFooterNoise(chunkText)
    const keywords = extractKeywords(normalized)
    const tokenCount = estimateTokens(chunkText)

    chunks.push({
      id: `${docHash}_${chunks.length.toString().padStart(6, "0")}`,
      index: chunks.length,
      sectionPath: currentSectionPath,
      startPage: currentStartPage,
      endPage: currentEndPage,
      charRange: { start: currentCharStart, end: currentCharEnd },
      text: chunkText,
      normalizedText: normalized,
      charCount: chunkText.length,
      estimatedTokens: tokenCount,
      keywords,
      termFrequency: buildTermFrequency(keywords),
      isTable: currentType === "table",
      isFormula: currentType === "formula",
      isHeaderFooter: false,
      truncatedBoundary: false
    })

    // Prepare overlap for next chunk
    const sentences = splitSentences(currentSegmentText)
    let overlapText = ""
    let overlapTokenCount = 0
    for (let i = sentences.length - 1; i >= 0; i--) {
      const s = sentences[i]
      const t = estimateTokens(s)
      if (overlapTokenCount + t > overlapTokens && overlapText) break
      overlapText = s + " " + overlapText
      overlapTokenCount += t
    }
    pendingOverlap = overlapText.trim() ? overlapText.trim() + " " : ""

    currentSegmentText = ""
    currentTokens = 0
    currentCharStart = currentCharEnd
  }

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para.text)

    // Heading: update section path and flush current chunk
    if (para.type === "heading") {
      flushChunk(true)
      currentSectionPath = findSectionForOffset(para.charStart, sectionMarkers)
      continue
    }

    // Special blocks (table/formula) get their own chunk when large
    if ((para.type === "table" || para.type === "formula") && paraTokens > minChunkTokens) {
      flushChunk(true)
      currentSegmentText = para.text
      currentTokens = paraTokens
      currentStartPage = para.startPage
      currentEndPage = para.endPage
      currentCharStart = para.charStart
      currentCharEnd = para.charEnd
      currentType = para.type
      flushChunk(true)
      currentType = "normal"
      continue
    }

    // If adding this paragraph would exceed max, flush first
    if (currentTokens + paraTokens > maxChunkTokens && currentTokens >= minChunkTokens) {
      flushChunk(true)
    }

    // Start new chunk if empty
    if (!currentSegmentText) {
      currentStartPage = para.startPage
      currentCharStart = para.charStart
      currentType = para.type
    }

    currentSegmentText += (currentSegmentText ? "\n\n" : "") + para.text
    currentTokens += paraTokens
    currentEndPage = para.endPage
    currentCharEnd = para.charEnd
    currentSectionPath = findSectionForOffset(para.charStart, sectionMarkers)

    // If we've hit target size, flush
    if (currentTokens >= targetChunkTokens) {
      flushChunk(true)
    }
  }

  flushChunk(true)

  // Remove duplicate chunks by normalized text hash
  const seenHashes = new Set<string>()
  const deduped: PaperChunk[] = []
  for (const chunk of chunks) {
    const h = simpleHash(chunk.normalizedText || chunk.text)
    if (!seenHashes.has(h)) {
      seenHashes.add(h)
      deduped.push(chunk)
    }
  }

  // Re-index after deduplication
  const finalChunks = deduped.map((c, i) => ({ ...c, id: `${docHash}_${i.toString().padStart(6, "0")}`, index: i }))

  // Document-level keywords
  const allKeywords: string[] = []
  const keywordCounts = new Map<string, number>()
  for (const chunk of finalChunks) {
    for (const kw of chunk.keywords) {
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1)
    }
  }
  const sortedKeywords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([kw]) => kw)

  const now = Date.now()
  return {
    url,
    title,
    docHash,
    pageCount: pages.length,
    truncated,
    chunks: finalChunks,
    sectionSummaries: {},
    keywords: sortedKeywords,
    version: 1,
    createdAt: now,
    updatedAt: now
  }
}

function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieve context
// ─────────────────────────────────────────────────────────────────────────────

function tokenizeQuery(query: string): string[] {
  const terms: string[] = []
  const lower = query.toLowerCase()

  // Quoted phrases
  const phrases = lower.match(/"([^"]+)"/g) || []
  for (const p of phrases) {
    terms.push(p.replace(/"/g, ""))
  }

  // English words
  const english = lower.replace(/"[^"]+"/g, " ").match(/\b[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*\b/g) || []
  for (const t of english) {
    if (t.length >= 2 && !STOPWORDS.has(t)) terms.push(t)
  }

  // Chinese sequences
  const chinese = lower.match(/[一-龥]{2,4}/g) || []
  for (const t of chinese) {
    if (!STOPWORDS.has(t)) terms.push(t)
  }

  return Array.from(new Set(terms))
}

function sectionHints(query: string): string[] {
  const lower = query.toLowerCase()
  const hints: string[] = []
  if (/method|algorithm|approach|方法/.test(lower)) hints.push("method", "methods", "methodology", "方法")
  if (/experiment|result|evaluation|实验|结果/.test(lower)) hints.push("experiments", "results", "实验", "结果")
  if (/related work|background|相关工作|背景/.test(lower)) hints.push("related work", "background", "相关工作")
  if (/conclusion|summary|结论|摘要/.test(lower)) hints.push("conclusion", "summary", "结论", "摘要")
  if (/introduction|motivation|引言/.test(lower)) hints.push("introduction", "摘要", "引言")
  return hints
}

export function retrieveContext(
  doc: PaperDocument,
  fullChunks: Map<number, string>,
  query: string,
  selectedText: string = "",
  options: RetrievalOptions = {}
): RetrievedContext {
  const {
    topK = 5,
    maxContextTokens = 3500,
    neighborCount = 1,
    selectedTextBoost = 2
  } = options

  const terms = tokenizeQuery(query)
  const hints = sectionHints(query)
  const selectedTerms = tokenizeQuery(selectedText)

  const chunkScores = doc.chunks.map((chunk) => {
    let score = 0
    let matchReason = ""

    const chunkText = (chunk.normalizedText || chunk.text || "").toLowerCase()
    const sectionPathLower = chunk.sectionPath.join(" ").toLowerCase()

    // Term matches
    for (const term of terms) {
      if (chunk.keywords.includes(term)) score += 2
      if (chunkText.includes(term)) score += 1
      if (sectionPathLower.includes(term)) score += 3
    }

    // Section hints
    for (const hint of hints) {
      if (sectionPathLower.includes(hint)) {
        score += 3
        matchReason = `章节匹配: ${hint}`
      }
    }

    // Selected text boost
    for (const term of selectedTerms) {
      if (chunkText.includes(term)) score += selectedTextBoost
    }

    // Position decay: earlier chunks get slight boost
    score *= 1 - chunk.index / (doc.chunks.length * 10 + 1)

    return { chunk, score: Math.round(score * 100) / 100, matchReason }
  })

  // Sort by score descending
  chunkScores.sort((a, b) => b.score - a.score)

  // Determine confidence
  const maxScore = chunkScores[0]?.score || 0
  let confidence: "high" | "medium" | "low" = "low"
  let reason: string | undefined
  if (maxScore >= 5) confidence = "high"
  else if (maxScore >= 2) confidence = "medium"
  else reason = "未找到与问题直接相关的段落"

  // Take top-K above a tiny threshold
  const threshold = 0.1
  const topChunks = chunkScores
    .filter((cs) => cs.score >= threshold)
    .slice(0, topK)
    .map((cs) => ({
      ...cs.chunk,
      text: fullChunks.get(cs.chunk.index) || cs.chunk.text || "",
      score: cs.score,
      matchReason: cs.matchReason
    }))

  // Gather neighbor chunks
  const neighborIndexes = new Set<number>()
  for (const chunk of topChunks) {
    for (let i = 1; i <= neighborCount; i++) {
      if (chunk.index - i >= 0) neighborIndexes.add(chunk.index - i)
      if (chunk.index + i < doc.chunks.length) neighborIndexes.add(chunk.index + i)
    }
  }
  // Exclude top chunks from neighbors
  for (const chunk of topChunks) neighborIndexes.delete(chunk.index)

  const neighborChunks: PaperChunk[] = []
  for (const idx of neighborIndexes) {
    const chunk = doc.chunks[idx]
    if (chunk) {
      neighborChunks.push({
        ...chunk,
        text: fullChunks.get(chunk.index) || chunk.text || ""
      })
    }
  }

  // Sort neighbors by index
  neighborChunks.sort((a, b) => a.index - b.index)

  // Select relevant section summaries
  const sectionSummaries: PaperSectionSummary[] = []
  const includedSections = new Set<string>()
  for (const chunk of topChunks) {
    const key = chunk.sectionPath.join("|")
    if (!includedSections.has(key) && doc.sectionSummaries[key]) {
      sectionSummaries.push(doc.sectionSummaries[key])
      includedSections.add(key)
    }
  }

  // Apply token budget: keep full summary, section summaries, then top chunks + neighbors
  const fullSummary = doc.fullSummary?.text || ""
  let usedTokens = estimateTokens(fullSummary)
  usedTokens += selectedText ? estimateTokens(selectedText) : 0

  // Add section summaries within budget
  const selectedSections: PaperSectionSummary[] = []
  for (const summary of sectionSummaries) {
    const t = summary.estimatedTokens || estimateTokens(summary.text)
    if (usedTokens + t > maxContextTokens * 0.5) break
    selectedSections.push(summary)
    usedTokens += t
  }

  // Add top chunks within budget
  const selectedTopChunks: Array<PaperChunk & { score: number; matchReason?: string }> = []
  for (const chunk of topChunks) {
    const t = chunk.estimatedTokens || estimateTokens(chunk.text || "")
    if (usedTokens + t > maxContextTokens) break
    selectedTopChunks.push(chunk)
    usedTokens += t
  }

  // Add neighbors if budget remains
  const selectedNeighbors: PaperChunk[] = []
  for (const chunk of neighborChunks) {
    const t = chunk.estimatedTokens || estimateTokens(chunk.text || "")
    if (usedTokens + t > maxContextTokens) break
    selectedNeighbors.push(chunk)
    usedTokens += t
  }

  const contextTruncated = topChunks.length > selectedTopChunks.length || neighborChunks.length > selectedNeighbors.length

  return {
    fullSummary,
    chunks: selectedTopChunks,
    sectionSummaries: selectedSections,
    neighborChunks: selectedNeighbors,
    meta: {
      totalChunks: doc.chunks.length,
      retrievedChunks: selectedTopChunks.length,
      query,
      confidence,
      reason,
      contextTruncated
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context formatting for LLM prompts
// ─────────────────────────────────────────────────────────────────────────────

export function formatRetrievedContext(ctx: RetrievedContext): string {
  const lines: string[] = []

  if (ctx.fullSummary) {
    lines.push("# 全文摘要")
    lines.push(ctx.fullSummary)
    lines.push("")
  }

  if (ctx.sectionSummaries.length > 0) {
    lines.push("# 相关章节摘要")
    for (const summary of ctx.sectionSummaries) {
      const path = summary.title
      lines.push(`## ${path} (p. ${summary.pageRange.start}-${summary.pageRange.end})`)
      lines.push(summary.text)
    }
    lines.push("")
  }

  if (ctx.chunks.length > 0) {
    lines.push("# 相关论文片段")
    for (const chunk of ctx.chunks) {
      const section = chunk.sectionPath.join(" > ") || "正文"
      lines.push(`[chunk ${chunk.index}][${section}][p. ${chunk.startPage}-${chunk.endPage}]`)
      lines.push(chunk.text || "")
      lines.push("")
    }
  }

  if (ctx.neighborChunks.length > 0) {
    lines.push("# 相邻上下文")
    for (const chunk of ctx.neighborChunks) {
      const section = chunk.sectionPath.join(" > ") || "正文"
      lines.push(`[chunk ${chunk.index}][${section}][p. ${chunk.startPage}-${chunk.endPage}]`)
      lines.push(chunk.text || "")
      lines.push("")
    }
  }

  if (ctx.meta.contextTruncated) {
    lines.push("[上下文已因 token 预算截断，仅展示了最相关的部分]")
  }

  return lines.join("\n").trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createEvidence(
  chunk: PaperChunk,
  quote: string,
  type: EvidenceType = "direct",
  confidence: EvidenceConfidence = "high"
): Evidence {
  return {
    chunkIndex: chunk.index,
    sectionPath: chunk.sectionPath,
    pageRange: { start: chunk.startPage, end: chunk.endPage },
    quote,
    type,
    confidence
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single-chunk RetrievedContext from a legacy paperContext string.
 */
export function buildLegacyRetrievedContext(paperContext: string): RetrievedContext {
  return {
    fullSummary: "",
    chunks: [
      {
        id: "legacy_0",
        index: 0,
        sectionPath: ["原文"],
        startPage: 1,
        endPage: 1,
        charRange: { start: 0, end: paperContext.length },
        text: paperContext,
        normalizedText: paperContext,
        charCount: paperContext.length,
        estimatedTokens: estimateTokens(paperContext),
        keywords: extractKeywords(paperContext),
        score: 1,
        matchReason: "旧版 paperContext 兼容模式"
      }
    ],
    sectionSummaries: [],
    neighborChunks: [],
    meta: {
      totalChunks: 1,
      retrievedChunks: 1,
      query: "",
      confidence: "low",
      reason: "使用旧版完整文本模式，未进行检索",
      contextTruncated: false
    }
  }
}

/**
 * Strip full text from a PaperDocument to produce a lightweight PaperContextRecord.
 */
export function toPaperContextRecord(doc: PaperDocument): PaperContextRecord {
  const { chunks, ...rest } = doc
  return {
    ...rest,
    chunks: chunks.map(({ text, normalizedText, ...meta }) => meta)
  }
}
