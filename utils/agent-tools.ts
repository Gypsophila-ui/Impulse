import type { AskUserQuestionCallback, ComparisonDimension, ComparisonResult, PaperSnapshot } from "~types"
import {
  getHighlightsByUrl,
  getNotesByUrl,
  getPaperSnapshot,
  listCandidatePapers,
  saveComparison,
  saveHighlights,
  saveNote
} from "~utils/storage"
import {
  extractMetadata,
  generateHighlights as generateHighlightsLLM,
  summarize,
  translate
} from "~utils/llm-client"
export interface ToolExecutionContext {
  selectedText: string
  paperText: string
  currentUrl: string
  currentTitle: string
  currentTabId: number | null
  askUserQuestion?: AskUserQuestionCallback
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
}

export type ToolExecutionCallback = (
  status: string,
  toolName: string
) => void

// PAPER_TOOLS and getToolNames are now defined in utils/tool-definitions.ts
export { PAPER_TOOLS, getToolNames } from "~utils/tool-definitions"

// ─── Standalone functions for chrome.scripting.executeScript ──────────────────
// These must be self-contained (no external references) to be serializable.

function injectHighlightSentences(phrases: string[]): number {
  const HIGHLIGHT_CLASS = "impulse-sentence-hl"
  const COLORS = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ddd6fe", "#fed7aa"]

  // Clear existing highlights
  const existing = document.querySelectorAll("." + HIGHLIGHT_CLASS)
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i] as HTMLElement
    const p = el.parentNode
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ""), el)
    }
  }
  document.body.normalize()

  function isSkippable(el: Element | null): boolean {
    if (!el) return true
    const tag = el.tagName
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "MARK") return true
    if (el.classList.contains(HIGHLIGHT_CLASS)) return true
    return false
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return isSkippable((node as Text).parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text)
  }

  let count = 0
  const lowerPhrases = phrases.map((p) => p.toLowerCase())

  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i]
    const text = textNode.textContent || ""
    if (!text.trim()) continue

    const sentences: { text: string; highlight: boolean; colorIdx: number }[] = []
    const sentenceRegex = /[^.!?\n]+[.!?]*\n*/g
    let m: RegExpExecArray | null
    while ((m = sentenceRegex.exec(text)) !== null) {
      const sentenceText = m[0]
      const lowerSentence = sentenceText.toLowerCase()
      let highlight = false
      let colorIdx = -1
      for (let p = 0; p < lowerPhrases.length; p++) {
        if (lowerSentence.indexOf(lowerPhrases[p]) !== -1) {
          highlight = true
          colorIdx = p
          break
        }
      }
      sentences.push({ text: sentenceText, highlight, colorIdx })
    }

    if (sentences.length === 0) continue

    let hasMatch = false
    for (let s = 0; s < sentences.length; s++) {
      if (sentences[s].highlight) { hasMatch = true; break }
    }
    if (!hasMatch) continue

    const parent = textNode.parentNode
    if (!parent) continue

    const fragment = document.createDocumentFragment()
    for (let s = 0; s < sentences.length; s++) {
      const sent = sentences[s]
      if (sent.highlight) {
        const span = document.createElement("span")
        span.className = HIGHLIGHT_CLASS
        span.style.backgroundColor = COLORS[sent.colorIdx % COLORS.length]
        span.style.padding = "2px 4px"
        span.style.borderRadius = "3px"
        span.textContent = sent.text
        fragment.appendChild(span)
        count++
      } else {
        fragment.appendChild(document.createTextNode(sent.text))
      }
    }

    parent.replaceChild(fragment, textNode)
  }

  return count
}

function injectClearHighlights(): void {
  const HIGHLIGHT_CLASS = "impulse-sentence-hl"
  const existing = document.querySelectorAll("." + HIGHLIGHT_CLASS)
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i] as HTMLElement
    const p = el.parentNode
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ""), el)
    }
  }
}

export async function applyHighlightsToPage(
  tabId: number,
  phrases: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectHighlightSentences,
      args: [phrases]
    })

    let totalCount = 0
    for (const r of results) {
      if (typeof r.result === "number") totalCount += r.result
    }

    if (totalCount === 0) {
      return { success: false, count: 0, error: "指定短语未在页面中找到" }
    }
    return { success: true, count: totalCount }
  } catch (e: any) {
    const errorMsg = e?.message ?? String(e)
    return { success: false, count: 0, error: errorMsg }
  }
}

export async function clearHighlightsOnPage(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectClearHighlights
    })
  } catch (e) {
    console.error("Failed to clear highlights:", e)
  }
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  onStatus?.(`正在执行: ${toolName}`, toolName)

  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""

  switch (toolName) {
    case "save_note": {
      const comment = args.comment as string
      if (!comment?.trim()) {
        return { success: false, error: "笔记内容不能为空", message: "保存失败：笔记内容为空" }
      }
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "保存失败：请先选中要记录的文本或加载论文全文" }
      }
      const textSource = context.selectedText?.trim() ? "选中文本" : "论文全文"
      try {
        const note = await saveNote(
          effectiveText,
          comment,
          context.currentUrl,
          context.currentTitle
        )
        return {
          success: true,
          data: note,
          message: `已保存笔记（关联${textSource}）：${comment.slice(0, 30)}${comment.length > 30 ? "..." : ""}`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `保存笔记失败：${e?.message ?? String(e)}` }
      }
    }

    case "get_notes": {
      try {
        const notes = await getNotesByUrl(context.currentUrl)
        return {
          success: true,
          data: notes,
          message: notes.length > 0
            ? `当前页面有 ${notes.length} 条笔记`
            : "当前页面暂无笔记"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `获取笔记失败：${e?.message ?? String(e)}` }
      }
    }

    case "apply_highlight": {
      const phrases = args.phrases as string[]
      if (!phrases?.length) {
        return { success: false, error: "没有指定要高亮的短语", message: "高亮失败：没有指定短语" }
      }
      if (!context.currentTabId) {
        return { success: false, error: "无法获取当前标签页", message: "高亮失败：无法访问页面" }
      }
      try {
        const validPhrases = phrases.filter(
          (p) => typeof p === "string" && p.trim().length > 0
        )
        if (validPhrases.length === 0) {
          return { success: false, error: "没有有效的短语", message: "高亮失败：没有有效的短语" }
        }

        const phrasesInSelection = effectiveText
          ? validPhrases.filter((p) => effectiveText.includes(p))
          : []

        const result = await applyHighlightsToPage(context.currentTabId, validPhrases)
        if (result.success && result.count > 0) {
          await saveHighlights(
            validPhrases.slice(0, result.count),
            effectiveText || "页面内容",
            context.currentUrl,
            context.currentTitle
          )
          const note = phrasesInSelection.length < validPhrases.length
            ? `（其中 ${phrasesInSelection.length} 个在可用文本中）`
            : ""
          return {
            success: true,
            data: { count: result.count, phrases: validPhrases.slice(0, result.count) },
            message: `已高亮 ${result.count} 个短语${note}`
          }
        } else {
          const errMsg = result.error || "短语未在页面中找到"
          return { success: false, error: errMsg, message: `高亮失败：${errMsg}` }
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `高亮失败：${e?.message ?? String(e)}` }
      }
    }

    case "get_highlights": {
      try {
        const highlights = await getHighlightsByUrl(context.currentUrl)
        return {
          success: true,
          data: highlights,
          message: highlights.length > 0
            ? `当前页面有 ${highlights.length} 个高亮`
            : "当前页面暂无高亮"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `获取高亮失败：${e?.message ?? String(e)}` }
      }
    }

    case "summarize_selection": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "摘要失败：请先选中文本或加载论文全文" }
      }
      try {
        const summary = await summarize(effectiveText)
        return { success: true, data: { summary }, message: summary }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `摘要失败：${e?.message ?? String(e)}` }
      }
    }

    case "translate_selection": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "翻译失败：请先选中文本或加载论文全文" }
      }
      try {
        const targetLang = (args.target_language as string) || "中文"
        const translated = await translate(effectiveText, targetLang)
        return { success: true, data: { translation: translated, targetLanguage: targetLang }, message: translated }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `翻译失败：${e?.message ?? String(e)}` }
      }
    }

    case "extract_paper_metadata": {
      if (!effectiveText) {
        return { success: false, error: "没有可用文本", message: "提取失败：请先选中文本或加载论文全文" }
      }
      try {
        const metadata = await extractMetadata(effectiveText)
        return { success: true, data: metadata, message: `已提取元数据：${metadata.title || "未找到标题"}` }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `提取元数据失败：${e?.message ?? String(e)}` }
      }
    }

    case "search_notes": {
      const query = args.query as string
      if (!query?.trim()) {
        return { success: false, error: "搜索关键词为空", message: "搜索失败：请提供搜索关键词" }
      }
      try {
        const pageNotes = await getNotesByUrl(context.currentUrl)
        const results = pageNotes.filter(
          (note) =>
            note.comment.toLowerCase().includes(query.toLowerCase()) ||
            note.selectedText.toLowerCase().includes(query.toLowerCase())
        )
        return {
          success: true,
          data: results,
          message: results.length > 0
            ? `在当前页面找到 ${results.length} 条相关笔记`
            : "当前页面未找到相关笔记"
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `搜索失败：${e?.message ?? String(e)}` }
      }
    }

    case "ask_user_question": {
      const question = args.question as string
      const options = args.options as Array<{ label: string; description?: string }>
      const allowCustomInput = (args.allow_custom_input as boolean) ?? false
      const placeholder = args.placeholder as string | undefined

      if (!question?.trim()) {
        return { success: false, error: "问题不能为空", message: "提问失败：问题为空" }
      }
      if (!options?.length) {
        return { success: false, error: "选项不能为空", message: "提问失败：请提供选项" }
      }

      if (!context.askUserQuestion) {
        return { success: false, error: "askUserQuestion 回调未配置", message: "提问失败：系统未配置用户交互功能" }
      }

      try {
        const result = await context.askUserQuestion({
          question,
          options,
          allowCustomInput,
          placeholder
        })
        return {
          success: true,
          data: {
            answer: result.selected,
            isCustomInput: result.isCustomInput
          },
          message: `用户回答：${result.selected}`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `提问失败：${e?.message ?? String(e)}` }
      }
    }

    case "list_candidate_papers": {
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

    case "get_paper_summary": {
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

    case "compare_papers": {
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
        onStatus?.("正在收集论文数据...", toolName)

        // Collect snapshots for all papers
        const snapshots = await Promise.all(paperUrls.map((u) => getPaperSnapshot(u)))
        const validSnapshots = snapshots.filter((s): s is PaperSnapshot => s !== null)

        if (validSnapshots.length < 2) {
          return {
            success: false,
            error: "有效论文不足",
            message: `对比失败：只找到 ${validSnapshots.length} 篇有效论文数据，至少需要 2 篇。请确认论文已被阅读并有笔记或元数据记录。`
          }
        }

        onStatus?.("正在生成对比分析...", toolName)

        // Build a condensed prompt for the LLM to generate comparison
        const paperSummaries = validSnapshots.map((s, i) => {
          const noteText = s.notes.map((n) => `- ${n.comment}`).join("\n") || "（无笔记）"
          const highlightText = s.highlights.length > 0 ? s.highlights.join("、") : "（无高亮）"
          const context = s.contextPreview || "（无上下文）"
          return `### 论文 ${i + 1}：${s.title}
URL: ${s.url}
作者：${s.authors.join(", ") || "未知"}  年份：${s.year || "未知"}
用户笔记：
${noteText}
关键高亮：${highlightText}
文本预览：${context.slice(0, 400)}`
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

        // Import getClient lazily to avoid circular dependency
        const { comparePapersWithLLM } = await import("~utils/llm-client")
        const result: ComparisonResult = await comparePapersWithLLM(
          validSnapshots,
          dimensions,
          paperSummaries,
          dimText,
          focusText
        )

        return {
          success: true,
          data: result,
          message: `已完成 ${validSnapshots.length} 篇论文的对比分析（维度：${dimText}）`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `对比生成失败：${e?.message ?? String(e)}` }
      }
    }

    case "save_comparison": {
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
        return {
          success: true,
          data: { id: saved.id, title: saved.title },
          message: `已保存对比《${title}》`
        }
      } catch (e: any) {
        return { success: false, error: e?.message, message: `保存对比失败：${e?.message ?? String(e)}` }
      }
    }

    default:
      return { success: false, error: `未知工具: ${toolName}`, message: `未知工具: ${toolName}` }
  }
}
export function formatToolResultForLLM(result: ToolResult): string {
  if (result.success) {
    if (typeof result.data === "string") {
      return result.data
    }
    return JSON.stringify(result.data, null, 2)
  }
  return `Error: ${result.error || result.message}`
}
