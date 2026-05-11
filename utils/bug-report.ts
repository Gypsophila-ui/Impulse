import OpenAI from "openai"
import type { PaperMetadata, ReadingGoal } from "~types"
import type { AppMode, TabKey } from "~components/common/Header"
import { getLLMConfig } from "~utils/storage"
import { extractCodeContext, formatCodeContextForAI, type CodeContext } from "./code-context-extractor"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LogEntry {
  level: "log" | "warn" | "error"
  args: string
  timestamp: number
}

export interface BugReport {
  meta: {
    timestamp: string
    extensionVersion: string
    userAgent: string
    platform: string
  }
  config: {
    hasApiKey: boolean
    provider: string
    model: string
    baseURL: string
  }
  uiState: {
    mode: string
    activeTab: string
    lang: string
    theme: string
    readingGoal: string
  }
  pageContext: {
    url: string
    title: string
    selectedText: string
    metadata: PaperMetadata | null
    tabId: number | null
  }
  dataSummary: {
    notesCount: number
    highlightsCount: number
    chatMessagesCount: number
  }
  console: LogEntry[]
  errors: string[]
  pageInfo?: Record<string, unknown>
  userDescription: string
  codeContext?: CodeContext
}

// ─── Console Interception ───────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 200
let logBuffer: LogEntry[] = []
let originals: { log: typeof console.log; warn: typeof console.warn; error: typeof console.error } | null = null
let errorHistory: string[] = []

const serializeArgs = (args: unknown[]): string => {
  try {
    return args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ""}`
        if (typeof a === "object") {
          try {
            return JSON.stringify(a, null, 2)
          } catch {
            return String(a)
          }
        }
        return String(a)
      })
      .join(" ")
  } catch {
    return "[unserializable]"
  }
}

const pushLog = (level: LogEntry["level"], args: unknown[]) => {
  logBuffer.push({ level, args: serializeArgs(args), timestamp: Date.now() })
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer = logBuffer.slice(-MAX_LOG_ENTRIES)
  }
}

export function startConsoleInterception(): void {
  if (originals) return

  originals = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }

  console.log = (...args: unknown[]) => {
    pushLog("log", args)
    originals!.log(...args)
  }
  console.warn = (...args: unknown[]) => {
    pushLog("warn", args)
    originals!.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    pushLog("error", args)
    originals!.error(...args)
  }

  window.addEventListener("error", (e: ErrorEvent) => {
    const msg = `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`
    errorHistory.push(msg)
    pushLog("error", [msg])
  })

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const msg = `Unhandled Promise Rejection: ${serializeArgs([e.reason])}`
    errorHistory.push(msg)
    pushLog("error", [msg])
  })
}

export function stopConsoleInterception(): void {
  if (!originals) return
  console.log = originals.log
  console.warn = originals.warn
  console.error = originals.error
  originals = null
}

export function getConsoleBuffer(): LogEntry[] {
  return [...logBuffer]
}

export function getErrorHistory(): string[] {
  return [...errorHistory]
}

// ─── Collect ────────────────────────────────────────────────────────────────

export interface CollectBugReportParams {
  mode: AppMode
  activeTab: TabKey
  lang: string
  theme: string
  readingGoal: ReadingGoal
  currentUrl: string
  currentTitle: string
  selectedText: string
  metadata: PaperMetadata | null
  currentTabId: number | null
  notesCount: number
  highlightsCount: number
  chatMessagesCount: number
  userDescription: string
  pageInfo?: Record<string, unknown>
}

export async function collectBugReport(params: CollectBugReportParams): Promise<BugReport> {
  const config = await getLLMConfig()

  let extensionVersion = "unknown"
  try {
    const manifest = chrome.runtime.getManifest()
    extensionVersion = manifest.version || "unknown"
  } catch {
    // ignore
  }

  const maskedBaseURL = config?.baseURL
    ? config.baseURL.replace(/(api[_-]?key|key|token)=[^&]+/gi, "$1=***")
    : ""

  const consoleBuffer = getConsoleBuffer()
  const errorHistory = getErrorHistory()

  // Extract code context
  let codeContext: CodeContext | undefined
  try {
    codeContext = await extractCodeContext(errorHistory, consoleBuffer, 3)
  } catch {
    // Continue without code context if extraction fails
  }

  return {
    meta: {
      timestamp: new Date().toISOString(),
      extensionVersion,
      userAgent: navigator.userAgent,
      platform: navigator.platform || "unknown"
    },
    config: {
      hasApiKey: Boolean(config?.apiKey),
      provider: config?.provider || "openai",
      model: config?.model || "unknown",
      baseURL: maskedBaseURL
    },
    uiState: {
      mode: params.mode,
      activeTab: params.activeTab,
      lang: params.lang,
      theme: params.theme,
      readingGoal: params.readingGoal
    },
    pageContext: {
      url: params.currentUrl,
      title: params.currentTitle,
      selectedText: params.selectedText.slice(0, 500),
      metadata: params.metadata,
      tabId: params.currentTabId
    },
    dataSummary: {
      notesCount: params.notesCount,
      highlightsCount: params.highlightsCount,
      chatMessagesCount: params.chatMessagesCount
    },
    console: consoleBuffer,
    errors: errorHistory,
    pageInfo: params.pageInfo,
    userDescription: params.userDescription,
    codeContext
  }
}

// ─── Format ─────────────────────────────────────────────────────────────────

export function formatBugReportAsMarkdown(report: BugReport): string {
  const lines: string[] = []

  lines.push("# Bug Report")
  lines.push("")
  lines.push(`**Timestamp:** ${report.meta.timestamp}`)
  lines.push(`**Extension Version:** ${report.meta.extensionVersion}`)
  lines.push(`**Platform:** ${report.meta.platform}`)
  lines.push(`**User Agent:** ${report.meta.userAgent}`)
  lines.push("")

  lines.push("## Configuration")
  lines.push(`- API Key configured: ${report.config.hasApiKey ? "Yes" : "No"}`)
  lines.push(`- Provider: ${report.config.provider}`)
  lines.push(`- Model: ${report.config.model}`)
  if (report.config.baseURL) lines.push(`- Base URL: ${report.config.baseURL}`)
  lines.push("")

  lines.push("## UI State")
  lines.push(`- Mode: ${report.uiState.mode}`)
  lines.push(`- Active Tab: ${report.uiState.activeTab}`)
  lines.push(`- Language: ${report.uiState.lang}`)
  lines.push(`- Theme: ${report.uiState.theme}`)
  lines.push(`- Reading Goal: ${report.uiState.readingGoal}`)
  lines.push("")

  lines.push("## Page Context")
  lines.push(`- URL: ${report.pageContext.url}`)
  lines.push(`- Title: ${report.pageContext.title}`)
  if (report.pageContext.selectedText) {
    lines.push(`- Selected Text: "${report.pageContext.selectedText.slice(0, 200)}"`)
  }
  if (report.pageContext.metadata?.title) {
    lines.push(`- Paper: ${report.pageContext.metadata.title}`)
  }
  lines.push("")

  lines.push("## Data Summary")
  lines.push(`- Notes: ${report.dataSummary.notesCount}`)
  lines.push(`- Highlights: ${report.dataSummary.highlightsCount}`)
  lines.push(`- Chat Messages: ${report.dataSummary.chatMessagesCount}`)
  lines.push("")

  if (report.errors.length > 0) {
    lines.push("## Captured Errors")
    for (const err of report.errors) {
      lines.push(`- ${err}`)
    }
    lines.push("")
  }

  if (report.codeContext && report.codeContext.snippets.length > 0) {
    lines.push("## Code Context")
    for (const snippet of report.codeContext.snippets) {
      lines.push(`### ${snippet.file}:${snippet.line}`)
      if (snippet.functionName) {
        lines.push(`Function: ${snippet.functionName}`)
      }
      lines.push("")
      lines.push("```" + snippet.language)

      const startLine = Math.max(1, snippet.line - snippet.linesBefore.length)
      snippet.linesBefore.forEach((line, i) => {
        lines.push(`${startLine + i} | ${line}`)
      })
      lines.push(`${snippet.line} | ${snippet.code}  ← ERROR`)
      snippet.linesAfter.forEach((line, i) => {
        lines.push(`${snippet.line + 1 + i} | ${line}`)
      })

      lines.push("```")
      lines.push("")
    }
  }

  if (report.console.length > 0) {
    lines.push("## Console Logs (last 50)")
    lines.push("")
    const recent = report.console.slice(-50)
    for (const entry of recent) {
      const time = new Date(entry.timestamp).toISOString().slice(11, 23)
      lines.push(`\`[${time}] [${entry.level.toUpperCase()}]\` ${entry.args.slice(0, 300)}`)
      lines.push("")
    }
  }

  if (report.userDescription) {
    lines.push("## User Description")
    lines.push(report.userDescription)
    lines.push("")
  }

  return lines.join("\n")
}

// ─── AI Diagnosis ───────────────────────────────────────────────────────────

export interface DiagnosisResult {
  rootCause: string
  suggestedFix: string
  autoFixAction: "clear_data" | "reset_config" | "retry" | "switch_model" | "none"
  autoFixParams: Record<string, unknown>
}

export async function diagnoseWithAI(report: BugReport): Promise<DiagnosisResult> {
  const config = await getLLMConfig()
  if (!config?.apiKey) {
    return {
      rootCause: "Cannot run AI diagnosis: no API key configured.",
      suggestedFix: "Please configure your API key in Settings first, then re-run diagnosis.",
      autoFixAction: "none",
      autoFixParams: {}
    }
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined,
    dangerouslyAllowBrowser: true
  })

  const recentLogs = report.console.slice(-30)
  const consoleSummary = recentLogs
    .map((e) => `[${e.level.toUpperCase()}] ${e.args.slice(0, 200)}`)
    .join("\n")

  const errorSummary = report.errors.slice(-10).join("\n")
  
  let codeContextSection = ""
  if (report.codeContext && report.codeContext.snippets.length > 0) {
    codeContextSection = formatCodeContextForAI(report.codeContext)
  }

  const contextPrompt = `You are an expert debugging assistant for "Impulse", a Chrome Extension that is an AI-powered PDF reading assistant. Analyze the following diagnostic data and provide a diagnosis.

## Extension State
- Version: ${report.meta.extensionVersion}
- Mode: ${report.uiState.mode}
- Active Tab: ${report.uiState.activeTab}
- Language: ${report.uiState.lang}
- Theme: ${report.uiState.theme}
- Reading Goal: ${report.uiState.readingGoal}

## Configuration
- API Key configured: ${report.config.hasApiKey ? "Yes" : "No"}
- Provider: ${report.config.provider}
- Model: ${report.config.model}
- Base URL: ${report.config.baseURL || "(default)"}

## Page Context
- URL: ${report.pageContext.url || "(none)"}
- Title: ${report.pageContext.title || "(none)"}
- Selected Text: ${report.pageContext.selectedText ? report.pageContext.selectedText.slice(0, 200) : "(none)"}
- Has Metadata: ${report.pageContext.metadata?.title ? "Yes" : "No"}

## Data Summary
- Notes: ${report.dataSummary.notesCount}
- Highlights: ${report.dataSummary.highlightsCount}
- Chat Messages: ${report.dataSummary.chatMessagesCount}

## Captured Errors
${errorSummary || "(none)"}

${codeContextSection}

## Recent Console Logs
${consoleSummary || "(none)"}

## User Description
${report.userDescription || "(none)"}

## Platform
- User Agent: ${report.meta.userAgent}
- Platform: ${report.meta.platform}

Analyze the above information and return ONLY a valid JSON object with these fields:
- rootCause: A concise analysis of what went wrong (1-3 sentences, in the user's language based on the extension language setting)
- suggestedFix: Specific steps to fix the issue (1-3 sentences)
- autoFixAction: One of "clear_data", "reset_config", "retry", "switch_model", or "none" — choose the most appropriate automated fix action, or "none" if the fix requires manual intervention
- autoFixParams: An object with any parameters needed for the auto-fix action (empty object if action is "none")

Choose autoFixAction based on:
- "clear_data" if storage data appears corrupted or is causing issues
- "reset_config" if API configuration seems wrong (wrong key, wrong base URL, wrong model)
- "retry" if the issue seems transient (network error, timeout)
- "switch_model" if the current model seems incompatible or returning errors
- "none" if the fix requires user action or is unclear

Return ONLY the JSON, no other text.`

  try {
    const response = await client.chat.completions.create({
      model: config.model || "gpt-4o-mini",
      messages: [{ role: "user", content: contextPrompt }],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })

    const content = response.choices[0]?.message?.content || "{}"
    const parsed = JSON.parse(content)
    return {
      rootCause: parsed.rootCause || "Unable to determine root cause from available data.",
      suggestedFix: parsed.suggestedFix || "Please review the diagnostic data manually or try restarting the extension.",
      autoFixAction: ["clear_data", "reset_config", "retry", "switch_model", "none"].includes(parsed.autoFixAction)
        ? parsed.autoFixAction
        : "none",
      autoFixParams: parsed.autoFixParams || {}
    }
  } catch (e: any) {
    return {
      rootCause: `AI diagnosis failed: ${e?.message || String(e)}`,
      suggestedFix: "The diagnosis service is currently unavailable. You can still download the bug report JSON and share it for manual review.",
      autoFixAction: "none",
      autoFixParams: {}
    }
  }
}

// ─── Download ───────────────────────────────────────────────────────────────

export function downloadBugReport(report: BugReport): void {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const date = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
  a.download = `impulse-bug-report-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}
