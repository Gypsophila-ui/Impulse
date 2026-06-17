import type { ComparisonDimension, ComparisonResult, PaperSnapshot } from "~types"
import {
  getPaperSnapshot,
  listCandidatePapers,
  saveComparison
} from "~utils/storage/storage"
import { trackEvent } from "~utils/reading/reading-tracker"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
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
    return { success: false, error: e?.message, message: `获取论文列表失败：${e?.message ?? String(e)}` }
  }
}

async function handleGetPaperSummary(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const url = args.url as string
  if (!url?.trim()) {
    return { success: false, error: "URL 为空", message: "获取摘要失败：请提供论文 URL" }
  }
  try {
    const snapshot = await getPaperSnapshot(url)
    if (!snapshot) {
      return { success: false, error: "未找到该论文", message: `未找到 URL 为 ${url} 的论文数据，请确认该论文已被阅读并有笔记或高亮记录` }
    }
    return {
      success: true,
      data: snapshot,
      message: `已获取《${snapshot.title}》的摘要（${snapshot.notes.length} 条笔记，${snapshot.highlights.length} 个高亮）`
    }
  } catch (e: any) {
    return { success: false, error: e?.message, message: `获取论文摘要失败：${e?.message ?? String(e)}` }
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
    return { success: false, error: "至少需要 2 篇论文", message: "对比失败：请提供至少 2 篇论文的 URL" }
  }
  if (paperUrls.length > 5) {
    return { success: false, error: "最多支持 5 篇", message: "对比失败：最多同时对比 5 篇论文" }
  }

  try {
    onStatus?.("正在收集论文数据...", "compare_papers")

    const snapshots = await Promise.all(paperUrls.map((u) => getPaperSnapshot(u)))
    const validSnapshots = snapshots.filter((s): s is PaperSnapshot => s !== null)

    if (validSnapshots.length < 2) {
      return {
        success: false,
        error: "有效论文不足",
        message: `对比失败：只找到 ${validSnapshots.length} 篇有效论文数据，至少需要 2 篇。请确认论文已被阅读并有笔记或元数据记录。`
      }
    }

    onStatus?.("正在生成对比分析...", "compare_papers")

    const paperSummaries = validSnapshots.map((s, i) => {
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
    }).join("\n\n")

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

    const { comparePapersWithLLM } = await import("~utils/agent/llm-client")
    const result: ComparisonResult = await comparePapersWithLLM(
      validSnapshots,
      dimensions,
      paperSummaries,
      dimText,
      focusText
    )
    trackEvent("compare", { paper_count: validSnapshots.length, dimensions: dimensions.length })

    return {
      success: true,
      data: result,
      message: `已完成 ${validSnapshots.length} 篇论文的对比分析（维度：${dimText}）`
    }
  } catch (e: any) {
    return { success: false, error: e?.message, message: `对比生成失败：${e?.message ?? String(e)}` }
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
    return { success: false, error: "标题为空", message: "保存失败：请提供对比标题" }
  }
  if (!comparisonJson?.trim()) {
    return { success: false, error: "对比数据为空", message: "保存失败：没有可保存的对比数据" }
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
    return { success: false, error: e?.message, message: `保存对比失败：${e?.message ?? String(e)}` }
  }
}

export const comparisonHandlers: ToolHandler[] = [
  { name: "list_candidate_papers", execute: handleListCandidatePapers },
  { name: "get_paper_summary", execute: handleGetPaperSummary },
  { name: "compare_papers", execute: handleComparePapers },
  { name: "save_comparison", execute: handleSaveComparison }
]
