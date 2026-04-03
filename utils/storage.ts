/**
 * Chrome storage utility for persisting configuration and API keys
 */

import type { ChatMessage, ChatSession, Language, PaperMetadata, Theme } from "~types"

export interface LLMConfig {
  provider: "openai"
  apiKey: string
  model?: string
  baseURL?: string // 兼容 Qwen / DeepSeek / 其他 OpenAI 兼容 API
}

export interface Note {
  id: string
  selectedText: string
  comment: string
  url: string
  pageTitle: string
  timestamp: number
  updatedAt?: number
}

export interface Highlight {
  id: string
  phrase: string
  sourceText: string
  url: string
  pageTitle: string
  timestamp: number
  color?: string
}

const STORAGE_KEYS = {
  LLM_CONFIG: "llm_config",
  NOTES: "notes",
  HIGHLIGHTS: "highlights",
  CHAT_SESSIONS: "chat_sessions",
  METADATA: "metadata",
  UI_LANGUAGE: "ui_language",
  UI_THEME: "ui_theme"
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

// ============= Highlights Management =============

/**
 * Generate a unique ID for a highlight
 */
function generateHighlightId(): string {
  return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get all highlights, sorted by timestamp (newest first)
 */
export async function getAllHighlights(): Promise<Highlight[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HIGHLIGHTS)
  const highlights = (result[STORAGE_KEYS.HIGHLIGHTS] || []) as Highlight[]
  return highlights.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Get highlights for a specific URL
 */
export async function getHighlightsByUrl(url: string): Promise<Highlight[]> {
  const allHighlights = await getAllHighlights()
  return allHighlights.filter((h) => h.url === url)
}

/**
 * Save multiple highlights
 */
export async function saveHighlights(
  phrases: string[],
  sourceText: string,
  url: string,
  pageTitle: string,
  color: string = "#fef08a"
): Promise<Highlight[]> {
  const highlights = await getAllHighlights()
  const newHighlights: Highlight[] = phrases.map((phrase) => ({
    id: generateHighlightId(),
    phrase,
    sourceText,
    url,
    pageTitle,
    timestamp: Date.now(),
    color
  }))

  highlights.push(...newHighlights)
  await chrome.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: highlights
  })

  return newHighlights
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(id: string): Promise<void> {
  const highlights = await getAllHighlights()
  const filtered = highlights.filter((h) => h.id !== id)
  await chrome.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: filtered
  })
}

/**
 * Delete all highlights for a URL
 */
export async function deleteHighlightsByUrl(url: string): Promise<void> {
  const highlights = await getAllHighlights()
  const filtered = highlights.filter((h) => h.url !== url)
  await chrome.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: filtered
  })
}

/**
 * Clear all highlights
 */
export async function clearAllHighlights(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.HIGHLIGHTS)
}

// ============= Chat Sessions Management =============

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export async function getChatSessionByUrl(url: string): Promise<ChatSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_SESSIONS)
  const sessions = (result[STORAGE_KEYS.CHAT_SESSIONS] || []) as ChatSession[]
  return sessions.find((s) => s.url === url) || null
}

export async function saveChatSession(
  url: string,
  pageTitle: string,
  messages: ChatMessage[],
  paperContext: string
): Promise<ChatSession> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_SESSIONS)
  const sessions = (result[STORAGE_KEYS.CHAT_SESSIONS] || []) as ChatSession[]

  const existingIndex = sessions.findIndex((s) => s.url === url)
  if (existingIndex !== -1) {
    sessions[existingIndex].messages = messages
    sessions[existingIndex].paperContext = paperContext
    sessions[existingIndex].timestamp = Date.now()
    await chrome.storage.local.set({ [STORAGE_KEYS.CHAT_SESSIONS]: sessions })
    return sessions[existingIndex]
  }

  const newSession: ChatSession = {
    id: generateSessionId(),
    url,
    pageTitle,
    messages,
    paperContext,
    timestamp: Date.now()
  }
  sessions.push(newSession)
  await chrome.storage.local.set({ [STORAGE_KEYS.CHAT_SESSIONS]: sessions })
  return newSession
}

export async function deleteChatSession(url: string): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_SESSIONS)
  const sessions = (result[STORAGE_KEYS.CHAT_SESSIONS] || []) as ChatSession[]
  const filtered = sessions.filter((s) => s.url !== url)
  await chrome.storage.local.set({ [STORAGE_KEYS.CHAT_SESSIONS]: filtered })
}

// ============= Metadata Management =============

interface StoredMetadata {
  url: string
  metadata: PaperMetadata
  timestamp: number
}

export async function getMetadataByUrl(url: string): Promise<PaperMetadata | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.METADATA)
  const all = (result[STORAGE_KEYS.METADATA] || []) as StoredMetadata[]
  return all.find((m) => m.url === url)?.metadata || null
}

export async function saveMetadata(url: string, metadata: PaperMetadata): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.METADATA)
  const all = (result[STORAGE_KEYS.METADATA] || []) as StoredMetadata[]
  const existingIndex = all.findIndex((m) => m.url === url)
  const entry: StoredMetadata = { url, metadata, timestamp: Date.now() }

  if (existingIndex !== -1) {
    all[existingIndex] = entry
  } else {
    all.push(entry)
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.METADATA]: all })
}

// ============= UI Preferences =============

export async function getLanguage(): Promise<Language> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.UI_LANGUAGE)
  return (result[STORAGE_KEYS.UI_LANGUAGE] as Language) || "en"
}

export async function setLanguage(lang: Language): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.UI_LANGUAGE]: lang })
}

export async function getTheme(): Promise<Theme> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.UI_THEME)
  return (result[STORAGE_KEYS.UI_THEME] as Theme) || "light"
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.UI_THEME]: theme })
}
