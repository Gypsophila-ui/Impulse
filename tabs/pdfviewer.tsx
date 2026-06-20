import React, { useEffect, useRef, useState, useCallback } from "react"
import * as pdfjs from "pdfjs-dist"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle, Highlighter } from "lucide-react"
// Configure PDF.js worker (same approach as pdf-extractor.ts)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

// ─── Types ───────────────────────────────────────────────────────────────────

interface InjectionPayload {
  id: string
  phrase: string
  category?: string
  color: string
}

interface PdfViewerState {
  loading: boolean
  error: string | null
  pdfDoc: pdfjs.PDFDocumentProxy | null
  pageNum: number
  numPages: number
  scale: number
  rendering: boolean
  pendingPage: number | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HIGHLIGHT_CLASS = "impulse-sentence-hl"
const FOCUS_CLASS = "impulse-hl-focus"

const CATEGORY_COLORS: Record<string, string> = {
  important: "#fef08a",
  question: "#fecaca",
  definition: "#bfdbfe",
  method: "#bbf7d0",
  default: "#fed7aa"
}

/**
 * Convert a hex color (#rgb / #rrggbb) to an rgba() string with the given alpha.
 * Falls back to the original string if it cannot be parsed (e.g. already rgba/hsl).
 */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex // already rgba/hsl/named — return as-is
  let r: number, g: number, b: number
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16)
    g = parseInt(m[1][1] + m[1][1], 16)
    b = parseInt(m[1][2] + m[1][2], 16)
  } else {
    r = parseInt(m[1].slice(0, 2), 16)
    g = parseInt(m[1].slice(2, 4), 16)
    b = parseInt(m[1].slice(4, 6), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── PDF Viewer Component ────────────────────────────────────────────────────

const PdfViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse original PDF URL from query string
  const originalPdfUrl = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("url") || ""
  }, [])

  const [state, setState] = useState<PdfViewerState>({
    loading: true,
    error: null,
    pdfDoc: null,
    pageNum: 1,
    numPages: 0,
    scale: 1.2,
    rendering: false,
    pendingPage: null
  })

  const [appliedHighlights, setAppliedHighlights] = useState<InjectionPayload[]>([])

  // ─── Load PDF document ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!originalPdfUrl) {
      setState((s) => ({ ...s, loading: false, error: "No PDF URL provided" }))
      return
    }

    let cancelled = false
    const loadPdf = async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: null }))

        // For arXiv URLs, normalize the URL (strip version suffix, ensure .pdf)
        let fetchUrl = originalPdfUrl
        if (originalPdfUrl.includes("arxiv.org/pdf/")) {
          const base = originalPdfUrl.split(/[?#]/)[0]
          const stripped = base.replace(/v\d+$/i, "")
          fetchUrl = stripped.endsWith(".pdf") ? stripped : stripped + ".pdf"
        }

        const loadingTask = pdfjs.getDocument({
          url: fetchUrl,
          isEvalSupported: false
        })

        const pdf = await loadingTask.promise
        if (cancelled) return

        setState((s) => ({
          ...s,
          loading: false,
          pdfDoc: pdf,
          numPages: pdf.numPages,
          pageNum: 1
        }))
      } catch (e: any) {
        if (cancelled) return
        const msg = e?.message ?? String(e)
        setState((s) => ({
          ...s,
          loading: false,
          error: msg.includes("password")
            ? "PDF 受密码保护，无法打开"
            : `PDF 加载失败: ${msg}`
        }))
      }
    }

    void loadPdf()
    return () => { cancelled = true }
  }, [originalPdfUrl])

  // ─── Render page (canvas + text layer) ──────────────────────────────────────

  const renderPage = useCallback(async (pageNum: number, scale: number) => {
    if (!state.pdfDoc || !canvasRef.current || !textLayerRef.current) return

    setState((s) => ({ ...s, rendering: true }))

    try {
      const page = await state.pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })

      // Configure canvas
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")!
      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined

      await page.render({
        canvasContext: context,
        viewport,
        transform: transform as any
      } as any).promise

      // Render text layer — manually positioned spans.
      // Use viewport.transform to convert PDF coordinates to screen coordinates.
      // The viewport transform is [a, b, c, d, e, f] where:
      //   screenX = a*x + c*y + e
      //   screenY = b*x + d*y + f
      // This correctly handles scale, Y-axis flip, and rotation — unlike the
      // previous formula (viewport.height - y) * scale which double-applied
      // scale to the viewport height component.
      const textLayer = textLayerRef.current
      textLayer.innerHTML = ""
      textLayer.style.width = `${Math.floor(viewport.width)}px`
      textLayer.style.height = `${Math.floor(viewport.height)}px`
      textLayer.style.setProperty("--scale-factor", String(scale))

      const textContent = await page.getTextContent()
      const [va, vb, vc, vd, ve, vf] = viewport.transform

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) continue

        const tx = item.transform as number[]
        const fontHeight = Math.hypot(tx[2], tx[3])
        const pdfX = tx[4]
        const pdfY = tx[5]

        // Convert PDF coords → viewport (screen) coords
        const screenX = va * pdfX + vc * pdfY + ve
        const screenY = vb * pdfX + vd * pdfY + vf

        const span = document.createElement("span")
        span.textContent = item.str
        span.style.position = "absolute"
        span.style.left = `${screenX}px`
        span.style.top = `${screenY}px`
        span.style.fontSize = `${fontHeight * scale}px`
        span.style.fontFamily = "sans-serif"
        span.style.color = "transparent"
        span.style.whiteSpace = "pre"
        span.style.cursor = "text"
        span.style.transformOrigin = "0% 0%"
        span.style.lineHeight = "1"
        // Store original text for highlight matching
        span.dataset.text = item.str
        textLayer.appendChild(span)
      }

      // Re-apply any existing highlights to the newly rendered page
      if (appliedHighlights.length > 0) {
        applyHighlightsToTextLayer(appliedHighlights)
      }
    } catch (e: any) {
      console.error("[Impulse PDF Viewer] Render error:", e)
    } finally {
      setState((s) => ({ ...s, rendering: false, pendingPage: null }))
    }
  }, [state.pdfDoc, appliedHighlights])

  // Render when page or scale changes
  useEffect(() => {
    if (state.pdfDoc && !state.loading) {
      void renderPage(state.pageNum, state.scale)
    }
  }, [state.pdfDoc, state.pageNum, state.scale, state.loading, renderPage])

  // ─── Auto-load saved highlights from storage when PDF is first loaded ───────
  // This handles the case where the user was redirected from a native PDF page
  // (e.g. arxiv.org/pdf/xxxx) after right-clicking → "Impulse 高亮". The highlight
  // was saved to storage with the original PDF URL as key; when the viewer loads,
  // we read those highlights and apply them to the text layer.
  useEffect(() => {
    if (!state.pdfDoc || state.loading || !originalPdfUrl) return
    let cancelled = false

    const loadSavedHighlights = async () => {
      try {
        const STORAGE_KEY = "impulse_highlights"
        const result = await chrome.storage.local.get(STORAGE_KEY)
        const allHighlights = result[STORAGE_KEY] || []
        // Match highlights whose url matches the original PDF URL
        const saved = allHighlights.filter(
          (h: any) => h.url === originalPdfUrl && h.phrase
        )
        if (cancelled || saved.length === 0) return

        const injections: InjectionPayload[] = saved.map((h: any) => ({
          id: h.id,
          phrase: h.phrase,
          category: h.category || "default",
          color: h.color || "#fed7aa"
        }))

        setAppliedHighlights((prev) => {
          // Merge: avoid duplicates by id
          const existingIds = new Set(prev.map((p) => p.id))
          const merged = [...prev, ...injections.filter((i) => !existingIds.has(i.id))]
          return merged
        })
      } catch (e) {
        console.error("[Impulse PDF Viewer] Failed to load saved highlights:", e)
      }
    }

    void loadSavedHighlights()
    return () => { cancelled = true }
  }, [state.pdfDoc, state.loading, originalPdfUrl])

  // ─── Highlight functions ────────────────────────────────────────────────────

  const applyHighlightsToTextLayer = useCallback((injections: InjectionPayload[]): number => {
    if (!textLayerRef.current) return 0

    // Clear existing highlights first
    clearHighlightsFromTextLayer()

    const textLayer = textLayerRef.current
    const spans = Array.from(textLayer.querySelectorAll<HTMLSpanElement>("span[data-text]"))
    let count = 0

    // Build a concatenated text map to find phrase matches across spans
    // Strategy: for each injection phrase, find spans whose text contains the phrase
    // and highlight them. Also handle cross-span matches by merging adjacent spans.
    for (const injection of injections) {
      const lowerPhrase = injection.phrase.toLowerCase()

      // Simple case: phrase is within a single span
      for (const span of spans) {
        const text = span.dataset.text || span.textContent || ""
        if (text.toLowerCase().includes(lowerPhrase)) {
          span.classList.add(HIGHLIGHT_CLASS)
          span.setAttribute("data-impulse-id", injection.id)
          if (injection.category) {
            span.setAttribute("data-impulse-category", injection.category)
          }
          // Semi-transparent background so the PDF text underneath remains visible.
          // mix-blend-mode: multiply blends the highlight color with the canvas
          // text instead of covering it. Do NOT set color:transparent — the text
          // layer is already transparent and only used for selection.
          span.style.backgroundColor = withAlpha(injection.color, 0.4)
          span.style.mixBlendMode = "multiply"
          span.style.borderRadius = "2px"
          span.style.padding = "0 1px"
          count++
        }
      }

      // Cross-span case: try to find phrase that spans multiple consecutive spans
      // Build full text with span index mapping
      if (count === 0) {
        const fullText = spans.map((s) => s.dataset.text || "").join("")
        const lowerFull = fullText.toLowerCase()
        const idx = lowerFull.indexOf(lowerPhrase)
        if (idx !== -1) {
          // Find which spans overlap with [idx, idx + phrase.length)
          let charPos = 0
          const startIdx = idx
          const endIdx = idx + injection.phrase.length
          for (const span of spans) {
            const spanText = span.dataset.text || ""
            const spanStart = charPos
            const spanEnd = charPos + spanText.length
            if (spanEnd > startIdx && spanStart < endIdx) {
              span.classList.add(HIGHLIGHT_CLASS)
              span.setAttribute("data-impulse-id", injection.id)
              if (injection.category) {
                span.setAttribute("data-impulse-category", injection.category)
              }
              span.style.backgroundColor = withAlpha(injection.color, 0.4)
              span.style.mixBlendMode = "multiply"
              span.style.borderRadius = "2px"
              span.style.padding = "0 1px"
              count++
            }
            charPos = spanEnd
          }
        }
      }
    }

    // Inject focus-flash keyframes once
    if (!document.getElementById("impulse-hl-focus-style")) {
      const style = document.createElement("style")
      style.id = "impulse-hl-focus-style"
      style.textContent = `
        @keyframes impulse-hl-flash {
          0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); outline: 2px solid transparent; }
          30%  { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.65); outline: 2px solid #f59e0b; }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); outline: 2px solid transparent; }
        }
        .impulse-hl-focus { animation: impulse-hl-flash 1.2s ease-out 2; z-index: 5; position: relative; }
      `
      document.head.appendChild(style)
    }

    return count
  }, [])

  const clearHighlightsFromTextLayer = useCallback(() => {
    if (!textLayerRef.current) return
    const highlighted = textLayerRef.current.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`)
    for (const el of highlighted) {
      el.classList.remove(HIGHLIGHT_CLASS, FOCUS_CLASS)
      el.removeAttribute("data-impulse-id")
      el.removeAttribute("data-impulse-category")
      el.style.backgroundColor = ""
      el.style.mixBlendMode = ""
      el.style.borderRadius = ""
      el.style.padding = ""
    }
  }, [])

  const focusHighlight = useCallback((highlightId: string): boolean => {
    if (!textLayerRef.current) return false

    // Remove previous focus markers
    const prevFocused = textLayerRef.current.querySelectorAll<HTMLElement>(`.${FOCUS_CLASS}`)
    for (const el of prevFocused) {
      el.classList.remove(FOCUS_CLASS)
    }

    const targets = textLayerRef.current.querySelectorAll<HTMLElement>(`[data-impulse-id="${CSS.escape(highlightId)}"]`)
    if (targets.length === 0) return false

    const first = targets[0]
    first.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => {
      first.classList.add(FOCUS_CLASS)
      setTimeout(() => first.classList.remove(FOCUS_CLASS), 2600)
    }, 250)

    return true
  }, [])

  // ─── Listen for messages from sidebar ───────────────────────────────────────

  useEffect(() => {
    const handleMessage = (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === "APPLY_HIGHLIGHTS") {
        try {
          const injections = (message.injections || []) as InjectionPayload[]
          if (injections.length === 0) {
            sendResponse({ success: false, count: 0, error: "没有可应用的高亮" })
            return true
          }

          // Merge new injections into appliedHighlights state (so they persist
          // across page re-renders). Deduplicate by id.
          setAppliedHighlights((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const merged = [...prev, ...injections.filter((i) => !existingIds.has(i.id))]
            return merged
          })

          // Try to apply immediately. If the text layer isn't ready (PDF still
          // loading or rendering), the highlights will be applied automatically
          // when renderPage completes, because it re-applies appliedHighlights.
          const count = applyHighlightsToTextLayer(injections)

          // If count is 0, the text layer may not be ready yet. Try a few retries
          // with a short delay — the text layer is populated asynchronously.
          if (count === 0) {
            let retries = 0
            const maxRetries = 5
            const retryDelay = 300
            const tryApply = () => {
              retries++
              const retryCount = applyHighlightsToTextLayer(injections)
              if (retryCount > 0) {
                sendResponse({ success: true, count: retryCount })
              } else if (retries < maxRetries) {
                setTimeout(tryApply, retryDelay)
              } else {
                // Text layer still not ready — but highlights are saved in state
                // and will be applied when renderPage finishes. Report success
                // so the caller (agent/sidebar) doesn't treat it as a failure.
                sendResponse({
                  success: true,
                  count: 0,
                  note: "文本层尚未就绪，高亮将在页面渲染完成后自动应用"
                })
              }
            }
            setTimeout(tryApply, retryDelay)
            return true // keep the message channel open for the async retry
          }

          sendResponse({ success: true, count })
        } catch (e: any) {
          sendResponse({ success: false, error: e?.message ?? String(e) })
        }
        return true
      } else if (message.type === "CLEAR_HIGHLIGHTS") {
        try {
          clearHighlightsFromTextLayer()
          setAppliedHighlights([])
          sendResponse({ success: true })
        } catch (e: any) {
          sendResponse({ success: false, error: e?.message ?? String(e) })
        }
        return true
      } else if (message.type === "FOCUS_HIGHLIGHT") {
        try {
          const found = focusHighlight(message.highlightId as string)
          sendResponse({ success: found })
        } catch (e: any) {
          sendResponse({ success: false, error: e?.message ?? String(e) })
        }
        return true
      }
      return false
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [applyHighlightsToTextLayer, clearHighlightsFromTextLayer, focusHighlight])

  // ─── Push text selection to sidebar in real-time ────────────────────────────
  // Listen for selectionchange (fires frequently during drag-selection) and
  // debounce, then send the selected text to the sidebar via runtime message.
  // This gives near-instant feedback instead of waiting for the 2s poll.
  useEffect(() => {
    let debounceTimer: number | null = null

    const pushSelection = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer)
      }
      debounceTimer = window.setTimeout(() => {
        const selection = window.getSelection()?.toString().trim() ?? ""
        // Only send non-empty selections (empty = user cleared, sidebar poll will catch up)
        if (selection.length > 0) {
          chrome.runtime
            .sendMessage({
              type: "PDF_VIEWER_SELECTION",
              text: selection,
              url: originalPdfUrl
            })
            .catch(() => {
              // Sidebar might not be open; silently ignore
            })
        }
      }, 250)
    }

    document.addEventListener("selectionchange", pushSelection)
    // Also listen for mouseup to catch final selection state
    document.addEventListener("mouseup", pushSelection)

    return () => {
      document.removeEventListener("selectionchange", pushSelection)
      document.removeEventListener("mouseup", pushSelection)
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer)
      }
    }
  }, [originalPdfUrl])

  // ─── Navigation handlers ────────────────────────────────────────────────────

  const goToPrevPage = () => {
    if (state.pageNum > 1 && !state.rendering) {
      setState((s) => ({ ...s, pageNum: s.pageNum - 1 }))
    }
  }

  const goToNextPage = () => {
    if (state.pageNum < state.numPages && !state.rendering) {
      setState((s) => ({ ...s, pageNum: s.pageNum + 1 }))
    }
  }

  const zoomIn = () => {
    setState((s) => ({ ...s, scale: Math.min(s.scale + 0.2, 3.0) }))
  }

  const zoomOut = () => {
    setState((s) => ({ ...s, scale: Math.max(s.scale - 0.2, 0.5) }))
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#0d9488" }} />
        <div style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>Loading PDF...</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={32} color="#ef4444" />
        <div style={{ marginTop: 12, fontSize: 14, color: "#ef4444", textAlign: "center", maxWidth: 400 }}>
          {state.error}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>URL: {originalPdfUrl}</div>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <Highlighter size={16} color="#0d9488" />
          <span style={styles.toolbarTitle}>Impulse PDF Viewer</span>
        </div>
        <div style={styles.toolbarCenter}>
          <button
            onClick={goToPrevPage}
            disabled={state.pageNum <= 1 || state.rendering}
            style={styles.iconBtn}
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span style={styles.pageInfo}>
            {state.pageNum} / {state.numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={state.pageNum >= state.numPages || state.rendering}
            style={styles.iconBtn}
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
          <div style={styles.divider} />
          <button onClick={zoomOut} disabled={state.scale <= 0.5} style={styles.iconBtn} title="Zoom out">
            <ZoomOut size={18} />
          </button>
          <span style={styles.zoomInfo}>{Math.round(state.scale * 100)}%</span>
          <button onClick={zoomIn} disabled={state.scale >= 3.0} style={styles.iconBtn} title="Zoom in">
            <ZoomIn size={18} />
          </button>
        </div>
        <div style={styles.toolbarRight}>
          {state.rendering && <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "#9ca3af" }} />}
        </div>
      </div>

      {/* PDF rendering area */}
      <div ref={containerRef} style={styles.pdfContainer}>
        <div style={styles.pageWrapper}>
          <canvas ref={canvasRef} style={styles.canvas} />
          <div ref={textLayerRef} className="textLayer" style={styles.textLayer} />
        </div>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    background: "#525659",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: "hidden"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    background: "#f9fafb"
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    background: "#fef2f2",
    padding: 20
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "#1f2937",
    color: "#f9fafb",
    borderBottom: "1px solid #374151",
    flexShrink: 0,
    zIndex: 10
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 200
  },
  toolbarTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0d9488"
  },
  toolbarCenter: {
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  toolbarRight: {
    minWidth: 200,
    display: "flex",
    justifyContent: "flex-end"
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: "#e5e7eb",
    cursor: "pointer",
    padding: 6,
    borderRadius: 4,
    transition: "background 0.15s"
  },
  pageInfo: {
    fontSize: 13,
    fontWeight: 500,
    minWidth: 60,
    textAlign: "center" as const,
    color: "#e5e7eb"
  },
  zoomInfo: {
    fontSize: 12,
    minWidth: 40,
    textAlign: "center" as const,
    color: "#9ca3af"
  },
  divider: {
    width: 1,
    height: 20,
    background: "#374151",
    margin: "0 4px"
  },
  pdfContainer: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    justifyContent: "center",
    padding: 20
  },
  pageWrapper: {
    position: "relative",
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    borderRadius: 2
  },
  canvas: {
    display: "block",
    background: "white"
  },
  textLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
    lineHeight: 1,
    opacity: 1,
    pointerEvents: "auto" as const
  }
}

export default PdfViewer
