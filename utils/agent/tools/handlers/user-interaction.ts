import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleAskUserQuestion(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
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

export const userInteractionHandlers: ToolHandler[] = [
  { name: "ask_user_question", execute: handleAskUserQuestion }
]
