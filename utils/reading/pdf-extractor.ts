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
    // 处理不同类型的 PDF URL
    let arrayBuffer: ArrayBuffer
    
    // 1. 处理本地文件 PDF (file:// 协议)
    if (url.startsWith('file://')) {
      // 本地文件由于浏览器安全限制无法直接读取
      // 建议用户使用以下替代方案：
      // 1. 将 PDF 上传到临时服务器
      // 2. 使用在线 PDF 查看器
      // 3. 手动复制 PDF 内容
      return {
        text: "",
        pageCount: 0,
        truncated: false,
        error: "浏览器安全限制：无法直接读取本地 PDF 文件。建议：1) 使用在线 PDF 链接 2) 手动复制内容到聊天框"
      }
    }
    
    // 2. 处理 arXiv PDF 链接 — 去掉版本号后缀 (e.g. 2301.12345v2 → 2301.12345.pdf)
    let fetchUrl = url
    if (url.includes('arxiv.org/pdf/')) {
      fetchUrl = url.replace(/v\d+$/, '') + '.pdf'
    }
    
    // 3. 尝试多种获取策略
    let response: Response
    let fetchError: Error | null = null
    
    // 策略1: 直接 fetch
    try {
      response = await fetch(fetchUrl)
      if (response.ok) {
        arrayBuffer = await response.arrayBuffer()
        return await processPdfBuffer(arrayBuffer)
      }
    } catch (e) {
      fetchError = e as Error
    }
    
    // 策略2: 使用 CORS 模式
    try {
      response = await fetch(fetchUrl, {
        mode: 'cors',
        credentials: 'omit'
      })
      if (response.ok) {
        arrayBuffer = await response.arrayBuffer()
        return await processPdfBuffer(arrayBuffer)
      }
    } catch (e) {
      fetchError = e as Error
    }
    
    // 所有策略都失败
    return {
      text: "",
      pageCount: 0,
      truncated: false,
      error: `无法获取 PDF: ${fetchError?.message || '网络请求失败'}`
    }
  } catch (e: any) {
    // 捕获任何未预期的错误
    const msg = e?.message ?? String(e)
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
 */
export function isPdfUrl(url: string): boolean {
  if (!url) return false
  const u = url.toLowerCase().split("?")[0]
  if (u.endsWith(".pdf")) return true
  if (u.includes("/pdf/")) return true
  return false
}
