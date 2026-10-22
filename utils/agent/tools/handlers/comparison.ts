import type { ComparisonDimension, ComparisonResult, Evidence, PaperSnapshot } from "~types"
import {
  getPaperSnapshot,
  listCandidatePapers,
  saveComparison
} from "~utils/storage/storage"
import { trackEvent } from "~utils/reading/reading-tracker"
import { fail } from "../../agent-tools"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import { classifyError } from "../../tool-error"
import type { ToolHandler } from "../registry"

async function handleListCandidatePapers(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const limit = (args.limit as number) || 10
  try {
    const candidates = await listCandidatePapers()
    const sliced = candidates.slice(0, limit)
    if (sliced.length === 0) {
      return {
        success: true,
        data: [],
        message: "暂无可对比的论文。请先阅读并保存几篇论文（有笔记、高亮或元数据）后再试。"
      }
    }
    const list = sliced.map((p, i) => `${i + 1}. ${p.title} (${p.year || "年份未知"}) — ${p.url}`).join("\n")
    return {
      success: true,
      data: sliced,
      message: `找到 ${sliced.length} 篇可对比论文：\n${list}`
    }
  } catch (e: any) {
    return fail(classifyError(e), `获取论文列表失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

async function handleGetPaperSummary(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const url = args.url as string
  if (!url?.trim()) {
    return fail("INVALID_ARGS", "获取摘要失败：请提供论文 URL")
  }
  try {
    const snapshot = await getPaperSnapshot(url)
    if (!snapshot) {
      return fail("NOT_FOUND", `未找到 URL 为 ${url} 的论文数据，请确认该论文已被阅读并有笔记或高亮记录`)
    }
    return {
      success: true,
      data: snapshot,
      message: `已获取《${snapshot.title}》的摘要（${snapshot.notes.length} 条笔记，${snapshot.highlights.length} 个高亮）`
    }
  } catch (e: any) {
    return fail(classifyError(e), `获取论文摘要失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

async function handleComparePapers(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const paperUrls = args.paper_urls as string[]
  const dimensions = (args.dimensions as ComparisonDimension[]) || ["contribution", "method", "experiment", "limitation"]
  const focus = (args.focus as string) || ""

  if (!paperUrls?.length || paperUrls.length < 2) {
    return fail("INVALID_ARGS", "对比失败：请提供至少 2 篇论文的 URL")
  }
  if (paperUrls.length > 5) {
    return fail("INVALID_ARGS", "对比失败：最多同时对比 5 篇论文")
  }

  try {
    onStatus?.("正在收集论文数据...", "compare_papers")

    const snapshots = await Promise.all(paperUrls.map((u) => getPaperSnapshot(u)))
    const validSnapshots = snapshots.filter((s): s is PaperSnapshot => s !== null)

    if (validSnapshots.length < 2) {
      return fail("NOT_FOUND", `对比失败：只找到 ${validSnapshots.length} 篇有效论文数据，至少需要 2 篇。请确认论文已被阅读并有笔记或元数据记录。`)
    }

    const { retrievePaperEvidence, formatEvidenceBlock, buildComparisonQuery } = await import(
      "~utils/agent/comparison-retrieval"
    )
    const query = buildComparisonQuery(dimensions, focus)

    onStatus?.("正在检索论文证据（含页码）...", "compare_papers")
    const evidenceList = await Promise.all(paperUrls.map((u) => retrievePaperEvidence(u, query, 2000)))
    const retrievable = evidenceList.filter((e) => e.retrievable)
    const evidenceByPaper: Record<string, Evidence[]> = Object.fromEntries(
      evidenceList.map((e) => [e.url, e.evidences])
    )
    const perPaperChunkIds: Record<string, string[]> = Object.fromEntries(
      evidenceList.map((e) => [
        e.url,
        e.evidences.map((ev) => `chunk_${ev.chunkIndex}`)
      ])
    )

    const dimensionLabels: Record<string, string> = {
      contribution: "核心贡献",
      method: "方法",
      experiment: "实验",
      limitation: "局限性",
      novelty: "新颖性",
      practical_value: "实用价值"
    }
    const dimText = dimensions.map((d) => dimensionLabels[d] || d).join("、")
    const focusText = focus ? `\n特别关注：${focus}` : ""

    const { comparePapersWithLLM, generatePaperDimensionDigest } = await import("~utils/agent/llm-client")

    let result: ComparisonResult
    let mode: "rag_evidence" | "snapshot_fallback"

    if (retrievable.length >= 2) {
      // RAG mode: page-indexed evidence from paper full-text indexes
      mode = "rag_evidence"
      if (retrievable.length <= 3) {
        // Single call: evidence blocks fit comfortably in the prompt
        onStatus?.("正在生成对比分析（基于原文证据）...", "compare_papers")
        const paperSummaries = retrievable.map((e) => formatEvidenceBlock(e)).join("\n\n")
        result = await comparePapersWithLLM(validSnapshots, dimensions, paperSummaries, dimText, focusText, {
          mode,
          trace: { query, perPaperChunkIds },
          evidenceByPaper
        })
      } else {
        // Map-Reduce: per-paper dimension digests, then cross-paper comparison
        onStatus?.("正在逐篇提取维度要点（Map）...", "compare_papers")
        const digests = await Promise.all(
          retrievable.map((e) =>
            generatePaperDimensionDigest(e.title, e.url, formatEvidenceBlock(e), dimText, focusText).catch(
              () => `（《${e.title}》要点提取失败）`
            )
          )
        )
        onStatus?.("正在生成跨论文对比（Reduce）...", "compare_papers")
        const paperSummaries = retrievable
          .map((e, i) => `### ${e.title}\nURL: ${e.url}\n维度要点（含页码）：\n${digests[i]}`)
          .join("\n\n")
        result = await comparePapersWithLLM(validSnapshots, dimensions, paperSummaries, dimText, focusText, {
          mode,
          trace: { query, perPaperChunkIds },
          evidenceByPaper
        })
      }
    } else {
      // Snapshot fallback: no indexed papers (or only one) — legacy preview mode
      mode = "snapshot_fallback"
      onStatus?.("正在生成对比分析（快照模式）...", "compare_papers")
      const paperSummaries = validSnapshots
        .map((s, i) => {
          const noteText = s.notes.map((n) => `- ${n.comment}`).join("\n") || "（无笔记）"
          const highlightText = s.highlights.length > 0 ? s.highlights.join("、") : "（无高亮）"
          const ctx = s.contextPreview || "（无上下文）"
          return `### 论文 ${i + 1}：${s.title}
URL: ${s.url}
作者：${s.authors.join(", ") || "未知"}  年份：${s.year || "未知"}
用户笔记：
${noteText}
关键高亮：${highlightText}
文本预览：${ctx.slice(0, 400)}`
        })
        .join("\n\n")

      result = await comparePapersWithLLM(validSnapshots, dimensions, paperSummaries, dimText, focusText, {
        mode,
        trace: { query, perPaperChunkIds }
      })
    }

    const evidenceCount = Object.values(evidenceByPaper).reduce((n, list) => n + list.length, 0)
    trackEvent("compare", {
      paper_count: validSnapshots.length,
      dimensions: dimensions.length,
      mode,
      evidence_count: evidenceCount
    })

    const modeHint =
      mode === "rag_evidence"
        ? `基于 ${evidenceCount} 个带页码的原文证据片段`
        : "（部分论文无全文索引，使用摘要快照模式，无页码引用）"

    return {
      success: true,
      data: result,
      message: `已完成 ${validSnapshots.length} 篇论文的对比分析（维度：${dimText}，${modeHint}）`
    }
  } catch (e: any) {
    return fail(classifyError(e), `对比生成失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

async function handleSaveComparison(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const title = args.title as string
  const comparisonJson = args.comparison_json as string

  if (!title?.trim()) {
    return fail("INVALID_ARGS", "保存失败：请提供对比标题")
  }
  if (!comparisonJson?.trim()) {
    return fail("INVALID_ARGS", "保存失败：没有可保存的对比数据")
  }

  try {
    const result: ComparisonResult = JSON.parse(comparisonJson)
    const saved = await saveComparison(title, result)
    trackEvent("compare", { paper_count: saved.paperUrls?.length || 0, title })
    return {
      success: true,
      data: { id: saved.id, title: saved.title },
      message: `已保存对比《${title}》`
    }
  } catch (e: any) {
    return fail(classifyError(e), `保存对比失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

export const comparisonHandlers: ToolHandler[] = [
  { name: "list_candidate_papers", execute: handleListCandidatePapers },
  { name: "get_paper_summary", execute: handleGetPaperSummary },
  { name: "compare_papers", execute: handleComparePapers },
  { name: "save_comparison", execute: handleSaveComparison }
]
