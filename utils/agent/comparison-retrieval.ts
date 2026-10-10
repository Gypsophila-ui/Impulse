/**
 * Cross-paper RAG retrieval for structured comparison.
 *
 * Loads previously indexed papers from local storage (PAPER_CONTEXTS +
 * PAPER_DOC_FULLS — no PDF re-download) and retrieves page-indexed evidence
 * blocks per paper, so comparisons cite `p. X-Y` instead of guessing.
 */
import type { ComparisonDimension, Evidence, EvidenceConfidence, EvidenceType, PaperDocument } from "~types"
import { loadPaperDocForRetrieval } from "~utils/storage/storage"
import { retrieveContext } from "~utils/reading/paper-context"

export interface PaperEvidence {
  url: string
  title: string
  /** Paper has a usable full-text index */
  retrievable: boolean
  /** Page-indexed evidence chunks (empty when not retrievable) */
  evidences: Array<Evidence & { text: string }>
}

/**
 * Load an indexed paper for retrieval. Thin wrapper over storage that also
 * surfaces the title from the index record.
 */
export async function loadRetrievablePaper(
  url: string
): Promise<{ doc: PaperDocument; fullChunks: Map<number, string>; title: string } | null> {
  const loaded = await loadPaperDocForRetrieval(url)
  if (!loaded) return null
  return { ...loaded, title: loaded.doc.title || url }
}

/**
 * Retrieve page-indexed evidence for one paper against a query.
 * Returns `retrievable: false` (with empty evidences) when the paper has no
 * usable index — callers should fall back to snapshot mode.
 */
export async function retrievePaperEvidence(
  url: string,
  query: string,
  tokenCap = 2000
): Promise<PaperEvidence> {
  const loaded = await loadRetrievablePaper(url).catch(() => null)
  if (!loaded) {
    return { url, title: url, retrievable: false, evidences: [] }
  }

  const ctx = retrieveContext(loaded.doc, loaded.fullChunks, query, "", {
    topK: 6,
    maxContextTokens: tokenCap,
    neighborCount: 0,
    mergeAdjacent: true
  })

  const evidences: Array<Evidence & { text: string }> = ctx.chunks.map((c) => ({
    chunkIndex: c.index,
    sectionPath: c.sectionPath,
    pageRange: { start: c.startPage, end: c.endPage },
    quote: (c.text || "").slice(0, 400),
    type: "原文" as EvidenceType,
    confidence: (ctx.meta.confidence === "high" ? "high" : "medium") as EvidenceConfidence,
    text: (c.text || "").slice(0, 1200)
  }))

  return { url, title: loaded.title, retrievable: evidences.length > 0, evidences }
}

/**
 * Format one paper's evidence as a page-marked block for LLM prompts.
 */
export function formatEvidenceBlock(evidence: PaperEvidence): string {
  const header = `### ${evidence.title}\nURL: ${evidence.url}`
  if (!evidence.retrievable) {
    return `${header}\n（无全文索引，仅有元数据）`
  }
  const body = evidence.evidences
    .map(
      (e) =>
        `[chunk ${e.chunkIndex}][${e.sectionPath.join(" > ") || "正文"}][p. ${e.pageRange.start}-${e.pageRange.end}]\n${e.text}`
    )
    .join("\n\n")
  return `${header}\n${body}`
}

/**
 * Build the combined retrieval query for a comparison run.
 */
export function buildComparisonQuery(
  dimensions: Array<ComparisonDimension | string>,
  focus: string
): string {
  const dimensionLabels: Record<string, string> = {
    contribution: "贡献 contribution",
    method: "方法 method",
    experiment: "实验 experiment results",
    limitation: "局限 limitation",
    novelty: "新颖性 novelty",
    practical_value: "实用价值 practical value"
  }
  const dimTerms = dimensions.map((d) => dimensionLabels[d as string] || d)
  return [...dimTerms, focus].filter(Boolean).join(" ")
}
