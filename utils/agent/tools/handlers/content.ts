import { summarize, translate, extractMetadata } from "~utils/agent/llm-client"
import { resolveToolSourceText, fail } from "../../agent-tools"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import { classifyError } from "../../tool-error"
import type { ToolHandler } from "../registry"

async function handleSummarizeSelection(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = resolveToolSourceText(context)
  if (!effectiveText) {
    return fail("INVALID_ARGS", "摘要失败：请先选中文本或加载论文全文")
  }
  try {
    const summary = await summarize(effectiveText)
    return { success: true, data: { summary }, message: summary }
  } catch (e: any) {
    return fail(classifyError(e), `摘要失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

async function handleTranslateSelection(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = resolveToolSourceText(context)
  if (!effectiveText) {
    return fail("INVALID_ARGS", "翻译失败：请先选中文本或加载论文全文")
  }
  try {
    const targetLang = (args.target_language as string) || "中文"
    const translated = await translate(effectiveText, targetLang)
    return { success: true, data: { translation: translated, targetLanguage: targetLang }, message: translated }
  } catch (e: any) {
    return fail(classifyError(e), `翻译失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

async function handleExtractPaperMetadata(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = resolveToolSourceText(context)
  if (!effectiveText) {
    return fail("INVALID_ARGS", "提取失败：请先选中文本或加载论文全文")
  }
  try {
    const metadata = await extractMetadata(effectiveText)
    return { success: true, data: metadata, message: `已提取元数据：${metadata.title || "未找到标题"}` }
  } catch (e: any) {
    return fail(classifyError(e), `提取元数据失败：${e?.message ?? String(e)}`, String(e?.message ?? e))
  }
}

export const contentHandlers: ToolHandler[] = [
  { name: "summarize_selection", execute: handleSummarizeSelection },
  { name: "translate_selection", execute: handleTranslateSelection },
  { name: "extract_paper_metadata", execute: handleExtractPaperMetadata }
]
