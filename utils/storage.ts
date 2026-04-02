/**
 * Chrome storage utility for persisting configuration and API keys
 */

export interface LLMConfig {
  provider: "openai"
  apiKey: string
  model?: string
}

export interface Note {
  id: string // 唯一标识
  selectedText: string // 选中的文本
  comment: string // 用户评论
  url: string // PDF URL
  pageTitle: string // 页面标题
  timestamp: number // 创建时间
  updatedAt?: number // 更新时间
}

const STORAGE_KEYS = {
  LLM_CONFIG: "llm_config",
  NOTES: "notes"
} as const

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LLM_CONFIG]: config
  })
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LLM_CONFIG)
  return result[STORAGE_KEYS.LLM_CONFIG] || null
}

export async function hasApiKey(): Promise<boolean> {
  const config = await getLLMConfig()
  return Boolean(config?.apiKey)
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.LLM_CONFIG)
}

// ============= Notes Management =============

/**
 * Generate a unique ID for a note
 */
function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get all notes, sorted by timestamp (newest first)
 */
export async function getAllNotes(): Promise<Note[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTES)
  const notes = (result[STORAGE_KEYS.NOTES] || []) as Note[]
  return notes.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Get notes for a specific URL
 */
export async function getNotesByUrl(url: string): Promise<Note[]> {
  const allNotes = await getAllNotes()
  return allNotes.filter((note) => note.url === url)
}

/**
 * Save a new note
 */
export async function saveNote(
  selectedText: string,
  comment: string,
  url: string,
  pageTitle: string
): Promise<Note> {
  const notes = await getAllNotes()
  const newNote: Note = {
    id: generateNoteId(),
    selectedText,
    comment,
    url,
    pageTitle,
    timestamp: Date.now()
  }
  notes.push(newNote)
  await chrome.storage.local.set({
    [STORAGE_KEYS.NOTES]: notes
  })
  return newNote
}

/**
 * Update an existing note
 */
export async function updateNote(id: string, comment: string): Promise<void> {
  const notes = await getAllNotes()
  const noteIndex = notes.findIndex((n) => n.id === id)
  if (noteIndex === -1) {
    throw new Error("Note not found")
  }
  notes[noteIndex].comment = comment
  notes[noteIndex].updatedAt = Date.now()
  await chrome.storage.local.set({
    [STORAGE_KEYS.NOTES]: notes
  })
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
  const notes = await getAllNotes()
  const filteredNotes = notes.filter((n) => n.id !== id)
  await chrome.storage.local.set({
    [STORAGE_KEYS.NOTES]: filteredNotes
  })
}

/**
 * Get a single note by ID
 */
export async function getNoteById(id: string): Promise<Note | null> {
  const notes = await getAllNotes()
  return notes.find((n) => n.id === id) || null
}

/**
 * Clear all notes (for testing/debugging)
 */
export async function clearAllNotes(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.NOTES)
}
