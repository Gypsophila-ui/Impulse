import { trackEvent } from "~utils/reading/reading-tracker"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleGetReadingHistory(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const days = (args.days as number) || 14
  const specificUrl = args.specific_url as string | undefined

  try {
    const { getSafeReadingSummary, getSafeReadingStatsForUrl } = await import("~utils/reading/reading-tracker")

    if (specificUrl) {
      const stats = getSafeReadingStatsForUrl(specificUrl)
      if (!stats) {
        return {
          success: true,
          data: null,
          message: `未找到 URL "${specificUrl}" 的阅读记录。该论文可能尚未被阅读，或阅读历史数据库未初始化。`
        }
      }
      trackEvent("agent_message", { action: "reading_history_url", url: specificUrl })
      return {
        success: true,
        data: stats,
        message:
          `论文《${specificUrl}》阅读统计：\n` +
          `- 访问次数：${stats.sessionCount} 次\n` +
          `- 累计阅读时长：约 ${Math.round(stats.totalDurationSeconds / 60)} 分钟\n` +
          `- 事件记录数：${stats.eventCount}\n` +
          (stats.topEventTypes.length > 0
            ? `- 主要操作：${stats.topEventTypes.map((t) => `${t.type}(${t.count}次)`).join("、")}\n`
            : "") +
          (stats.firstVisitTime
            ? `- 首次阅读：${new Date(stats.firstVisitTime).toLocaleDateString("zh-CN")}\n`
            : "") +
          (stats.lastVisitTime
            ? `- 最近阅读：${new Date(stats.lastVisitTime).toLocaleDateString("zh-CN")}`
            : "")
      }
    }

    const summary = getSafeReadingSummary(days)
    if (!summary) {
      return {
        success: true,
        data: null,
        message: "阅读历史数据库尚未初始化，暂无阅读记录。请先打开几篇论文进行阅读，系统会自动跟踪记录。"
      }
    }
    trackEvent("agent_message", { action: "reading_history_summary", days })
    const recentList = summary.recentTitles
      .slice(0, 10)
      .map((p, i) => `${i + 1}. 《${p.title}》— 约${p.duration_minutes}分钟 (${p.url})`)
      .join("\n")
    return {
      success: true,
      data: summary,
      message:
        `最近 ${days} 天的阅读统计：\n` +
        `- 累计阅读论文：${summary.totalPapers} 篇\n` +
        `- 总阅读时长：约 ${summary.totalDurationMinutes} 分钟\n` +
        `- 主要操作：${summary.topEventTypes.map((t) => `${t.type}(${t.count}次)`).join("、")}\n` +
        `- 最近阅读的论文：\n${recentList || "  暂无记录"}`
    }
  } catch (e: any) {
    return { success: false, error: e?.message, message: `获取阅读历史失败：${e?.message ?? String(e)}` }
  }
}

export const readingHistoryHandlers: ToolHandler[] = [
  { name: "get_reading_history", execute: handleGetReadingHistory }
]
