import type { ChatMessage, PaperMetadata } from "~types"
import type { Highlight, Note } from "~utils/storage/storage"

export function generateMarkdown(
  metadata: PaperMetadata | null,
  notes: Note[],
  highlights: Highlight[],
  chatMessages?: ChatMessage[]
): string {
  const lines: string[] = []
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  // Title
  if (metadata?.title) {
    lines.push(`# ${metadata.title}`)
    if (metadata.authors.length > 0) {
      lines.push(`**Authors:** ${metadata.authors.join(", ")}`)
    }
    if (metadata.year) lines.push(`**Year:** ${metadata.year}`)
    if (metadata.journal) lines.push(`**Journal:** ${metadata.journal}`)
    if (metadata.doi) lines.push(`**DOI:** ${metadata.doi}`)
    lines.push("")
  } else {
    lines.push("# Paper Notes")
    lines.push("")
  }

  lines.push(`*Exported from Impulse on ${now}*`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Highlights
  if (highlights.length > 0) {
    lines.push("## Highlights")
    lines.push("")
    for (const h of highlights) {
      lines.push(`- **${h.phrase}**`)
    }
    lines.push("")
  }

  // Notes
  if (notes.length > 0) {
    lines.push("## Notes")
    lines.push("")
    for (const note of notes) {
      if (note.selectedText) {
        lines.push(`> ${note.selectedText.slice(0, 300)}`)
        lines.push("")
      }
      lines.push(note.comment)
      lines.push("")
      lines.push(`*${new Date(note.timestamp).toLocaleString()}*`)
      lines.push("")
      lines.push("---")
      lines.push("")
    }
  }

  // Chat Q&A
  if (chatMessages && chatMessages.length > 0) {
    lines.push("## Q&A History")
    lines.push("")
    for (const msg of chatMessages) {
      if (msg.role === "user") {
        lines.push(`**Q:** ${msg.content}`)
      } else {
        lines.push(`**A:** ${msg.content}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
