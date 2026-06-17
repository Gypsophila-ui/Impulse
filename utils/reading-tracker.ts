import { useEffect, useRef } from "react"
import {
  closeDatabase,
  endSession,
  getAllDistinctPaperUrls,
  getReadingStatsForUrl,
  getRecentReadingSummaryBrief,
  initDatabase,
  isDBReady,
  recordEvent,
  startSession,
  type ReadingEventType,
  type ReadingSummary
} from "./db"
import { getReadingSummary } from "./db"

interface ReadingTrackerState {
  sessionId: string | null
  currentUrl: string
  initialized: boolean
}

const state: ReadingTrackerState = {
  sessionId: null,
  currentUrl: "",
  initialized: false
}

export async function initTracker(): Promise<boolean> {
  if (state.initialized) return true
  const ok = await initDatabase()
  state.initialized = ok
  return ok
}

export function beginSession(url: string, title: string): string | null {
  if (!isDBReady()) return null

  if (state.sessionId && state.currentUrl === url) {
    return state.sessionId
  }

  if (state.sessionId) {
    endSession(state.sessionId)
  }

  const id = startSession(url, title)
  if (id) {
    state.sessionId = id
    state.currentUrl = url
    recordEvent(id, "page_view", { url, title })
  }
  return id
}

export function endCurrentSession(): void {
  if (state.sessionId) {
    endSession(state.sessionId)
    recordEvent(state.sessionId, "page_close")
    state.sessionId = null
    state.currentUrl = ""
  }
}

export function trackEvent(
  eventType: ReadingEventType,
  eventData?: Record<string, unknown>
): void {
  if (!state.sessionId) return
  recordEvent(state.sessionId, eventType, eventData)
}

export function getCurrentSessionId(): string | null {
  return state.sessionId
}

export { getReadingSummary }
export type { ReadingEventType, ReadingSummary }

// ─── Safe sync accessors for Agent integration ──────────────────────────────
// All queries are sync (sql.js in-memory), so these can be called inline
// during system prompt construction. Return null/[] when DB is not ready.

/**
 * Synchronous safe accessor for reading summary.
 * Returns null if database is not yet initialized (lazy init).
 */
export function getSafeReadingSummary(days?: number) {
  if (!isDBReady()) return null
  return getRecentReadingSummaryBrief(days)
}

/** Synchronous safe stats fetch for a single URL */
export function getSafeReadingStatsForUrl(url: string) {
  if (!isDBReady()) return null
  return getReadingStatsForUrl(url)
}

/** Synchronous safe URL list from reading sessions */
export function getSafeAllDistinctUrls(): string[] {
  if (!isDBReady()) return []
  return getAllDistinctPaperUrls()
}

export function useReadingTracker(
  url: string,
  title: string
): {
  track: (eventType: ReadingEventType, eventData?: Record<string, unknown>) => void
  sessionId: string | null
} {
  const urlRef = useRef(url)
  urlRef.current = url

  useEffect(() => {
    void initTracker().then(() => {
      beginSession(url, title)
    })

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        endCurrentSession()
      } else if (document.visibilityState === "visible") {
        void initTracker().then(() => {
          beginSession(urlRef.current, title)
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      endCurrentSession()
      void closeDatabase()
    }
  }, [url, title])

  return {
    track: trackEvent,
    sessionId: state.sessionId
  }
}