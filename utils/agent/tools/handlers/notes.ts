import { saveNote, getNotesByUrl } from "~utils/storage/storage"
import { trackEvent } from "~utils/reading/reading-tracker"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleSaveNote(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const comment = args.comment as string
  if (!comment?.trim()) {
    return { success: false, error: "笔记内容不能为空", message: "保存失败：笔记内容为空" }
  }
  const effectiveText = context.selectedText?.trim() || context.paperText?.trim() || ""
  if (!effectiveText) {
    return { success: false, error: "没有可用文本", message: "保存失败：请先选中要记录的文本或加载论文全文" }
  }
  const textSource = context.selectedText?.trim() ? "选中文本" : "论文全文"
  try {
    const note = await saveNote(effectiveText, comment, context.currentUrl, context.currentTitle)
    trackEvent("note", { action: "agent_save", text_length: effectiveText.length })
    return {
      success: true,
      data: note,
      message: `已保存笔记（关联${textSource}）：${comment.slice(0, 30)}${comment.length > 30 ? "..." : ""}`
    }
  } catch (e: any) {
    return { success: false, error: e?.message, message: `保存笔记失败：${e?.message ?? String(e)}` }
  }
}

async function handleGetNotes(
  _args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
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

async function handleSearchNotes(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
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

export const noteHandlers: ToolHandler[] = [
  { name: "save_note", execute: handleSaveNote },
  { name: "get_notes", execute: handleGetNotes },
  { name: "search_notes", execute: handleSearchNotes }
]
