/**
 * Code Context Extractor
 * Extracts relevant source code snippets from stack traces for bug diagnosis
 */

export interface CodeSnippet {
  file: string
  line: number
  column: number
  functionName?: string
  code: string
  linesBefore: string[]
  linesAfter: string[]
  language: string
}

export interface CodeContext {
  snippets: CodeSnippet[]
  extractedFrom: string[]
  extractionErrors: string[]
}

/**
 * Parse stack trace to extract file and line information
 */
export function parseStackTrace(stack: string): Array<{
  file: string
  line: number
  column: number
  functionName?: string
}> {
  const frames: Array<{ file: string; line: number; column: number; functionName?: string }> = []
  const stackLines = stack.split('\n').filter(line => line.trim())

  for (const line of stackLines) {
    // Match Chrome format: "at functionName (file:line:column)"
    const chromeMatch = line.match(/at\s+([^\s(]+)\s+\(([^:]+):(\d+):(\d+)\)/)
    if (chromeMatch) {
      frames.push({
        functionName: chromeMatch[1],
        file: chromeMatch[2],
        line: parseInt(chromeMatch[3]),
        column: parseInt(chromeMatch[4])
      })
      continue
    }

    // Match Chrome format 2: "at file:line:column"
    const chromeMatch2 = line.match(/at\s+([^:]+):(\d+):(\d+)/)
    if (chromeMatch2) {
      frames.push({
        file: chromeMatch2[1],
        line: parseInt(chromeMatch2[2]),
        column: parseInt(chromeMatch2[3])
      })
      continue
    }

    // Match Firefox format: "functionName@file:line:column"
    const firefoxMatch = line.match(/([^@]+)@([^:]+):(\d+):(\d+)/)
    if (firefoxMatch) {
      frames.push({
        functionName: firefoxMatch[1],
        file: firefoxMatch[2],
        line: parseInt(firefoxMatch[3]),
        column: parseInt(firefoxMatch[4])
      })
    }
  }

  return frames
}

/**
 * Fetch source code from extension files
 */
async function fetchSourceCode(filePath: string): Promise<string | null> {
  try {
    // For Chrome extension, we can fetch files using chrome.runtime.getURL
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const url = chrome.runtime.getURL(filePath)
      const response = await fetch(url)
      if (response.ok) {
        return await response.text()
      }
    }

    // For development context with import.meta.url
    if (typeof import.meta !== 'undefined') {
      try {
        // Try to resolve relative paths
        const response = await fetch(filePath)
        if (response.ok) {
          return await response.text()
        }
      } catch {
        // Continue to next method
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract code snippet around the error line
 */
function extractCodeSnippet(
  sourceCode: string,
  lineNumber: number,
  contextLines: number = 5
): {
  linesBefore: string[]
  errorLine: string
  linesAfter: string[]
} {
  const lines = sourceCode.split('\n')
  const startLine = Math.max(0, lineNumber - contextLines - 1) // 0-based
  const endLine = Math.min(lines.length, lineNumber + contextLines)

  const linesBefore = lines.slice(startLine, lineNumber - 1)
  const errorLine = lines[lineNumber - 1] || ''
  const linesAfter = lines.slice(lineNumber, endLine)

  return { linesBefore, errorLine, linesAfter }
}

/**
 * Detect file language based on extension
 */
function detectLanguage(fileName: string): string {
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript'
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript'
  if (fileName.endsWith('.json')) return 'json'
  if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return 'css'
  if (fileName.endsWith('.html')) return 'html'
  return 'text'
}

/**
 * Sanitize code to remove sensitive information
 */
function sanitizeCode(code: string): string {
  return code
    .replace(/(api[_-]?key|key|token|secret|password|auth)\s*[=:]\s*['"][^'"]+['"]/gi, '$1: "***REDACTED***"')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***')
    .replace(/pk-[a-zA-Z0-9]{20,}/g, 'pk-***REDACTED***')
}

/**
 * Extract code context from errors and stack traces
 */
export async function extractCodeContext(
  errors: string[],
  consoleLogs: Array<{ level: string; args: string; timestamp: number }>,
  maxSnippets: number = 3
): Promise<CodeContext> {
  const snippets: CodeSnippet[] = []
  const extractedFrom: string[] = []
  const extractionErrors: string[] = []

  // Collect all stack traces from errors
  const allStacks: string[] = []

  for (const error of errors) {
    if (error.includes('\n') && (error.includes('at ') || error.includes('@'))) {
      allStacks.push(error)
    }
  }

  // Also check console logs for errors with stacks
  for (const log of consoleLogs) {
    if (log.level === 'error' && log.args.includes('\n')) {
      if (log.args.includes('at ') || log.args.includes('@')) {
        allStacks.push(log.args)
      }
    }
  }

  // Parse stack frames from all stacks
  const allFrames: Array<{ file: string; line: number; column: number; functionName?: string }> = []
  for (const stack of allStacks) {
    const frames = parseStackTrace(stack)
    allFrames.push(...frames)
  }

  // Process each unique frame (deduplicate by file:line)
  const processed = new Set<string>()

  for (const frame of allFrames) {
    const key = `${frame.file}:${frame.line}`
    if (processed.has(key)) continue
    processed.add(key)

    if (snippets.length >= maxSnippets) break

    try {
      // Try to fetch source code
      let sourceCode = await fetchSourceCode(frame.file)

      // If direct fetch fails, try common patterns
      if (!sourceCode) {
        const fileName = frame.file.split('/').pop() || frame.file
        const commonPaths = [
          fileName,
          `components/${fileName}`,
          `utils/${fileName}`,
          `contents/${fileName}`
        ]

        for (const path of commonPaths) {
          sourceCode = await fetchSourceCode(path)
          if (sourceCode) break
        }
      }

      if (sourceCode) {
        const { linesBefore, errorLine, linesAfter } = extractCodeSnippet(
          sourceCode,
          frame.line,
          5
        )

        snippets.push({
          file: frame.file,
          line: frame.line,
          column: frame.column,
          functionName: frame.functionName,
          code: sanitizeCode(errorLine),
          linesBefore: linesBefore.map(l => sanitizeCode(l)),
          linesAfter: linesAfter.map(l => sanitizeCode(l)),
          language: detectLanguage(frame.file)
        })

        extractedFrom.push(`${frame.file}:${frame.line}`)
      }
    } catch (e) {
      extractionErrors.push(`Failed to extract from ${frame.file}:${frame.line}`)
    }
  }

  return { snippets, extractedFrom, extractionErrors }
}

/**
 * Format code context for AI prompt
 */
export function formatCodeContextForAI(context: CodeContext): string {
  if (context.snippets.length === 0) {
    return 'No code context available.'
  }

  let output = '## Code Context (Relevant Source Code)\n\n'

  for (const snippet of context.snippets) {
    output += `### File: ${snippet.file}:${snippet.line}\n`
    if (snippet.functionName) {
      output += `Function: ${snippet.functionName}\n`
    }
    output += '\n```' + snippet.language + '\n'

    // Lines before
    const startLine = Math.max(1, snippet.line - snippet.linesBefore.length)
    snippet.linesBefore.forEach((line, i) => {
      output += `${startLine + i} | ${line}\n`
    })

    // Error line with marker
    output += `${snippet.line} | ${snippet.code}  ← ERROR HERE\n`

    // Lines after
    snippet.linesAfter.forEach((line, i) => {
      output += `${snippet.line + 1 + i} | ${line}\n`
    })

    output += '```\n\n'
  }

  return output
}

