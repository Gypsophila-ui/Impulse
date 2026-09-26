import { SKILLS } from "~skills/index"
import type { Skill, SkillPermission } from "~types"

export type { Skill }
export { SKILLS }

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase().trim()
  if (!q) return SKILLS
  return SKILLS.filter(
    (s) =>
      s.trigger.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      s.examples?.some((ex) => ex.toLowerCase().includes(q))
  )
}

export function findSkillByTrigger(trigger: string): Skill | undefined {
  return SKILLS.find((s) => s.trigger === trigger.toLowerCase().trim())
}

export function getSkillSearchableText(skill: Skill): string {
  return [
    skill.trigger,
    skill.label,
    skill.description,
    skill.detailedDescription,
    ...(skill.tags || []),
    ...(skill.examples || []),
    skill.category,
    skill.inputExpectations,
    skill.outputFormat
  ]
    .filter(Boolean)
    .join(" ")
}

export function getSkillCatalogText(skills: Skill[] = SKILLS): string {
  if (skills.length === 0) return ""

  const lines = skills.map((s) => {
    const examples = s.examples?.length ? `示例：${s.examples.slice(0, 2).join("；")}` : ""
    const tags = s.tags?.length ? `标签：${s.tags.join(", ")}` : ""
    const tools = s.toolsUsed?.length ? `工具：${s.toolsUsed.join(", ")}` : ""
    const perms = s.requiresHostPermission ? "需要当前页面权限" : ""
    const meta = [tags, examples, tools, perms].filter(Boolean).join("；")
    return `- /${s.trigger}（${s.label}）：${s.detailedDescription || s.description}${meta ? `（${meta}）` : ""}`
  })

  return [
    "# 可用技能",
    "你可以根据用户意图主动使用以下技能。如需使用某个技能，请先调用 invoke_skill(trigger) 获取完整提示词，然后按提示词执行。",
    "",
    ...lines
  ].join("\n")
}

export function getSkillPermissionList(skill: Skill): SkillPermission[] {
  const base = [...(skill.permissions || [])]
  if (skill.requiresHostPermission && !base.includes("activeTab")) {
    base.push("activeTab")
  }
  return Array.from(new Set(base))
}
