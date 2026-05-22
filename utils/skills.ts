import { SKILLS } from "~skills/index"
import type { Skill } from "~types"

export type { Skill }
export { SKILLS }

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase().trim()
  if (!q) return SKILLS
  return SKILLS.filter(
    (s) =>
      s.trigger.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  )
}
