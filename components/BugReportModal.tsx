import React, { useCallback, useEffect, useRef, useState } from "react"
import { Bug, ChevronDown, ChevronRight, Copy, Download, Sparkles, Wrench, X } from "lucide-react"
import type { PaperMetadata, ReadingGoal } from "~types"
import type { AppMode, TabKey } from "~components/common/Header"
import { borderRadius } from "~utils/ui/design-tokens"
import {
  collectBugReport,
  diagnoseWithAI,
  downloadBugReport,
  type BugReport,
  type DiagnosisResult
} from "~utils/bug-report"
import Spinner from "./common/Spinner"

type FixAction = DiagnosisResult["autoFixAction"]

interface BugReportModalProps {
  show: boolean
  onClose: () => void
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
  error: string | null
  onApplyFix: (action: FixAction, params: Record<string, unknown>) => Promise<boolean>
}

const FIX_LABELS: Record<FixAction, string> = {
  clear_data: "Clear Corrupted Data",
  reset_config: "Reset API Configuration",
  retry: "Retry Operation",
  switch_model: "Switch to Fallback Model",
  none: ""
}

const BugReportModal: React.FC<BugReportModalProps> = ({
  show,
  onClose,
  mode,
  activeTab,
  lang,
  theme,
  readingGoal,
  currentUrl,
  currentTitle,
  selectedText,
  metadata,
  currentTabId,
  notesCount,
  highlightsCount,
  chatMessagesCount,
  error,
  onApplyFix
}) => {
  const [userDescription, setUserDescription] = useState("")
  const [report, setReport] = useState<BugReport | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [pageInfo, setPageInfo] = useState<Record<string, unknown> | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{ success: boolean; message: string } | null>(null)
  const hasRunRef = useRef(false)

  const buildReport = useCallback(async (description: string, pi?: Record<string, unknown>) => {
    const r = await collectBugReport({
      mode,
      activeTab,
      lang,
      theme,
      readingGoal,
      currentUrl,
      currentTitle,
      selectedText,
      metadata,
      currentTabId,
      notesCount,
      highlightsCount,
      chatMessagesCount,
      userDescription: description,
      pageInfo: pi
    })
    setReport(r)
    return r
  }, [mode, activeTab, lang, theme, readingGoal, currentUrl, currentTitle, selectedText, metadata, currentTabId, notesCount, highlightsCount, chatMessagesCount])

  // Track previous page to detect navigation while modal is open
  const prevUrlRef = useRef(currentUrl)

  // Collect context silently on open, and rebuild when page changes
  useEffect(() => {
    if (!show) {
      hasRunRef.current = false
      setUserDescription("")
      setDiagnosis(null)
      setDiagnosisError(null)
      setFixResult(null)
      prevUrlRef.current = currentUrl
      return
    }
    if (hasRunRef.current && currentUrl === prevUrlRef.current) return
    hasRunRef.current = true

    const isPageChange = prevUrlRef.current !== currentUrl
    prevUrlRef.current = currentUrl

    if (isPageChange) {
      setDiagnosis(null)
      setDiagnosisError(null)
      setFixResult(null)
    }

    const init = async () => {
      let pi: Record<string, unknown> | undefined
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_PAGE_INFO" })
          if (response && !response.error) {
            pi = response as Record<string, unknown>
          }
        }
      } catch {
        // Content script may not be injected
      }
      setPageInfo(pi)
      // Build report silently for preview, but don't analyze
      await buildReport(userDescription, pi)
    }

    void init()
  }, [show, currentUrl])

  const handleAnalyze = async () => {
    setDiagnosing(true)
    setDiagnosisError(null)
    setDiagnosis(null)
    setFixResult(null)
    try {
      // Rebuild with latest description before analyzing
      const r = await buildReport(userDescription, pageInfo)
      const result = await diagnoseWithAI(r)
      setDiagnosis(result)
    } catch (e: any) {
      setDiagnosisError(e?.message || String(e))
    } finally {
      setDiagnosing(false)
    }
  }

  const handleApplyFix = async () => {
    if (!diagnosis || diagnosis.autoFixAction === "none") return
    setFixing(true)
    setFixResult(null)
    try {
      const success = await onApplyFix(diagnosis.autoFixAction, diagnosis.autoFixParams)
      setFixResult({
        success,
        message: success
          ? "Fix applied successfully! The issue should be resolved."
          : "The fix could not be applied. Please try manual steps or download the report."
      })
    } catch (e: any) {
      setFixResult({
        success: false,
        message: `Fix failed: ${e?.message || String(e)}`
      })
    } finally {
      setFixing(false)
    }
  }

  const handleCopy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleDownload = () => {
    if (!report) return
    downloadBugReport(report)
  }

  if (!show) return null

  const summaryKeys: Array<{ key: string; label: string; value: string }> = [
    { key: "url", label: "URL", value: currentUrl || "(none)" },
    { key: "mode", label: "Mode", value: mode },
    { key: "tab", label: "Active Tab", value: activeTab },
    { key: "hasKey", label: "API Key", value: report?.config.hasApiKey ? "Yes" : "No" },
    { key: "error", label: "Current Error", value: error || "(none)" },
    { key: "notes", label: "Notes", value: String(notesCount) },
    { key: "highlights", label: "Highlights", value: String(highlightsCount) },
    { key: "chat", label: "Chat Msgs", value: String(chatMessagesCount) },
    { key: "console", label: "Console Logs", value: `${report?.console.length || 0} entries` },
    { key: "errors", label: "Captured Errors", value: `${report?.errors.length || 0} errors` }
  ]

  const hasDiagnosis = diagnosis || diagnosing || diagnosisError

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}>
      <div
        style={{
          background: "#fff",
          borderRadius: borderRadius.lg,
          width: "100%",
          maxWidth: 400,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease"
        }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
            padding: "14px 20px",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>
            <Bug size={17} /> Report a Bug
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: 4,
              opacity: 0.8
            }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          {/* Description textarea */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 12,
                color: "#374151",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              Describe the bug
            </label>
            <textarea
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              placeholder="What were you doing? What went wrong? What did you expect to happen? Or you can start analyzing directly based on the known information."
              rows={4}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 13,
                border: "2px solid #e5e7eb",
                borderRadius: borderRadius.sm,
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: "18px",
                outline: "none"
              }}
            />
          </div>

          {/* Analyze button (before diagnosis) or results (after diagnosis) */}
          {!hasDiagnosis ? (
            <button
              onClick={handleAnalyze}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 700,
                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                color: "#fff",
                border: "none",
                borderRadius: borderRadius.sm,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
                marginBottom: 12
              }}>
              <Sparkles size={16} /> Analyze with AI
            </button>
          ) : diagnosing ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                background: "#f0fdfa",
                borderRadius: borderRadius.sm,
                marginBottom: 12,
                border: "1px solid #ccfbf1"
              }}>
              <div style={{ marginBottom: 12 }}>
                <Spinner />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f766e", marginBottom: 4 }}>
                AI is analyzing...
              </div>
              <div style={{ fontSize: 12, color: "#0d9488" }}>
                Examining console logs, errors, and component state
              </div>
            </div>
          ) : diagnosisError ? (
            <div
              style={{
                padding: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: borderRadius.sm,
                marginBottom: 12,
                fontSize: 13,
                color: "#991b1b"
              }}>
              <strong>Analysis failed:</strong> {diagnosisError}
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={handleAnalyze}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#0d9488",
                    color: "#fff",
                    border: "none",
                    borderRadius: borderRadius.xs,
                    cursor: "pointer"
                  }}>
                  Retry
                </button>
              </div>
            </div>
          ) : diagnosis ? (
            <div style={{ marginBottom: 12 }}>
              {/* Affected Component */}
              {diagnosis.affectedComponent && diagnosis.affectedComponent !== "Unknown" && (
                <div
                  style={{
                    padding: 12,
                    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                    border: "1px solid #93c5fd",
                    borderRadius: borderRadius.sm,
                    marginBottom: 10
                  }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#1d4ed8",
                      marginBottom: 6
                    }}>
                       Affected Component
                    </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        background: "#3b82f6",
                        color: "#fff",
                        borderRadius: "12px",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "monospace"
                      }}>
                      {diagnosis.affectedComponent}
                    </span>
                    {diagnosis.affectedFile && diagnosis.affectedFile !== "unknown" && (
                      <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                        {diagnosis.affectedFile}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Root Cause */}
              <div
                style={{
                  padding: 14,
                  background: "#fefce8",
                  border: "1px solid #fde68a",
                  borderRadius: borderRadius.sm,
                  marginBottom: 10
                }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#a16207",
                    marginBottom: 6
                  }}>
                  <Bug size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Root Cause
                </div>
                <div style={{ fontSize: 13, color: "#713f12", lineHeight: "18px" }}>
                  {diagnosis.rootCause}
                </div>
              </div>

              {/* Suggested Fix */}
              <div
                style={{
                  padding: 14,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: borderRadius.sm,
                  marginBottom: 10
                }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#166534",
                    marginBottom: 6
                  }}>
                  <Wrench size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Suggested Fix
                </div>
                <div style={{ fontSize: 13, color: "#14532d", lineHeight: "18px" }}>
                  {diagnosis.suggestedFix}
                </div>
              </div>

              {/* Fix Result */}
              {fixResult && (
                <div
                  style={{
                    padding: 12,
                    background: fixResult.success ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${fixResult.success ? "#bbf7d0" : "#fecaca"}`,
                    borderRadius: borderRadius.sm,
                    marginBottom: 10,
                    fontSize: 12,
                    color: fixResult.success ? "#166534" : "#991b1b",
                    lineHeight: "17px"
                  }}>
                  {fixResult.success ? "✓ " : "✗ "}
                  {fixResult.message}
                </div>
              )}

              {/* Apply Fix Button */}
              {diagnosis.autoFixAction !== "none" && !fixResult?.success && (
                <button
                  onClick={handleApplyFix}
                  disabled={fixing}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    background: fixing
                      ? "#cbd5e1"
                      : "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: borderRadius.sm,
                    cursor: fixing ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "all 0.2s"
                  }}>
                  {fixing ? (
                    <>
                      <Spinner /> Applying...
                    </>
                  ) : (
                    <>
                      <Wrench size={14} /> {FIX_LABELS[diagnosis.autoFixAction]}
                    </>
                  )}
                </button>
              )}

              {/* Re-analyze */}
              <button
                onClick={handleAnalyze}
                disabled={diagnosing}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#f0fdfa",
                  color: "#0d9488",
                  border: "1px solid #99f6e4",
                  borderRadius: borderRadius.sm,
                  cursor: diagnosing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4
                }}>
                <Sparkles size={12} /> Re-analyze
              </button>
            </div>
          ) : null}

          {/* Collapsible detail section */}
          <div>
            <button
              onClick={() => setShowDetail(!showDetail)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              {showDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Collected Data Preview
            </button>
            {showDetail && (
              <div>
                <div
                  style={{
                    background: "#f9fafb",
                    borderRadius: borderRadius.sm,
                    padding: 10,
                    fontSize: 12,
                    fontFamily: "monospace",
                    maxHeight: 160,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    lineHeight: "18px",
                    marginBottom: 12
                  }}>
                  {summaryKeys.map((item) => (
                    <div key={item.key} style={{ marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ color: "#6b7280", minWidth: 85, flexShrink: 0 }}>{item.label}:</span>
                      <span
                        style={{
                          color: item.key === "error" && item.value !== "(none)" ? "#dc2626" : "#374151",
                          wordBreak: "break-all"
                        }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Code Context Display */}
                {report?.codeContext && report.codeContext.snippets.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#0f766e",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                      Code Context
                    </div>
                    <div
                      style={{
                        background: "#1f2937",
                        borderRadius: borderRadius.sm,
                        padding: 10,
                        maxHeight: 200,
                        overflow: "auto"
                      }}>
                      {report.codeContext.snippets.map((snippet, idx) => (
                        <div key={idx} style={{ marginBottom: idx < report.codeContext.snippets.length - 1 ? 10 : 0 }}>
                          <div
                            style={{
                              color: "#6ee7b7",
                              fontSize: 10,
                              marginBottom: 4,
                              fontFamily: "monospace"
                            }}>
                            {snippet.file}:{snippet.line}
                            {snippet.functionName && ` in ${snippet.functionName}`}
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                            {snippet.linesBefore.map((line, i) => (
                              <div key={`before-${i}`} style={{ color: "#9ca3af" }}>
                                {Math.max(1, snippet.line - snippet.linesBefore.length) + i} | {line}
                              </div>
                            ))}
                            <div style={{ color: "#fca5a5", background: "rgba(248,113,113,0.1)" }}>
                              {snippet.line} | {snippet.code} ← ERROR
                            </div>
                            {snippet.linesAfter.map((line, i) => (
                              <div key={`after-${i}`} style={{ color: "#9ca3af" }}>
                                {snippet.line + 1 + i} | {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleDownload}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: borderRadius.sm,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}>
                    <Download size={12} /> Download JSON
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: copied ? "#d1fae5" : "#f3f4f6",
                      color: copied ? "#065f46" : "#374151",
                      border: "2px solid #e5e7eb",
                      borderRadius: borderRadius.sm,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      transition: "all 0.2s"
                    }}>
                    <Copy size={12} /> {copied ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BugReportModal
