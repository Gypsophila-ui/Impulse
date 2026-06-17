/**
 * PDF text extraction using PDF.js
 * Runs in the sidepanel (full browser page context, not service worker)
 */
import * as pdfjs from "pdfjs-dist"

// pdfjs-dist v5 requires a non-empty workerSrc.
// Use a bundled worker asset URL so it works inside the extension package.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

export interface PdfExtractResult {
  text: string
  pageCount: number
  truncated: boolean
  error?: string
}

// Max characters to extract — keeps token usage reasonable (~60k chars ≈ ~15k tokens)
const MAX_CHARS = 60_000

/**
 * Extract text from a PDF URL.
 * Works for:
 *  - Chrome native PDF viewer URLs (direct .pdf links)
 *  - arXiv /pdf/xxxx links
 *  - Any publicly accessible PDF
 */
export async function extractPdfText(url: string): Promise<PdfExtractResult> {
  try {
    // 1. 处理本地文件 PDF (file:// 协议)
    if (url.startsWith('file://')) {
      return {
        text: "",
        pageCount: 0,
        truncated: false,
        error: "浏览器安全限制：无法直接读取本地 PDF 文件。建议：1) 使用在线 PDF 链接 2) 手动复制内容到聊天框"
      }
    }

    // 2. 处理 arXiv PDF 链接 — 去掉版本号后缀，确保以 .pdf 结尾
    //    e.g. 2301.12345v2 → 2301.12345.pdf, 2301.12345 → 2301.12345.pdf
    let fetchUrl = url
    if (url.includes('arxiv.org/pdf/')) {
      // 先去掉查询参数和 hash
      const base = url.split(/[?#]/)[0]
      // 去掉版本号后缀 (v1, v2, ...)
      const stripped = base.replace(/v\d+$/i, '')
      // 如果还没有 .pdf 后缀，加上
      fetchUrl = stripped.endsWith('.pdf') ? stripped : stripped + '.pdf'
    }

    // 3. 使用 CORS 模式获取（扩展有 host_permissions，可以绕过 CORS）
    console.debug('[Impulse] Fetching PDF from:', fetchUrl)
    let response: Response
    try {
      response = await fetch(fetchUrl)
    } catch (e: any) {
      console.error('[Impulse] PDF fetch failed:', e?.message ?? e)
      return {
        text: "",
        pageCount: 0,
        truncated: false,
        error: `PDF 获取失败（网络错误）: ${e?.message || '请检查网络连接'}`
      }
    }

    if (!response.ok) {
      console.error('[Impulse] PDF fetch returned HTTP', response.status, response.statusText)
      // 尝试获取响应文本作为错误信息（可能是 HTML 错误页）
      let detail = ""
      try {
        const text = await response.text()
        const title = text.match(/<title>(.*?)<\/title>/i)?.[1]
        if (title) detail = ` (${title})`
      } catch { /* ignore */ }
      return {
        text: "",
        pageCount: 0,
        truncated: false,
        error: `PDF 获取失败: HTTP ${response.status} ${response.statusText}${detail}`
      }
    }

    const arrayBuffer = await response.arrayBuffer()
    return await processPdfBuffer(arrayBuffer)
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    console.error('[Impulse] PDF extraction error:', msg)
    return {
      text: "",
      pageCount: 0,
      truncated: false,
      error: msg.includes("password")
        ? "PDF 受密码保护，无法提取文本"
        : `PDF 处理失败: ${msg}`
    }
  }
}

export async function processPdfBuffer(arrayBuffer: ArrayBuffer): Promise<PdfExtractResult> {
  try {
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      // Disable range requests — we already have the full buffer
      disableRange: true,
      disableStream: true,
      // Disable workers fetch (we provide the data directly)
      isEvalSupported: false
    })

    const pdf = await loadingTask.promise
    const pageCount = pdf.numPages

    const chunks: string[] = []
    let totalChars = 0
    let truncated = false

    for (let i = 1; i <= pageCount; i++) {
      if (totalChars >= MAX_CHARS) {
        truncated = true
        break
      }

      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      // Join text items, preserving rough paragraph structure
      let pageText = ""
      let lastY: number | null = null

      for (const item of textContent.items) {
        if ("str" in item) {
          const currentY = "transform" in item ? item.transform[5] : null

          // Insert newline when vertical position changes significantly (new line/paragraph)
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += "\n"
          }
          pageText += item.str
          if (currentY !== null) lastY = currentY
        }
      }

      // Clean up excessive whitespace
      pageText = pageText
        .replace(/ {2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

      if (pageText) {
        chunks.push(`[Page ${i}]\n${pageText}`)
        totalChars += pageText.length
      }
    }

    let text = chunks.join("\n\n")

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS)
      truncated = true
    }

    return { text, pageCount, truncated }
  } catch (e: any) {
    // Encrypted or corrupted PDF
    const msg = e?.message ?? String(e)
    return {
      text: "",
      pageCount: 0,
      truncated: false,
      error: msg.includes("password")
        ? "PDF 受密码保护，无法提取文本"
        : `PDF 解析失败: ${msg}`
    }
  }
}

/**
 * Detect whether the current tab URL is a PDF.
 * Checks for common PDF URL patterns used by academic publishers and preprint servers.
 */
export function isPdfUrl(url: string): boolean {
  if (!url) return false
  // Strip query params and hash
  const u = url.toLowerCase().split(/[?#]/)[0]
  if (u.endsWith(".pdf")) return true
  if (u.includes("/pdf/")) return true
  // Additional patterns for common academic sites
  if (u.includes("arxiv.org/abs/")) return false // abstract page, not PDF
  return false
}
