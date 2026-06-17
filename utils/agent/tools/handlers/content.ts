import { summarize, translate, extractMetadata } from "~utils/agent/llm-client"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleSummarizeSelection(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""
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

async function handleTranslateSelection(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""
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

async function handleExtractPaperMetadata(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""
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

export const contentHandlers: ToolHandler[] = [
  { name: "summarize_selection", execute: handleSummarizeSelection },
  { name: "translate_selection", execute: handleTranslateSelection },
  { name: "extract_paper_metadata", execute: handleExtractPaperMetadata }
]
