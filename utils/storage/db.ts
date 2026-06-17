import initSqlJs, { type Database, type SqlJsStatic } from "sql.js"

// Bundle the sql.js WASM file locally (same pattern as pdf-extractor.ts for the PDF.js worker).
// Parcel resolves this at build time and copies the .wasm into the extension package.
const sqlWasmUrl = new URL(
  "sql.js/dist/sql-wasm.wasm",
  import.meta.url
).toString()

const DB_FILENAME = "impulse.db"
const SAVE_DEBOUNCE_MS = 2000

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

async function getOPFSHandle(): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getFileHandle(DB_FILENAME, { create: true })
}

async function loadFromOPFS(): Promise<Uint8Array | null> {
  try {
    const handle = await getOPFSHandle()
    const file = await handle.getFile()
    if (file.size === 0) return null
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

async function saveToOPFS(): Promise<void> {
  if (!db) return
  try {
    const data = db.export()
    const handle = await getOPFSHandle()
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
  } catch (e) {
    console.error("[DB] Failed to save to OPFS:", e)
  }
}

function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveToOPFS()
  }, SAVE_DEBOUNCE_MS)
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_seconds INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS reading_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES reading_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_url ON reading_sessions(url);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON reading_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_events_session ON reading_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON reading_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_ts ON reading_events(timestamp);
`

export type ReadingEventType =
  | "page_view"
  | "page_close"
  | "selection"
  | "summary"
  | "translation"
  | "highlight"
  | "note"
  | "qa"
  | "metadata"
  | "compare"
  | "export"
  | "agent_message"

export interface ReadingSession {
  id: string
  url: string
  title: string
  start_time: number
  end_time: number | null
  duration_seconds: number
}

export interface ReadingEvent {
  id: number
  session_id: string
  event_type: ReadingEventType
  event_data: string | null
  timestamp: number
}

export interface DailyStats {
  date: string
  total_duration_seconds: number
  papers_read: number
  events_count: number
}

export interface ReadingSummary {
  total_papers: number
  total_sessions: number
  total_duration_seconds: number
  total_events: number
  top_event_types: Array<{ type: string; count: number }>
  recent_papers: Array<{ url: string; title: string; last_read: number; session_count: number }>
  daily_stats: DailyStats[]
}

/** Trimmed-down summary for system prompt injection (token-efficient) */
export interface ReadingSummaryBrief {
  totalPapers: number
  recentTitles: Array<{ title: string; url: string; last_read: number; duration_minutes: number }>
  totalDurationMinutes: number
  topEventTypes: Array<{ type: string; count: number }>
}

export async function initDatabase(): Promise<boolean> {
  if (initialized) return true

  try {
    if (!SQL) {
      SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl
      })
    }

    const existingData = await loadFromOPFS()

    if (existingData) {
      db = new SQL.Database(existingData)
    } else {
      db = new SQL.Database()
    }

    db.run(SCHEMA_SQL)
    await saveToOPFS()

    initialized = true
    console.log("[DB] SQLite database initialized successfully")
    return true
  } catch (e) {
    console.error("[DB] Failed to initialize database:", e)
    return false
  }
}

export function isDBReady(): boolean {
  return initialized && db !== null
}

export function getDB(): Database | null {
  return db
}

export async function closeDatabase(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await saveToOPFS()
  if (db) {
    db.close()
    db = null
  }
  initialized = false
}

export function startSession(url: string, title: string): string | null {
  if (!db) return null

  const id = generateId()
  const now = Date.now()

  try {
    db.run(
      "INSERT INTO reading_sessions (id, url, title, start_time, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, url, title, now, now]
    )
    debouncedSave()
    return id
  } catch (e) {
    console.error("[DB] Failed to start session:", e)
    return null
  }
}

export function endSession(sessionId: string): void {
  if (!db) return

  const now = Date.now()
  try {
    const result = db.exec("SELECT start_time FROM reading_sessions WHERE id = ?", [sessionId])
    if (result.length > 0 && result[0].values.length > 0) {
      const startTime = result[0].values[0][0] as number
      const duration = Math.floor((now - startTime) / 1000)
      db.run(
        "UPDATE reading_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?",
        [now, duration, sessionId]
      )
    }
    debouncedSave()
  } catch (e) {
    console.error("[DB] Failed to end session:", e)
  }
}

export function recordEvent(
  sessionId: string,
  eventType: ReadingEventType,
  eventData?: Record<string, unknown>
): void {
  if (!db) return

  try {
    const dataStr = eventData ? JSON.stringify(eventData) : null
    db.run(
      "INSERT INTO reading_events (session_id, event_type, event_data, timestamp) VALUES (?, ?, ?, ?)",
      [sessionId, eventType, dataStr, Date.now()]
    )
    debouncedSave()
  } catch (e) {
    console.error("[DB] Failed to record event:", e)
  }
}

export function getSessionsByUrl(url: string): ReadingSession[] {
  if (!db) return []

  try {
    const result = db.exec(
      "SELECT id, url, title, start_time, end_time, duration_seconds FROM reading_sessions WHERE url = ? ORDER BY start_time DESC",
      [url]
    )
    if (result.length === 0) return []
    return result[0].values.map((row) => ({
      id: row[0] as string,
      url: row[1] as string,
      title: row[2] as string,
      start_time: row[3] as number,
      end_time: row[4] as number | null,
      duration_seconds: row[5] as number
    }))
  } catch (e) {
    console.error("[DB] Failed to get sessions:", e)
    return []
  }
}

export function getEventsBySession(sessionId: string): ReadingEvent[] {
  if (!db) return []

  try {
    const result = db.exec(
      "SELECT id, session_id, event_type, event_data, timestamp FROM reading_events WHERE session_id = ? ORDER BY timestamp ASC",
      [sessionId]
    )
    if (result.length === 0) return []
    return result[0].values.map((row) => ({
      id: row[0] as number,
      session_id: row[1] as string,
      event_type: row[2] as ReadingEventType,
      event_data: row[3] as string | null,
      timestamp: row[4] as number
    }))
  } catch (e) {
    console.error("[DB] Failed to get events:", e)
    return []
  }
}

export function getReadingSummary(days: number = 30): ReadingSummary | null {
  if (!db) return null

  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000

    const totalPapersResult = db.exec(
      "SELECT COUNT(DISTINCT url) FROM reading_sessions"
    )
    const totalSessionsResult = db.exec(
      "SELECT COUNT(*) FROM reading_sessions"
    )
    const totalDurationResult = db.exec(
      "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions"
    )
    const totalEventsResult = db.exec(
      "SELECT COUNT(*) FROM reading_events WHERE timestamp >= ?",
      [since]
    )
    const topEventsResult = db.exec(
      "SELECT event_type, COUNT(*) as cnt FROM reading_events WHERE timestamp >= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10",
      [since]
    )
    const recentPapersResult = db.exec(
      `SELECT s.url, s.title, MAX(s.start_time) as last_read, COUNT(*) as session_count
       FROM reading_sessions s
       GROUP BY s.url
       ORDER BY last_read DESC
       LIMIT 20`
    )
    const dailyStatsResult = db.exec(
      `SELECT date(start_time / 1000, 'unixepoch') as date,
              COALESCE(SUM(duration_seconds), 0) as total_duration,
              COUNT(DISTINCT url) as papers_read,
              (SELECT COUNT(*) FROM reading_events e WHERE e.timestamp >= s.start_time AND e.timestamp <= COALESCE(s.end_time, s.start_time)) as events_count
       FROM reading_sessions s
       WHERE start_time >= ?
       GROUP BY date
       ORDER BY date DESC`,
      [since]
    )

    const top_event_types = topEventsResult.length > 0
      ? topEventsResult[0].values.map((row) => ({
          type: row[0] as string,
          count: row[1] as number
        }))
      : []

    const recent_papers = recentPapersResult.length > 0
      ? recentPapersResult[0].values.map((row) => ({
          url: row[0] as string,
          title: row[1] as string,
          last_read: row[2] as number,
          session_count: row[3] as number
        }))
      : []

    const daily_stats: DailyStats[] = dailyStatsResult.length > 0
      ? dailyStatsResult[0].values.map((row) => ({
          date: row[0] as string,
          total_duration_seconds: row[1] as number,
          papers_read: row[2] as number,
          events_count: row[3] as number
        }))
      : []

    return {
      total_papers: (totalPapersResult[0]?.values[0]?.[0] as number) || 0,
      total_sessions: (totalSessionsResult[0]?.values[0]?.[0] as number) || 0,
      total_duration_seconds: (totalDurationResult[0]?.values[0]?.[0] as number) || 0,
      total_events: (totalEventsResult[0]?.values[0]?.[0] as number) || 0,
      top_event_types,
      recent_papers,
      daily_stats
    }
  } catch (e) {
    console.error("[DB] Failed to get reading summary:", e)
    return null
  }
}

export async function exportDatabase(): Promise<Uint8Array | null> {
  if (!db) return null
  try {
    return db.export()
  } catch (e) {
    console.error("[DB] Failed to export database:", e)
    return null
  }
}

export async function importDatabase(data: Uint8Array): Promise<boolean> {
  try {
    if (db) {
      db.close()
    }
    if (!SQL) {
      SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl
      })
    }
    db = new SQL.Database(data)
    db.run(SCHEMA_SQL)
    await saveToOPFS()
    initialized = true
    return true
  } catch (e) {
    console.error("[DB] Failed to import database:", e)
    return false
  }
}

export async function clearAllData(): Promise<void> {
  if (!db) return
  try {
    db.run("DELETE FROM reading_events")
    db.run("DELETE FROM reading_sessions")
    await saveToOPFS()
  } catch (e) {
    console.error("[DB] Failed to clear data:", e)
  }
}

// ─── Convenience query functions for Agent integration ──────────────────────

/**
 * Get aggregate reading stats for a specific URL.
 * Returns null if no sessions exist for the URL.
 */
export function getReadingStatsForUrl(url: string): {
  sessionCount: number
  totalDurationSeconds: number
  eventCount: number
  topEventTypes: Array<{ type: string; count: number }>
  firstVisitTime: number | null
  lastVisitTime: number | null
} | null {
  if (!db) return null

  try {
    const sessionCountResult = db.exec(
      "SELECT COUNT(*) FROM reading_sessions WHERE url = ?",
      [url]
    )
    const sessionCount = (sessionCountResult[0]?.values[0]?.[0] as number) || 0
    if (sessionCount === 0) return null

    const durationResult = db.exec(
      "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions WHERE url = ?",
      [url]
    )
    const totalDurationSeconds = (durationResult[0]?.values[0]?.[0] as number) || 0

    const firstVisitResult = db.exec(
      "SELECT MIN(start_time) FROM reading_sessions WHERE url = ?",
      [url]
    )
    const lastVisitResult = db.exec(
      "SELECT MAX(start_time) FROM reading_sessions WHERE url = ?",
      [url]
    )
    const firstVisitTime = (firstVisitResult[0]?.values[0]?.[0] as number) || null
    const lastVisitTime = (lastVisitResult[0]?.values[0]?.[0] as number) || null

    // Get event count across all sessions for this URL
    const eventCountResult = db.exec(
      `SELECT COUNT(*) FROM reading_events e
       INNER JOIN reading_sessions s ON e.session_id = s.id
       WHERE s.url = ?`,
      [url]
    )
    const eventCount = (eventCountResult[0]?.values[0]?.[0] as number) || 0

    // Top event types for this URL
    const topEventsResult = db.exec(
      `SELECT e.event_type, COUNT(*) as cnt
       FROM reading_events e
       INNER JOIN reading_sessions s ON e.session_id = s.id
       WHERE s.url = ?
       GROUP BY e.event_type
       ORDER BY cnt DESC
       LIMIT 5`,
      [url]
    )
    const topEventTypes: Array<{ type: string; count: number }> =
      topEventsResult.length > 0
        ? topEventsResult[0].values.map((row) => ({
            type: row[0] as string,
            count: row[1] as number
          }))
        : []

    return {
      sessionCount,
      totalDurationSeconds,
      eventCount,
      topEventTypes,
      firstVisitTime,
      lastVisitTime
    }
  } catch (e) {
    console.error("[DB] Failed to get reading stats for URL:", e)
    return null
  }
}

/**
 * Trimmed-down summary designed for system prompt injection.
 * Limits recentTitles to 10, rounds durations to minutes to save tokens.
 * Returns null if DB not initialized or no data.
 */
export function getRecentReadingSummaryBrief(days: number = 14): ReadingSummaryBrief | null {
  if (!db) return null

  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000

    const totalPapersResult = db.exec(
      "SELECT COUNT(DISTINCT url) FROM reading_sessions"
    )
    const totalDurationResult = db.exec(
      "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions"
    )
    const topEventsResult = db.exec(
      "SELECT event_type, COUNT(*) as cnt FROM reading_events WHERE timestamp >= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 5",
      [since]
    )
    const recentPapersResult = db.exec(
      `SELECT s.url, s.title, MAX(s.start_time) as last_read, COALESCE(SUM(s.duration_seconds), 0) as total_duration
       FROM reading_sessions s
       WHERE s.start_time >= ?
       GROUP BY s.url
       ORDER BY last_read DESC
       LIMIT 10`,
      [since]
    )

    const topEventTypes: Array<{ type: string; count: number }> =
      topEventsResult.length > 0
        ? topEventsResult[0].values.map((row) => ({
            type: row[0] as string,
            count: row[1] as number
          }))
        : []

    const recentTitles: Array<{
      title: string; url: string; last_read: number; duration_minutes: number
    }> = recentPapersResult.length > 0
      ? recentPapersResult[0].values.map((row) => ({
          url: row[0] as string,
          title: row[1] as string,
          last_read: row[2] as number,
          duration_minutes: Math.round(((row[3] as number) || 0) / 60)
        }))
      : []

    const totalDurationSeconds =
      (totalDurationResult[0]?.values[0]?.[0] as number) || 0

    return {
      totalPapers: (totalPapersResult[0]?.values[0]?.[0] as number) || 0,
      recentTitles,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      topEventTypes
    }
  } catch (e) {
    console.error("[DB] Failed to get recent reading summary brief:", e)
    return null
  }
}

/**
 * Get all distinct paper URLs from reading_sessions.
 * Used to discover papers that were visited but have no notes/highlights in chrome.storage.
 */
export function getAllDistinctPaperUrls(): string[] {
  if (!db) return []

  try {
    const result = db.exec(
      "SELECT DISTINCT url FROM reading_sessions ORDER BY MAX(start_time) DESC"
    )
    if (result.length === 0) return []
    return result[0].values.map((row) => row[0] as string)
  } catch (e) {
    console.error("[DB] Failed to get distinct paper URLs:", e)
    return []
  }
}