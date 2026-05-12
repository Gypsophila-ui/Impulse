import React from "react"
import { borderRadius } from "~utils/design-tokens"
import { AlertTriangle, FileText, MessageSquare, Pencil, Save, Sparkles, Trash2, X } from "lucide-react"

import type { Note } from "~utils/storage"
import { deleteNote, saveNote, updateNote } from "~utils/storage"
import { recordComponentEvent } from "~utils/bug-report"

import Spinner from "../common/Spinner"

interface NotesTabProps {
  selectedText: string
  output: React.ReactNode
  outputType: string
  commentDraft: string
  savingNote: boolean
  editingNoteId: string | null
  notes: Note[]
  currentUrl: string
  currentTitle: string
  colors: {
    textSecondary: string
    border: string
    cardBg: string
    text: string
  }
  onShowMessage: (message: React.ReactNode, type: "success" | "error" | "warning") => void
  onClearMessage: () => void
  onSetSavingNote: (saving: boolean) => void
  onSetCommentDraft: (draft: string) => void
  onSetEditingNoteId: (id: string | null) => void
  onLoadNotes: () => Promise<void>
}

const NotesTab: React.FC<NotesTabProps> = ({
  selectedText,
  output,
  outputType,
  commentDraft,
  savingNote,
  editingNoteId,
  notes,
  currentUrl,
  currentTitle,
  colors,
  onShowMessage,
  onClearMessage,
  onSetSavingNote,
  onSetCommentDraft,
  onSetEditingNoteId,
  onLoadNotes
}) => {
  const canUseSelection = selectedText.trim().length > 0

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleSaveNote = async () => {
    if (editingNoteId) {
      try {
        onSetSavingNote(true)
        recordComponentEvent("NotesTab", "note_update", editingNoteId)
        await updateNote(editingNoteId, commentDraft.trim())
        onSetCommentDraft("")
        onSetEditingNoteId(null)
        await onLoadNotes()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note updated successfully!</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to update note: {e?.message ?? String(e)}</>, "error")
        recordComponentEvent("NotesTab", "note_update_error", e?.message || String(e))
      } finally {
        onSetSavingNote(false)
      }
    } else {
      if (!canUseSelection) {
        onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please select text first</>, "warning")
        return
      }
      if (!commentDraft.trim()) {
        onShowMessage(<><AlertTriangle size={14} style={{ marginRight: 4, color: "#f59e0b" }} /> Please write a note</>, "warning")
        return
      }
      try {
        onSetSavingNote(true)
        recordComponentEvent("NotesTab", "note_save", `chars=${selectedText.length}`)
        await saveNote(
          selectedText.trim(),
          commentDraft.trim(),
          currentUrl,
          currentTitle
        )
        onSetCommentDraft("")
        await onLoadNotes()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note saved successfully!</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to save note: {e?.message ?? String(e)}</>, "error")
        recordComponentEvent("NotesTab", "note_save_error", e?.message || String(e))
      } finally {
        onSetSavingNote(false)
      }
    }
  }

  const handleDeleteNote = async (note: Note) => {
    if (confirm("Delete this note?")) {
      try {
        await deleteNote(note.id)
        await onLoadNotes()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> Note deleted</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete: {e?.message ?? String(e)}</>, "error")
      }
    }
  }

  const handleClearAll = async () => {
    if (confirm(`Delete all ${notes.length} notes for this page?`)) {
      try {
        await Promise.all(notes.map((note) => deleteNote(note.id)))
        await onLoadNotes()
        onShowMessage(<><Sparkles size={14} style={{ marginRight: 4, color: "#10b981" }} /> All notes deleted</>, "success")
        setTimeout(() => onClearMessage(), 2000)
      } catch (e: any) {
        onShowMessage(<><X size={14} style={{ marginRight: 4, color: "#ef4444" }} /> Failed to delete notes: {e?.message ?? String(e)}</>, "error")
      }
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div
        style={{
          color: "#6b7280",
          fontSize: 11,
          marginBottom: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}
      >
        <Pencil size={12} style={{ marginRight: 4, color: "#6b7280" }} /> {editingNoteId ? "Edit Note" : "New Note"}
      </div>

      <textarea
        value={commentDraft}
        onChange={(e) => onSetCommentDraft(e.target.value)}
        placeholder="Write your thoughts, questions, or key points here..."
        style={{
          width: "100%",
          minHeight: 100,
          fontSize: 13,
          lineHeight: "20px",
          resize: "vertical",
          boxSizing: "border-box",
          padding: 12,
          border: `2px solid ${colors.border}`,
          borderRadius: borderRadius.md,
          background: colors.cardBg,
          color: "#374151",
          fontFamily: "inherit",
          transition: "border-color 0.2s ease",
          outline: "none"
        }}
        onFocus={(e) => (e.target.style.borderColor = "#f43f5e")}
        onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          disabled={
            (editingNoteId ? false : !canUseSelection) ||
            !commentDraft.trim() ||
            savingNote
          }
          className="btn-hover"
          onClick={handleSaveNote}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: borderRadius.md,
            background:
              ((editingNoteId ? true : canUseSelection) &&
                commentDraft.trim() &&
                !savingNote)
                ? "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)"
                : "#cbd5e1",
            color: "#fff",
            border: "none",
            cursor:
              ((editingNoteId ? true : canUseSelection) &&
                commentDraft.trim() &&
                !savingNote)
                ? "pointer"
                : "not-allowed",
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow:
              ((editingNoteId ? true : canUseSelection) &&
                commentDraft.trim() &&
                !savingNote)
                ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                : "none"
          }}
        >
          {savingNote ? (
            <>
              <Spinner /> Saving...
            </>
          ) : editingNoteId ? (
            <><Save size={14} /> Update Note</>
          ) : (
            <><Save size={14} /> Save Note</>
          )}
        </button>

        {editingNoteId && (
          <button
            disabled={savingNote}
            onClick={() => {
              onSetEditingNoteId(null)
              onSetCommentDraft("")
            }}
            style={{
              padding: "12px 16px",
              borderRadius: borderRadius.md,
              background: colors.cardBg,
              color: "#6b7280",
              border: `2px solid ${colors.border}`,
              cursor: savingNote ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              transition: "all 0.2s ease"
            }}
          >
            <X size={14} /> Cancel
          </button>
        )}

        {!editingNoteId && (
          <button
            disabled={!commentDraft.trim()}
            onClick={() => onSetCommentDraft("")}
            style={{
              padding: "12px 16px",
              borderRadius: borderRadius.md,
              background: colors.cardBg,
              color: "#6b7280",
              border: `2px solid ${colors.border}`,
              cursor: commentDraft.trim() ? "pointer" : "not-allowed",
              fontWeight: 600,
              fontSize: 13,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              if (commentDraft.trim()) {
                e.currentTarget.style.borderColor = "#f87171"
                e.currentTarget.style.color = "#ef4444"
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb"
              e.currentTarget.style.color = "#6b7280"
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {output && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: borderRadius.sm,
            background: outputType === "success" ? "#d1fae5" : "#fee2e2",
            color: outputType === "success" ? "#065f46" : "#991b1b",
            fontSize: 12,
            animation: "fadeIn 0.3s ease"
          }}
        >
          {output}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div
          style={{
            color: "#6b7280",
            fontSize: 11,
            marginBottom: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span><FileText size={12} style={{ marginRight: 4, color: "#6b7280" }} /> Saved Notes ({notes.length})</span>
          {notes.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                padding: 4
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <div
            style={{
              padding: 20,
              border: `2px dashed ${colors.border}`,
              borderRadius: borderRadius.md,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}><MessageSquare size={32} color="#f43f5e" /></div>
            <div>No notes yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Select text and create your first note!
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: 12,
                  border: `2px solid ${colors.border}`,
                  borderRadius: borderRadius.md,
                  background: colors.cardBg,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#f43f5e"
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(244, 63, 94, 0.15)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb"
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {formatDate(note.timestamp)}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => {
                        onSetEditingNoteId(note.id)
                        onSetCommentDraft(note.comment)
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        fontSize: 14,
                        color: "#f43f5e"
                      }}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        fontSize: 14,
                        color: "#ef4444"
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    padding: 8,
                    background: "#f9fafb",
                    borderLeft: "3px solid #f43f5e",
                    borderRadius: 4,
                    marginBottom: 8,
                    fontSize: 12,
                    color: "#6b7280",
                    fontStyle: "italic",
                    lineHeight: "18px"
                  }}
                >
                  "{note.selectedText.slice(0, 150)}
                  {note.selectedText.length > 150 ? "..." : ""}"
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    lineHeight: "20px",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {note.comment}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesTab
