import type { Skill, SkillPermission, ReadingGoal } from "~types"
import * as yaml from "js-yaml"

// Static imports — Parcel's bundle-text: scheme loads .md files as raw strings at build time
import contributionMd from "bundle-text:./contribution-extractor/SKILL.md"
import methodMd from "bundle-text:./method-decomposition/SKILL.md"
import critiqueMd from "bundle-text:./critical-reading/SKILL.md"
import termMd from "bundle-text:./term-explainer/SKILL.md"
import summaryMd from "bundle-text:./summary/SKILL.md"
import compareMd from "bundle-text:./compare/SKILL.md"
import relatedMd from "bundle-text:./related-work/SKILL.md"
import noteMd from "bundle-text:./add-note/SKILL.md"

interface SkillFrontmatter {
  trigger: string
  label: string
  description: string
  detailedDescription?: string
  examples?: string[]
  inputExpectations?: string
  outputFormat?: string
  suggestedReadingGoal?: ReadingGoal
  tags?: string[]
  category?: string
  toolsUsed?: string[]
  permissions?: SkillPermission[]
  requiresHostPermission?: boolean
}

function parseFrontmatter(raw: string): { meta: SkillFrontmatter; prompt: string } {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("---")) {
    throw new Error("SKILL.md must start with frontmatter (---)")
  }

  const endIdx = trimmed.indexOf("---", 3)
  if (endIdx === -1) {
    throw new Error("SKILL.md frontmatter must have closing ---")
  }

  const fmBlock = trimmed.slice(3, endIdx).trim()
  const prompt = trimmed.slice(endIdx + 3).trim()

  const parsed = yaml.load(fmBlock) as Record<string, unknown> | null | undefined
  if (!parsed || typeof parsed !== "object") {
    throw new Error("SKILL.md frontmatter is not a valid YAML object")
  }

  if (!parsed.trigger || !parsed.label || !parsed.description) {
    throw new Error(`SKILL.md missing required frontmatter fields (trigger, label, description)`)
  }

  const meta: SkillFrontmatter = {
    trigger: String(parsed.trigger),
    label: String(parsed.label),
    description: String(parsed.description)
  }

  if (parsed.detailedDescription) meta.detailedDescription = String(parsed.detailedDescription)
  if (parsed.inputExpectations) meta.inputExpectations = String(parsed.inputExpectations)
  if (parsed.outputFormat) meta.outputFormat = String(parsed.outputFormat)
  if (parsed.category) meta.category = String(parsed.category)
  if (parsed.suggestedReadingGoal) meta.suggestedReadingGoal = String(parsed.suggestedReadingGoal) as ReadingGoal
  if (Array.isArray(parsed.examples)) meta.examples = parsed.examples.map(String)
  if (Array.isArray(parsed.tags)) meta.tags = parsed.tags.map(String)
  if (Array.isArray(parsed.toolsUsed)) meta.toolsUsed = parsed.toolsUsed.map(String)
  if (Array.isArray(parsed.permissions)) {
    meta.permissions = parsed.permissions.map((p) => String(p) as SkillPermission)
  }
  if (parsed.requiresHostPermission !== undefined) {
    meta.requiresHostPermission = Boolean(parsed.requiresHostPermission)
  }

  return { meta, prompt }
}

function loadSkill(raw: string): Skill {
  const { meta, prompt } = parseFrontmatter(raw)
  return { ...meta, prompt }
}

export const SKILLS: Skill[] = [
  loadSkill(contributionMd),
  loadSkill(methodMd),
  loadSkill(critiqueMd),
  loadSkill(termMd),
  loadSkill(summaryMd),
  loadSkill(compareMd),
  loadSkill(relatedMd),
  loadSkill(noteMd)
]
