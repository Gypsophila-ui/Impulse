/**
 * 统一的工具错误码与决策逻辑（唯一错误分类口径）。
 *
 * 三态决策：
 * - TRANSIENT   → 重试（指数退避，最多 MAX_RETRIES 次）
 * - 其余错误码  → 跳过（结构化回传 LLM，由 LLM 决定自纠或停止）
 * - 终止        → 循环级决策，不在此处处理（见 llm-client.ts 熔断逻辑）
 *
 * 注意：本模块不含 `ToolResult` 依赖，`fail()` 助手位于 agent-tools.ts，
 * 以规避与 ToolResult 类型的运行期循环依赖。
 */

/** 统一的工具错误码 */
export type ToolErrorCode =
  | "INVALID_ARGS"      // 参数错误（缺 query / 空文本 / 缺选项 / 越界数量）
  | "PERMISSION_DENIED" // 缺必要权限（含 401/403）
  | "NOT_FOUND"         // 资源不存在（未建索引 / 技能不存在 / 论文无数据）
  | "TRANSIENT"         // 临时故障（429 / 5xx / 网络 / 超时）
  | "INTERNAL_ERROR"    // 未预期异常 / 未知工具 / 回调未配置

/** TRANSIENT 最大重试次数（共 3 次尝试） */
export const MAX_RETRIES = 2

/** 指数退避基座（毫秒） */
export const RETRY_BASE_DELAY_MS = 500

/** 是否应在第 attempt 次重试（attempt 为 0 基，表示本次已重试次数） */
export function shouldRetry(code: ToolErrorCode | undefined, attempt: number): boolean {
  return code === "TRANSIENT" && attempt < MAX_RETRIES
}

/** 指数退避延时（封顶 2000ms） */
export function backoffDelayMs(attempt: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, 2000)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 把抛出的异常（OpenAI SDK / chrome API / 网络错误）归一化为错误码 */
export function classifyError(e: unknown): ToolErrorCode {
  const err = e as any
  const status = err?.status ?? err?.error?.status ?? err?.response?.status
  const msg = String(err?.message ?? err?.error?.message ?? e ?? "").toLowerCase()

  if (status === 429 || status === 408) return "TRANSIENT"
  if (typeof status === "number" && status >= 500) return "TRANSIENT"
  if (/timeout|timed out|econnreset|econnrefused|enotfound|enetunreach|network|fetch failed|aborted|socket|etimedout/i.test(msg))
    return "TRANSIENT"
  if (status === 401 || status === 403) return "PERMISSION_DENIED"
  if (status === 400 || status === 404 || status === 422) return "INVALID_ARGS"
  return "INTERNAL_ERROR"
}