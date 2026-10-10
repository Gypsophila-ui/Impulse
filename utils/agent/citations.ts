/**
 * Page-index citation parsing and verification.
 *
 * The agent's replies carry citations like `[chunk 3]` and `[p. 4]` /
 * `[p. 4-6]`. This module parses them and verifies them against the turn's
 * actually-retrieved context snapshot (AgentTurnSnapshot), so hallucinated
 * citations can be flagged in the UI.
 */
import type { AgentTurnSnapshot } from "~types"

export interface ParsedCitations {
  /** chunk indexes cited as [chunk N] */
  chunkIndexes: number[]
  /** pages cited as [p. X] or [p. X-Y] */
  pages: number[]
}

const CHUNK_PATTERN = /\[chunk\s*(\d+)\]/gi
const PAGE_PATTERN = /\[p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/gi

export function parseCitations(text: string): ParsedCitations {
  const chunkIndexes: number[] = []
  const pages: number[] = []

  for (const match of text.matchAll(CHUNK_PATTERN)) {
    chunkIndexes.push(parseInt(match[1], 10))
  }
  for (const match of text.matchAll(PAGE_PATTERN)) {
    pages.push(parseInt(match[1], 10))
    if (match[2]) pages.push(parseInt(match[2], 10))
  }

  return {
    chunkIndexes: [...new Set(chunkIndexes)],
    pages: [...new Set(pages)]
  }
}

export interface CitationVerdict {
  /** Citations present at all */
  hasCitations: boolean
  /** Every cited chunk/page exists in the turn's retrieved snapshot */
  allVerified: boolean
  /** Cited chunk indexes NOT present in the snapshot */
  unverifiedChunks: number[]
  /** Cited pages NOT covered by the snapshot's page ranges */
  unverifiedPages: number[]
}

/**
 * Verify parsed citations against the turn snapshot.
 * A chunk passes if its index is in snapshot.chunkIndexes; a page passes if
 * it falls within any of snapshot.pageRanges.
 */
export function verifyCitations(text: string, snapshot: AgentTurnSnapshot): CitationVerdict {
  const parsed = parseCitations(text)
  const hasCitations = parsed.chunkIndexes.length > 0 || parsed.pages.length > 0

  const knownIndexes = new Set(snapshot.chunkIndexes)
  const unverifiedChunks = parsed.chunkIndexes.filter((i) => !knownIndexes.has(i))

  const coversPage = (page: number): boolean =>
    snapshot.pageRanges.some((r) => page >= r.start && page <= r.end)
  const unverifiedPages = parsed.pages.filter((p) => !coversPage(p))

  return {
    hasCitations,
    allVerified: unverifiedChunks.length === 0 && unverifiedPages.length === 0,
    unverifiedChunks,
    unverifiedPages
  }
}
