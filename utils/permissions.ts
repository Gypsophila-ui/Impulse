import type { Skill } from "~types"

export interface PermissionRequirement {
  permissions: string[]
  origins: string[]
}

function isSupportedOriginScheme(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")
}

export function getCurrentOriginPattern(url?: string): string | null {
  if (!url) return null
  if (!isSupportedOriginScheme(url)) return null
  try {
    const u = new URL(url)
    if (u.protocol === "file:") return "file://*/*"
    return `${u.protocol}//${u.host}/*`
  } catch {
    return null
  }
}

export function getSkillPermissionRequirement(
  skill: Skill,
  currentUrl?: string
): PermissionRequirement {
  const permissions: string[] = [...(skill.permissions || [])]
  const origins: string[] = []

  if (skill.requiresHostPermission) {
    if (!permissions.includes("activeTab")) {
      permissions.push("activeTab")
    }
    if (!permissions.includes("scripting")) {
      permissions.push("scripting")
    }
    const originPattern = getCurrentOriginPattern(currentUrl)
    if (originPattern) {
      origins.push(originPattern)
    }
  }

  return {
    permissions: Array.from(new Set(permissions)),
    origins: Array.from(new Set(origins))
  }
}

export async function hasPermissions(req: PermissionRequirement): Promise<boolean> {
  if (req.permissions.length === 0 && req.origins.length === 0) {
    return true
  }

  try {
    const result = await chrome.permissions.contains({
      permissions: req.permissions,
      origins: req.origins
    })
    return result
  } catch {
    // If the API throws, assume the worst case: permission is missing.
    return false
  }
}

export function describePermissionRequirement(req: PermissionRequirement): string {
  const parts: string[] = []
  if (req.permissions.includes("scripting")) {
    parts.push("页面脚本注入权限（用于在网页/PDF 上应用高亮）")
  }
  if (req.permissions.includes("activeTab")) {
    parts.push("当前标签页访问权限")
  }
  if (req.permissions.includes("storage")) {
    parts.push("本地存储权限")
  }
  if (req.origins.length > 0) {
    parts.push(`当前网站权限：${req.origins.join(", ")}`)
  }
  return parts.join("、") || "无特殊权限要求"
}
