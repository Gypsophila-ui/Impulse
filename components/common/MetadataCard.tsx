import React from "react"
import { borderRadius } from "~utils/ui/design-tokens"
import { FileText, Sparkles } from "lucide-react"

import type { PaperMetadata } from "~types"
import { extractMetadata } from "~utils/agent/llm-client"
import { saveMetadata } from "~utils/storage/storage"
import { trackEvent } from "~utils/reading/reading-tracker"

interface MetadataCardProps {
  metadata: PaperMetadata | null
  metadataExpanded: boolean
  selectedText: string
  hasKey: boolean
  currentUrl: string
  extractingMetadata: boolean
  onSetMetadata: (metadata: PaperMetadata | null) => void
  onSetMetadataExpanded: (expanded: boolean) => void
  onSetExtractingMetadata: (loading: boolean) => void
  onSetError: (error: string | null) => void
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onClearMessage: () => void
}

const MetadataCard: React.FC<MetadataCardProps> = ({
  metadata,
  metadataExpanded,
  selectedText,
  hasKey,
  currentUrl,
  extractingMetadata,
  onSetMetadata,
  onSetMetadataExpanded,
  onSetExtractingMetadata,
  onSetError,
  onShowMessage,
  onClearMessage
}) => {
  const handleExtractMetadata = async () => {
    if (!selectedText.trim()) {
      onSetError("Please select paper header text first, then refresh")
      return
    }
    if (!hasKey) {
      onSetError("Please configure API Key first")
      return
    }
    onSetExtractingMetadata(true)
    try {
      const result = await extractMetadata(selectedText)
      onSetMetadata(result)
      await saveMetadata(currentUrl, result)
      onSetMetadataExpanded(true)
      trackEvent("metadata", { title: result.title, authors: result.authors?.length })
    } catch (e: any) {
      onSetError(`Metadata extraction failed: ${e?.message ?? String(e)}`)
    } finally {
      onSetExtractingMetadata(false)
    }
  }

  const handleCopyCitation = () => {
    if (!metadata) return
    const citation = `${metadata.authors.join(", ")} (${metadata.year}). ${metadata.title}. ${metadata.journal}.${metadata.doi ? ` DOI: ${metadata.doi}` : ""}`
    navigator.clipboard.writeText(citation)
    onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Citation copied!</>, "success")
    setTimeout(() => onClearMessage(), 2000)
  }

  if (metadata) {
    return (
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: borderRadius.sm,
          background: "#fff",
          overflow: "hidden",
          marginBottom: 4
        }}>
        <button
          onClick={() => onSetMetadataExpanded(!metadataExpanded)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            fontWeight: 600,
            color: "#374151"
          }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> {metadata.title || "Paper Metadata"}
          </span>
          <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 8 }}>
            {metadataExpanded ? "▲" : "▼"}
          </span>
        </button>
        {metadataExpanded && (
          <div style={{ padding: "0 12px 10px", fontSize: 12, color: "#6b7280", lineHeight: "20px" }}>
            {metadata.authors.length > 0 && (
              <div><strong>Authors:</strong> {metadata.authors.join(", ")}</div>
            )}
            {metadata.year && <div><strong>Year:</strong> {metadata.year}</div>}
            {metadata.journal && <div><strong>Journal:</strong> {metadata.journal}</div>}
            {metadata.doi && <div><strong>DOI:</strong> {metadata.doi}</div>}
            <button
              onClick={handleCopyCitation}
              style={{
                marginTop: 6,
                padding: "4px 10px",
                fontSize: 11,
                background: "#f0fdfa",
                color: "#0d9488",
                border: "1px solid #5eead4",
                borderRadius: borderRadius.xs,
                cursor: "pointer",
                fontWeight: 600
              }}>
              Copy Citation
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleExtractMetadata}
      disabled={extractingMetadata}
      style={{
        width: "100%",
        padding: "6px 12px",
        fontSize: 11,
        background: "#f9fafb",
        color: "#6b7280",
        border: "1px dashed #d1d5db",
        borderRadius: borderRadius.sm,
        cursor: extractingMetadata ? "not-allowed" : "pointer",
        fontWeight: 600,
        marginBottom: 4
      }}>
      {extractingMetadata ? "Extracting..." : (<><FileText size={14} style={{ marginRight: 4, color: "#0d9488" }} /> Extract Paper Metadata</>)}
    </button>
  )
}

export default MetadataCard
