# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Impulse is a Chrome Extension (Manifest V3) built with Plasmo 0.90.5 + React 18.2.0 + TypeScript 5.3.3. It is an AI-powered PDF reading assistant that displays a right-side panel with six features: Summary, Translation, Highlight, Comment, Q&A, and metadata extraction. All core features are fully implemented and integrated with the OpenAI API.

## Development Commands

**Package manager**: npm

- `npm run dev` - Starts Plasmo dev server with hot reload
- `npm run build` - Creates production bundle in `build/chrome-mv3-prod`
- `npm run package` - Creates distributable zip file

**Formatting**: Prettier is configured (`.prettierrc.mjs`) with import sorting. Run via IDE integration (no npm script exists).

**Testing**: No test framework configured. Automated static checks available via `bash test-suite.sh`.

## Architecture

### Component Structure

1. **Background Service Worker** (`background.ts`)
   - Detects PDF URLs using `isProbablyPdfUrl()` heuristic
   - Configures side panel for PDF tabs
   - Sets `openPanelOnActionClick: true` (user must click toolbar icon to open)

2. **Side Panel UI** (`sidepanel.tsx`)
   - Main interface with 5 tabs: Summary, Translation, Highlight, Comment, Q&A
   - Auto-polls selected text from the page every 2 seconds (no manual refresh needed)
   - Users can also paste text directly into the textarea
   - Supports dark mode and i18n (English/Chinese)
   - Keyboard shortcuts: 1-5 for tabs, Alt+S/T/H/C/Q, Alt+E for export

3. **Content Scripts**
   - `contents/selection.ts` — Listens for `GET_SELECTION` messages across all frames
   - `contents/highlight.ts` — Applies/clears yellow highlights on the page via DOM manipulation

4. **Utility Modules**
   - `utils/get-selection.ts` — Executes `window.getSelection()` in all frames, returns longest result
   - `utils/llm-client.ts` — OpenAI API wrapper: `summarize()`, `translate()`, `generateHighlights()`, `chatWithContext()`, `extractMetadata()`
   - `utils/storage.ts` — chrome.storage.local wrapper for notes, highlights, chat sessions, metadata, config, and user preferences
   - `utils/i18n.ts` — Internationalization (English/Chinese)
   - `utils/export.ts` — Markdown export for notes, highlights, and chat history

5. **Options Page** (`options.tsx`)
   - API Key configuration with show/hide toggle
   - Model selection (GPT-4o-mini / GPT-4o / GPT-3.5-turbo)

6. **Type Definitions** (`types/index.ts`)
   - Shared types: `ChatMessage`, `PaperMetadata`, `Language`, `Theme`

## Key Technical Patterns

### Auto-Polling Text Selection

The side panel polls `getSelectionInTab()` every 2 seconds. This silently reads `window.getSelection()` from all frames — no clipboard access, no manual refresh button.

```
User selects text on PDF page
    ↓
Every 2 seconds, sidepanel polls getSelectionInTab(tabId)
    ↓
chrome.scripting.executeScript({ allFrames: true })
    ↓
Returns longest non-empty selection from any frame
    ↓
Textarea updates automatically (or user pastes directly)
```

**Why allFrames**: Many PDF viewers (especially arXiv) embed PDFs in iframes. The `allFrames: true` pattern captures selections from any frame.

**Chrome's native PDF viewer** does not expose text via `window.getSelection()`. For those PDFs, users paste directly into the textarea.

### Page Highlighting

The highlight system uses message passing between the side panel and a content script:

1. Side panel calls `generateHighlights(text)` → LLM returns key phrases
2. Side panel sends `APPLY_HIGHLIGHTS` message to the active tab
3. `contents/highlight.ts` uses a `TreeWalker` to find text nodes and wraps matches in `<mark>` elements
4. Highlights are stored in `chrome.storage.local` per URL

### Data Persistence

All user data is stored per-URL in `chrome.storage.local`:
- **Notes**: selectedText + comment + url + timestamp
- **Highlights**: phrase + sourceText + url + timestamp
- **Chat sessions**: message history + paper context
- **Metadata**: title, authors, year, abstract, etc.
- **Preferences**: language (en/zh), theme (light/dark)

### Path Alias

- `~` maps to project root (configured in `tsconfig.json`)
- Example: `import { summarize } from "~utils/llm-client"`

## Implemented Features

### Core AI Features
- **Summary**: GPT-powered Chinese summaries of selected text
- **Translation**: Academic-quality translation to Chinese
- **Highlight**: AI extracts 3-7 key phrases → yellow highlights on page
- **Q&A**: Multi-turn chat about paper content with context

### Data Management
- **Notes**: Full CRUD — create, read, update, delete; per-URL storage
- **Highlights**: Save, list, delete, reapply, clear all; per-URL
- **Chat history**: Persisted per-URL, deletable

### UX Features
- **Auto text sync**: 2-second polling, no manual refresh
- **Dark mode**: Toggle between light/dark themes
- **i18n**: English and Chinese interface
- **Keyboard shortcuts**: Number keys (1-5), Alt shortcuts
- **Markdown export**: Notes + highlights + chat → `.md` file
- **Paper metadata**: Extract title, authors, year, abstract from text

## Plasmo Framework Conventions

- Plasmo auto-generates `manifest.json` from source files
- Side panel: defined in `sidepanel.tsx`
- Content scripts: `contents/` directory with `PlasmoCSConfig` export
- Options page: `options.tsx` (auto-registered)
- Background worker: `background.ts`

## Technical Debt

- TypeScript strict mode not enabled
- No ESLint configuration
- No unit/integration testing framework
- Parcel native module issue in Docker/Linux environments
- Some `any` types in error handling catch blocks
