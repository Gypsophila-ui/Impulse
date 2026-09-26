import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../agent-tools"
import { TOOL_DEFINITIONS } from "../tool-definitions"
import { getCurrentOriginPattern, hasPermissions } from "~utils/permissions"

export interface ToolHandler {
  name: string
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
    onStatus?: ToolExecutionCallback
  ): Promise<ToolResult>
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
      return {
        success: false,
        error: `未知工具: ${name}`,
        message: `未知工具: ${name}`
      }
    }

    // Runtime permission gate for tools that need host/scripting access.
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
          return {
            success: false,
            error: "PERMISSION_DENIED",
            message: `工具 ${name} 缺少必要权限。${missing}。请在扩展设置中开启后重试。`
          }
        }
      }
    }

    onStatus?.(`正在执行: ${name}`, name)
    return handler.execute(args, context, onStatus)
  }
}

export const toolRegistry = new ToolRegistry()
