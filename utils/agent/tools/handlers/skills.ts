import {
  findSkillByTrigger,
  getSkillCatalogText,
  SKILLS
} from "~utils/skills"
import {
  describePermissionRequirement,
  getSkillPermissionRequirement,
  hasPermissions
} from "~utils/permissions"
import type { SkillPermissionNotice } from "~types"
import type { ToolExecutionContext, ToolResult, ToolExecutionCallback } from "../../agent-tools"
import type { ToolHandler } from "../registry"

async function handleListSkills(
  _args: Record<string, unknown>,
  _context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  return {
    success: true,
    data: {
      skills: SKILLS.map((s) => ({
        trigger: s.trigger,
        label: s.label,
        description: s.description,
        detailedDescription: s.detailedDescription,
        examples: s.examples,
        tags: s.tags,
        category: s.category,
        toolsUsed: s.toolsUsed,
        permissions: s.permissions,
        requiresHostPermission: s.requiresHostPermission
      }))
    },
    message: `已列出 ${SKILLS.length} 个可用技能`
  }
}

async function handleInvokeSkill(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  _onStatus?: ToolExecutionCallback
): Promise<ToolResult> {
  const trigger = String(args.trigger || "").trim().toLowerCase()
  const userHint = args.user_hint ? String(args.user_hint) : undefined

  if (!trigger) {
    return { success: false, error: "缺少 trigger", message: "调用技能失败：缺少 trigger" }
  }

  const skill = findSkillByTrigger(trigger)
  if (!skill) {
    return {
      success: false,
      error: "SKILL_NOT_FOUND",
      message: `未找到 trigger 为 /${trigger} 的技能。可用技能：${SKILLS.map((s) => "/" + s.trigger).join(", ")}`
    }
  }

  const permissionReq = getSkillPermissionRequirement(skill, context.currentUrl)
  const hasAll = await hasPermissions(permissionReq)

  if (!hasAll) {
    const notice: SkillPermissionNotice = {
      skillName: skill.label,
      permissions: permissionReq.permissions,
      origins: permissionReq.origins,
      message: `使用 /${skill.trigger} 需要以下权限：${describePermissionRequirement(permissionReq)}。请在扩展设置中开启后重试。`
    }

    try {
      await context.showPermissionNotice?.(notice)
    } catch {
      // ignore notice errors
    }

    return {
      success: false,
      error: "PERMISSION_DENIED",
      message: notice.message
    }
  }

  const prompt = userHint ? `${skill.prompt}\n\n${userHint}` : skill.prompt

  return {
    success: true,
    data: {
      trigger: skill.trigger,
      label: skill.label,
      prompt,
      toolsUsed: skill.toolsUsed,
      requiresHostPermission: skill.requiresHostPermission
    },
    message: `已加载技能：${skill.label}`
  }
}

export const skillHandlers: ToolHandler[] = [
  { name: "list_skills", execute: handleListSkills },
  { name: "invoke_skill", execute: handleInvokeSkill }
]
