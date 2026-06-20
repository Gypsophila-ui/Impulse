# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Impulse is a Chrome Extension (Manifest V3) built with Plasmo 0.90.5 + React 18.2.0 + TypeScript 5.3.3. It is an AI-powered PDF reading assistant that displays a right-side panel with two modes: **Assistant mode** (5 tabs: Summary, Translation, Highlight, Notes, Q&A) and **Agent mode** (multi-turn chat with 14 registered tools and 9 skills). It also includes a **built-in PDF viewer** (`tabs/pdfviewer.tsx`) powered by pdfjs-dist v5, and **SQLite-backed reading history** tracking via sql.js + OPFS.

All core features are fully implemented and integrated with LLM APIs (OpenAI, DeepSeek, Qwen, or custom endpoints).

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
   - Detects PDF URLs using `isProbablyPdfUrl()` heuristic and `isImpulseViewerUrl()`
   - Configures side panel for PDF tabs (`openPanelOnActionClick: true`)
   - Sets up right-click context menu with 5 categorized highlight options (Important, Question, Definition, Method, Default) — each with a distinct color
   - Injects highlights into pages (native PDF, Impulse viewer, or regular web pages)
   - Redirects native PDF tabs to Impulse viewer when text is selected
   - Relays `QUICK_ACTION` messages from the quick-actions content script to the side panel

2. **Side Panel UI** (`sidepanel.tsx`) — ~834 lines
   - **Assistant mode**: 5 tabs — Summary, Translation, Highlight, Notes, Q&A
   - **Agent mode**: Multi-turn AI chat with tool calling (14 tools) and skill search (9 skills)
   - Auto-polls selected text from the page every 2 seconds (no manual refresh needed)
   - Users can also paste text directly into the textarea
   - Reading goal selector (4 modes: understand_method, find_details, evaluate_novelty, prepare_citation)
   - Provider presets: OpenAI, DeepSeek, Qwen, Custom (configured in options)
   - Supports dark mode and i18n (English/Chinese)
   - Keyboard shortcuts: 1-5 for tabs, Alt+S/T/H/C/Q, Alt+E for export
   - `getEffectiveUrl()` unifies storage keys between Impulse viewer and native PDF URLs

3. **Built-in PDF Viewer** (`tabs/pdfviewer.tsx`)
   - Uses pdfjs-dist v5 to render PDF pages with Canvas + text layer
   - Page navigation, zoom controls (50%-300%)
   - Supports categorized highlight injection/focus/clear with color coding
   - Real-time selection messages (`PDF_VIEWER_SELECTION`) sent to the side panel
   - Auto-restores highlights on load from chrome.storage.local

4. **Content Scripts** (`contents/`)
   - `selection.ts` — Listens for `GET_SELECTION` messages across all frames; captures `window.getSelection()`
   - `highlight.ts` — DOM highlight engine using `TreeWalker` to wrap text nodes in `<mark>` elements; supports categorized colors, clear, and focus-by-ID with scroll animation; handles SVG text nodes
   - `quick-actions.ts` — Floating toolbar on text selection with 5 action buttons (Translate, Summary, Explain Term, Highlight, Note); keyboard shortcuts T/S/E/H/N; dark mode support
   - `bug-report.ts` — Collects page diagnostics (highlight count, PDF embed detection, readyState) for bug reporting

5. **React Components** (`components/`)
   - `AgentView.tsx` — Full agent chat UI with skill search, PDF text extraction, Markdown + LaTeX rendering, conversation history compression, and tool call status visualization
   - `AskUserQuestionModal.tsx` — Modal for agent-to-user questions with preset options and custom input
   - `BugReportModal.tsx` — Bug report UI with AI diagnosis (console logs + code context → AI root cause analysis)
   - `ConfigModal.tsx` — Settings modal (API key, provider preset, model, language, theme)
   - `common/ContentArea.tsx` — Selected-text textarea wrapper + tab content switching
   - `common/Header.tsx` — Tab bar (Summary/Translation/Highlight/Notes/Q&A) + Agent mode toggle; exports `TabKey` and `AppMode` types
   - `common/MetadataCard.tsx` — Expandable paper metadata display/extraction
   - `common/ReadingGoalSelector.tsx` — Reading goal dropdown
   - `common/Spinner.tsx`, `common/ErrorAlert.tsx`, `common/GlobalStyles.tsx`
   - `tabs/SummaryTab.tsx`, `tabs/TranslationTab.tsx`, `tabs/HighlightTab.tsx`, `tabs/NotesTab.tsx`, `tabs/QATab.tsx`

6. **Utility Modules** (`utils/`) — reorganized into 4 subdirectories:

   **`utils/agent/`** — AI Agent system
   - `llm-client.ts` — LLM API wrapper: `summarize()`, `translate()`, `generateHighlights()`, `chatWithContext()`, `extractMetadata()`, `agentChat()`, `compressHistory()`, `comparePapersWithLLM()`. Handles tool-call fallback when the model doesn't support function calling.
   - `tool-definitions.ts` — OpenAPI JSON Schema definitions for all 14 agent tools + system prompt generation
   - `agent-tools.ts` — `ToolExecutionContext` type + standalone page highlight functions (inject, clear, focus)
   - `tools/registry.ts` — `ToolRegistry` class: dispatches tool calls by name via a Map of handlers (replaced a ~420-line switch statement)
   - `tools/index.ts` — Registers all 14 tools across 6 handler groups; exports `executeToolCall()`
   - `tools/handlers/notes.ts`, `highlights.ts`, `content.ts`, `user-interaction.ts`, `reading-history.ts`, `comparison.ts`

   **`utils/storage/`** — Persistence
   - `storage.ts` — chrome.storage.local wrapper for LLM config, notes, highlights (with categories), chat sessions, metadata, UI preferences, paper snapshots (for comparison), and saved comparisons (~500 lines)
   - `db.ts` — SQLite reading history tracker via sql.js + OPFS. Tables: `reading_sessions` (URL, title, duration), `reading_events` (session_id, event_type, timestamp). Queries: reading summary by URL, daily stats, recent papers, brief summaries. Agent integration via `getReadingStatsForUrl()`, `getRecentReadingSummaryBrief()`, `getAllDistinctPaperUrls()`.

   **`utils/reading/`** — Reading-related utilities
   - `get-selection.ts` — Text selection via `chrome.scripting.executeScript` across all frames
   - `pdf-extractor.ts` — PDF.js text extraction (max 60K chars); handles arXiv URL normalization, CORS fetch, password-protected PDFs, and `file://` protocol limitations
   - `reading-tracker.ts` — React hook (`useReadingTracker`) for session lifecycle management (start/end, visibility changes); exports safe sync accessors for agent use

   **`utils/ui/`** — UI utilities
   - `i18n.ts` — Bilingual (Chinese/English) translations (~200 keys)
   - `design-tokens.ts` — Shared constants: borderRadius, spacing, shadows, transitions
   - `export.ts` — Markdown export for notes, highlights, and chat history

   **Root-level utilities:**
   - `bug-report.ts` — Console interception, component event tracking, bug report collection, AI diagnosis (via OpenAI), one-click auto-fix
   - `code-context-extractor.ts` — Stack trace parser, source code extractor, sensitive data sanitizer, code context formatter for AI prompts
   - `skills.ts` — Re-exports from `skills/index.ts`; adds `searchSkills()` query function

7. **Skills System** (`skills/`) — 9 AI agent skills
   - Each skill is a Markdown file with YAML frontmatter (trigger, tags, description) + system prompt
   - Loaded via Parcel's `bundle-text:` scheme in `skills/index.ts`
   - Skills: contribution-extractor, method-decomposition, critical-reading, term-explainer, summary, compare, related-work, related-work-writer, add-note
   - Agent mode can search and invoke skills by trigger keyword

8. **Options Page** (`options.tsx`)
   - API Key configuration with show/hide toggle
   - Provider preset selection (OpenAI, DeepSeek, Qwen, Custom)
   - Model selection per provider
   - Language (English/Chinese) and theme (Light/Dark) preferences
   - DeepSeek is the default provider

9. **Type Definitions** (`types/index.ts`)
   - Re-exports from `storage.ts` and `db.ts`
   - `ChatMessage`, `AgentMessage`, `ToolCallMessage`, `ToolResultMessage`
   - `AgentChatResult`, `AgentStatusCallback`
   - `AskUserQuestionParams`/`Result`/`Callback`
   - `ChatSession`, `PaperMetadata`
   - `Theme`, `Language`, `Skill`, `ReadingGoal`
   - `PaperSnapshot` — lightweight paper snapshot built by merging chrome.storage + SQLite data
   - `ComparisonDimension`, `ComparisonRow`, `ComparisonResult`, `SavedComparison`

## Key Technical Patterns

### Dual-Mode Interface

The side panel operates in two modes, toggled via the Header component:

- **Assistant mode**: Traditional tab-based UI where each tab has a specific function (summarize, translate, highlight, etc.). The user selects text and clicks a button to get results.
- **Agent mode**: Conversational AI interface powered by function calling. The agent can autonomously use 14 tools (save notes, apply highlights, summarize, translate, compare papers, etc.) and search 9 skills. It has access to the user's reading history via SQLite.

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

**Chrome's native PDF viewer** does not expose text via `window.getSelection()`. When a native PDF is detected, a banner prompts the user to open it in the Impulse viewer instead. The built-in Impulse viewer (`tabs/pdfviewer.tsx`) sends real-time selection messages to the side panel.

### Page Highlighting (Categorized)

The highlight system supports 5 color-coded categories with message passing between components:

1. Side panel (or agent) generates highlight phrases via LLM
2. Side panel sends `APPLY_HIGHLIGHTS` message with category info to the active tab
3. `contents/highlight.ts` uses a `TreeWalker` to find text nodes and wraps matches in `<mark>` elements with category-specific styling
4. Highlights are stored in `chrome.storage.local` per URL with category metadata

**Categories** (injected via right-click context menu or agent tool):
| Category    | Color  | Menu Label |
|-------------|--------|-------------|
| Important   | Red    | 🔴 重要     |
| Question    | Blue   | 🔵 疑问     |
| Definition  | Green  | 🟢 定义     |
| Method      | Purple | 🟣 方法     |
| Default     | Yellow | 🟡 普通     |

**Focus by ID**: Supports scrolling to and animating a specific highlight in the page.

### Agent Tool Registry Pattern

The agent system uses a `ToolRegistry` class (replacing a ~420-line switch statement):

```
Agent mode receives user message
    ↓
LLM API call with tool definitions (OpenAPI JSON Schema)
    ↓
If LLM returns tool_calls → ToolRegistry.execute(name, args, context)
    ↓
Handler dispatches to appropriate module (notes, highlights, content, etc.)
    ↓
Results returned to LLM for next turn
```

14 tools across 6 handler groups: `notes` (save, get, search), `highlights` (apply, get), `content` (summarize, translate, extract_metadata), `user-interaction` (ask_user_question), `reading-history` (get_reading_history), `comparison` (list_candidate_papers, get_paper_summary, compare_papers, save_comparison).

### Data Persistence

**chrome.storage.local** (per-URL):
- **Notes**: selectedText + comment + url + timestamp
- **Highlights**: phrase + sourceText + url + timestamp + category
- **Chat sessions**: message history + paper context
- **Metadata**: title, authors, year, abstract, etc.
- **Preferences**: language (en/zh), theme (light/dark), provider/model config
- **Paper snapshots**: lightweight paper metadata for comparison feature
- **Saved comparisons**: structured comparison results

**SQLite via sql.js + OPFS** (reading history):
- `reading_sessions`: URL, title, duration per reading session
- `reading_events`: session_id, event_type (page_view, selection, summary, etc.), timestamp
- Queried by the agent to provide context-aware responses ("You've read this paper 3 times...")

### Built-in PDF Viewer Integration

The Impulse viewer (`tabs/pdfviewer.tsx`) replaces Chrome's native PDF viewer for better integration:

- **Text selection**: Real-time `PDF_VIEWER_SELECTION` messages sent to the side panel as the user selects text (no polling delay)
- **Highlights**: Direct DOM highlight injection into the PDF text layer with category colors
- **Auto-restore**: Highlights saved per-URL are automatically reapplied when the PDF loads
- **Navigation sync**: Page number tracking for context-aware AI features

Native PDF URLs detected by the background worker trigger a redirect banner; right-clicking selected text on a native PDF also offers to open in the Impulse viewer.

### Quick Actions Floating Toolbar

When text is selected on any page, `contents/quick-actions.ts` displays a floating toolbar with 5 buttons:
- **Translate** (T) / **Summary** (S) / **Explain Term** (E) / **Highlight** (H) / **Note** (N)

Clicking a button sends a `QUICK_ACTION` message → background relays to side panel → side panel switches to the relevant tab and processes the selection.

### Path Alias

- `~` maps to project root (configured in `tsconfig.json`)
- Example: `import { summarize } from "~utils/agent/llm-client"`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `plasmo` 0.90.5 | Chrome Extension framework |
| `react` 18.2.0 / `react-dom` | UI framework |
| `openai` ^6.33.0 | LLM API client (OpenAI-compatible) |
| `pdfjs-dist` ^5.6.205 | Built-in PDF viewer rendering |
| `sql.js` ^1.12.0 | SQLite in browser (reading history via OPFS) |
| `react-markdown` ^8.0.7 | Markdown rendering in chat |
| `remark-math` / `rehype-katex` | LaTeX math rendering |
| `katex` ^0.16.9 | LaTeX math typesetting |
| `lucide-react` ^1.7.0 | Icon library |
| `pptxgenjs` ^4.0.1 | PowerPoint export |
| `sharp` ^0.34.5 | Image processing |

## Implemented Features

### Core AI Features
- **Summary**: LLM-powered summaries of selected text, context-aware with reading goal
- **Translation**: Academic-quality translation between English and Chinese
- **Highlight**: AI extracts key phrases → categorized color highlights on page (5 categories)
- **Q&A**: Multi-turn chat about paper content with persistent session context
- **Agent Mode**: Autonomous AI chat with 14 tools and 9 skills, reading history awareness

### Agent Tools (14)
- Notes: save_note, get_notes, search_notes
- Highlights: apply_highlight, get_highlights
- Content: summarize_selection, translate_selection, extract_paper_metadata
- User interaction: ask_user_question
- Reading history: get_reading_history (SQLite-backed)
- Comparison: list_candidate_papers, get_paper_summary, compare_papers, save_comparison

### Agent Skills (9)
- contribution-extractor, method-decomposition, critical-reading, term-explainer, summary, compare, related-work, related-work-writer, add-note

### Data Management
- **Notes**: Full CRUD — create, read, update, delete; per-URL storage
- **Highlights**: Save, list, delete, reapply, clear all, focus by ID; per-URL with 5 categories
- **Chat history**: Persisted per-URL, deletable (both assistant and agent sessions)
- **Reading history**: SQLite-backed session tracking (URL, duration, events)
- **Paper comparison**: Save paper snapshots, run structured LLM comparisons, save results

### UX Features
- **Auto text sync**: 2-second polling, no manual refresh
- **Built-in PDF viewer**: pdfjs-dist v5 with Canvas + text layer, zoom, page navigation
- **Quick actions toolbar**: Floating toolbar on text selection with 5 actions + keyboard shortcuts
- **Dark mode**: Toggle between light/dark themes
- **i18n**: English and Chinese interface (~200 translation keys)
- **Keyboard shortcuts**: Number keys (1-5) for tabs, Alt+S/T/H/C/Q for actions, Alt+E for export
- **Markdown export**: Notes + highlights + chat → `.md` file
- **Paper metadata**: Extract title, authors, year, abstract from text/PDF
- **Reading goals**: 4 modes to customize AI output style (understand_method, find_details, evaluate_novelty, prepare_citation)
- **Multi-provider**: OpenAI, DeepSeek, Qwen, or custom OpenAI-compatible endpoint

### Developer Features
- **Bug report + AI diagnosis**: Console log collection, code context extraction, AI root cause analysis, one-click auto-fix
- **Design tokens**: Shared borderRadius, spacing, shadows, transitions constants in `utils/ui/design-tokens.ts`

## Plasmo Framework Conventions

- Plasmo auto-generates `manifest.json` from source files
- Side panel: defined in `sidepanel.tsx`
- Content scripts: `contents/` directory with `PlasmoCSConfig` export
- Options page: `options.tsx` (auto-registered)
- Background worker: `background.ts`
- New tab pages: `tabs/` directory (e.g., `tabs/pdfviewer.tsx` → `tabs/pdfviewer.html`)
- Static assets loaded via `data-base64:` or `bundle-text:` Parcel schemes (used for skills, WASM files)

### Manifest V3 Permissions

- `sidePanel`, `scripting`, `activeTab`, `storage`, `clipboardRead`, `contextMenus`
- `host_permissions`: `https://*/*`, `http://*/*`, `file://*/*`
- `web_accessible_resources`: includes `tabs/pdfviewer.html`
- `content_security_policy`: allows `wasm-unsafe-eval` (required for sql.js WebAssembly)

## Technical Debt

- TypeScript strict mode not enabled
- No ESLint configuration
- No unit/integration testing framework
- Parcel native module issue in Docker/Linux environments
- Some `any` types in error handling catch blocks
