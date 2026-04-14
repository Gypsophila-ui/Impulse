/**
 * PDF text extraction using PDF.js
 * Runs in the sidepanel (full browser page context, not service worker)
 */
import * as pdfjs from "pdfjs-dist"
import { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.min.mjs"

// Run PDF.js in the main thread by injecting the worker handler directly.
// This avoids any worker URL resolution issues in Parcel/Plasmo's bundler.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(pdfjs.GlobalWorkerOptions as any).workerPort = null
// Tell PDF.js to use the already-imported WorkerMessageHandler as the fake worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).pdfjsWorker = { WorkerMessageHandler }

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
    // Fetch the raw PDF bytes
    const response = await fetch(url)
    if (!response.ok) {
      return {
        text: "",
        pageCount: 0,
        truncated: false,
        error: `Failed to fetch PDF: ${response.status} ${response.statusText}`
      }
    }

    const arrayBuffer = await response.arrayBuffer()

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
