import { toolRegistry } from "./registry"
import { noteHandlers } from "./handlers/notes"
import { highlightHandlers } from "./handlers/highlights"
import { contentHandlers } from "./handlers/content"
import { readingHistoryHandlers } from "./handlers/reading-history"
import { userInteractionHandlers } from "./handlers/user-interaction"
import { comparisonHandlers } from "./handlers/comparison"

// Register all tool handlers
const allHandlers = [
  ...noteHandlers,
  ...highlightHandlers,
  ...contentHandlers,
  ...readingHistoryHandlers,
  ...userInteractionHandlers,
  ...comparisonHandlers
]

for (const handler of allHandlers) {
  toolRegistry.register(handler)
}

export { toolRegistry }
export type { ToolHandler } from "./registry"

import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../agent-tools"

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  return toolRegistry.execute(toolName, args, context, onStatus)
}
