import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../agent-tools"
import { fail } from "../agent-tools"
import { TOOL_DEFINITIONS } from "../tool-definitions"
import { getCurrentOriginPattern, hasPermissions } from "~utils/permissions"
import { shouldRetry, backoffDelayMs, sleep } from "../tool-error"

export interface ToolHandler {
  name: string
  /** 是否允许在 TRANSIENT 错误时重试（默认 true；交互式工具应置 false） */
  retryable?: boolean
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
    onStatus?: ToolExecutionCallback
  ): Promise<ToolResult>
}

/** 包裹 onStatus 调用，确保回调抛错不破坏主流程 */
function safeStatus(onStatus: ToolExecutionCallback | undefined, status: string, name: string): void {
  try {
    onStatus?.(status, name)
  } catch {
    // 忽略状态回调异常
  }
}

class ToolRegistry {
  private handlers = new Map<string, ToolHandler>()

  register(handler: ToolHandler): void {
    this.handlers.set(handler.name, handler)
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
    onStatus?: ToolExecutionCallback
  ): Promise<ToolResult> {
    const handler = this.handlers.get(name)
    if (!handler) {
      return fail("NOT_FOUND", `未知工具: ${name}`)
    }

    // Runtime permission gate for tools that need host/scripting access.
    // 包 try/catch：权限检查异常归一化为结构化失败，绝不向上抛出。
    try {
      const toolDef = TOOL_DEFINITIONS.find((t) => t.name === name)
      if (toolDef) {
        const permissions = [...(toolDef.requiredPermissions || [])]
        const origins: string[] = []
        if (toolDef.requiresHostPermission) {
          const origin = getCurrentOriginPattern(context.currentUrl)
          if (origin) origins.push(origin)
          if (!permissions.includes("activeTab")) permissions.push("activeTab")
        }

        if (permissions.length > 0 || origins.length > 0) {
          const allowed = await hasPermissions({ permissions, origins })
          if (!allowed) {
            const missing = origins.length > 0
              ? `需要当前页面权限（${origins.join(", ")}）`
              : `需要权限：${permissions.join(", ")}`
            return fail("PERMISSION_DENIED", `工具 ${name} 缺少必要权限。${missing}。请在扩展设置中开启后重试。`)
          }
        }
      }
    } catch (e) {
      return fail("INTERNAL_ERROR", `工具 ${name} 权限检查异常：${(e as any)?.message ?? e}`, String((e as any)?.message ?? e))
    }

    // 执行 + 重试（永不抛出）：
    // - 未预期异常 → 归一化为 INTERNAL_ERROR，绝不向上抛
    // - TRANSIENT → 指数退避重试，最多 MAX_RETRIES 次
    // - 其余 → 直接返回（跳过，回传 LLM）
    let result: ToolResult
    let attempt = 0
    while (true) {
      try {
        safeStatus(onStatus, `正在执行: ${name}`, name)
        result = await handler.execute(args, context, onStatus)
      } catch (e) {
        result = fail("INTERNAL_ERROR", `工具 ${name} 执行异常：${(e as any)?.message ?? e}`, String((e as any)?.message ?? e))
      }

      result.retries = attempt

      if (result.success) return result
      if (handler.retryable === false) return result
      if (!shouldRetry(result.code, attempt)) return result

      await sleep(backoffDelayMs(attempt))
      attempt++
    }
  }
}

export const toolRegistry = new ToolRegistry()