import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../agent-tools"

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
    onStatus?.(`正在执行: ${name}`, name)
    return handler.execute(args, context, onStatus)
  }
}

export const toolRegistry = new ToolRegistry()
