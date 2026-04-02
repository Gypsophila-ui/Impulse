# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Impulse is a Chrome Extension (Manifest V3) built with Plasmo 0.90.5 + React 18.2.0 + TypeScript 5.3.3. It provides PDF reading assistance through a right-side panel with four features: Summary, Translation, Highlight, and Comment. The project is in early MVP phase with a solid foundation but placeholder UI waiting for LLM integration.

## Development Commands

**Package manager**: pnpm (not npm)

- `pnpm dev` - Starts Plasmo dev server with hot reload
- `pnpm build` - Creates production bundle in `build/chrome-mv3-dev`
- `pnpm package` - Creates distributable zip file

**Formatting**: Prettier is configured (`.prettierrc.mjs`) with import sorting. Run via IDE integration (no npm script exists).

**Testing**: No test framework is currently configured.

## Architecture

### Three-Tier Component Structure

1. **Background Service Worker** (`background.ts`)
   - Detects PDF URLs using `isProbablyPdfUrl()` heuristic
   - Configures side panel for PDF tabs
   - Sets `openPanelOnActionClick: true` (user must click toolbar icon to open)

2. **Side Panel UI** (`sidepanel.tsx`)
   - Main interface with 4 tabs: Summary, Translation, Highlight, Comment
   - Fetches selected text when user clicks "刷新选中" (Refresh Selection) button
   - All 4 features are **placeholder implementations** with `// TODO: 接 LLM` comments

3. **Content Scripts & Text Selection** (`contents/selection.ts`, `utils/get-selection.ts`)
   - Uses `chrome.scripting.executeScript()` with `allFrames: true`
   - Critical for handling **iframed PDFs** (common on arXiv)
   - Collects `window.getSelection()` from all frames, returns longest non-empty text
   - Includes fallback logging to MAIN world for debugging

## Key Technical Patterns

### Cross-Frame Text Selection

This is the most complex architectural piece requiring coordination across multiple files:

```
User selects text on PDF page
    ↓
Clicks "刷新选中" in sidepanel
    ↓
sidepanel.tsx calls getSelectionInTab(tabId)
    ↓
chrome.scripting.executeScript({ allFrames: true })
    ↓
Executes in ALL frames (handles iframed PDFs)
    ↓
Returns longest non-empty selection from any frame
```

**Why this matters**: Many PDF viewers (especially arXiv) embed PDFs in iframes. A standard `window.getSelection()` call would only work in the top frame, missing the actual PDF content. The `allFrames: true` pattern ensures we capture selections from any frame in the page.

### Path Alias

- `~` maps to project root (configured in `tsconfig.json`)
- Example: `import { getSelectionInTab } from "~utils/get-selection"`

## Current Development State

### Implemented Features
- Project scaffolding and basic structure
- Right-side panel UI with 4 tabs
- Cross-frame text selection retrieval (handles iframed PDFs)
- PDF URL auto-detection and side panel configuration

### Pending LLM Integration

All four main features are placeholders waiting for LLM API integration:
- **Summary Tab**: Needs LLM call to summarize `selectedText`
- **Translation Tab**: Needs LLM call to translate `selectedText`
- **Highlight Tab**: Needs LLM suggestions + DOM manipulation for page highlights
- **Comment Tab**: Needs `chrome.storage.local` implementation for note persistence

See `docs/DEVELOPMENT_PLAN.md` for detailed roadmap and phase planning (currently in Phase 1: MVP).

## Important Notes

### Debug Logging to Clean Up
The codebase contains extensive debug logging to `http://127.0.0.1:7737/ingest/` with hypothesis IDs (H1-H14). These should be removed before production release.

### Plasmo Framework Conventions
- Plasmo auto-generates `manifest.json` from source files
- Side panel: defined in `sidepanel.tsx` with `export const config = { matches: ["<all_urls>"] }`
- Content scripts: use `contents/` directory with special export pattern
- Background worker: standard `background.ts` file

### Technical Debt
- TypeScript strict mode not yet enabled
- No ESLint configuration
- No testing framework configured
