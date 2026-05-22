import type { Skill } from "~types"

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

  const meta: Record<string, string> = {}
  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key && value) meta[key] = value
  }

  if (!meta.trigger || !meta.label || !meta.description) {
    throw new Error(`SKILL.md missing required frontmatter fields (trigger, label, description)`)
  }

  return {
    meta: { trigger: meta.trigger, label: meta.label, description: meta.description },
    prompt
  }
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
  loadSkill(noteMd),
]
