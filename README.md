# Resume Tailor

A production-grade Next.js web application for tailoring resumes to specific job descriptions using AI. Users edit resumes in LaTeX, receive intelligent JD-aligned suggestions from multiple LLM providers, polish text inline, compile to PDF, and download publication-ready resumes.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [LaTeX Compiler Setup](#latex-compiler-setup)
- [API Reference](#api-reference)
- [Core Libraries](#core-libraries)
- [Components](#components)
- [Types & Schemas](#types--schemas)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [AI/LLM Integration](#aillm-integration)
- [Editor Extensions](#editor-extensions)
- [PDF Pipeline](#pdf-pipeline)
- [Caching Strategy](#caching-strategy)
- [Configuration](#configuration)

---

## Features

- **LaTeX Editor** — Full CodeMirror 6 editor with LaTeX syntax highlighting, undo/redo, and search
- **AI-Powered Suggestions** — JD-specific resume improvements via Gemini, Claude, or Groq
- **Inline Text Polish** — Select text and apply actions: improve, elaborate, professional, concise, quantify
- **ATS Audit** — Automated audit for quantified impact, repetition, and spelling/grammar
- **SyncTeX Bidirectional Navigation** — Click PDF to jump to source line (inverse sync), click editor line to highlight PDF position (forward sync), Overleaf-style
- **Canvas PDF Viewer** — PDF.js-based canvas renderer with hybrid zoom (CSS transform for smooth live zoom + debounced sharp re-render), pinch-to-zoom, Ctrl+wheel zoom
- **PDF Compilation** — Local (pdflatex/xelatex/tectonic) or cloud (texlive.net) LaTeX compilation with SyncTeX data generation
- **ATS Compatibility Engine** — Auto-injects `\pdfgentounicode=1` and `\input{glyphtounicode}` for ATS-parseable PDFs, engine-specific LaTeX normalization
- **Supabase Auth & Persistence** — User authentication (email/password), multi-project management with auto-save, per-user LLM settings storage
- **Project Management** — Create, rename, delete, and switch between multiple resume projects with persistent cloud storage
- **Multi-Provider LLM** — Switch between Gemini, Claude, and Groq with per-provider API key management
- **PDF Upload** — Upload existing PDF resumes with automatic text extraction and structure detection
- **Download** — Export as compiled PDF or raw `.tex` source
- **Formatting Toolbar** — Insert LaTeX commands for sections, subheadings, project headings, bullet items, and text formatting
- **Diagnostics Panel** — Clickable compilation errors/warnings with line numbers for direct editor navigation
- **Dark Mode** — Full dark theme support via Tailwind CSS class strategy
- **Responsive Layout** — Adjustable split-pane editor/preview with resizable panels

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 3, Radix UI, shadcn/ui patterns |
| Editor | CodeMirror 6 (@uiw/react-codemirror) |
| AI/LLM | @google/genai (Gemini), @anthropic-ai/sdk (Claude), groq-sdk (Groq) |
| PDF Rendering | pdfjs-dist (canvas-based viewer + text extraction) |
| PDF Sync | SyncTeX (bidirectional source ↔ PDF navigation) |
| Backend | Supabase (@supabase/supabase-js, @supabase/ssr) — Auth, PostgreSQL, RLS |
| Validation | Zod |
| Animation | Framer Motion |
| Icons | Lucide React, React Icons |
| Notifications | Sonner |
| Package Manager | pnpm |

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                              │
│                                                                       │
│  ┌──────────────┐  ┌───────────────────────────────────────────────┐  │
│  │ LaTeX Editor │  │         PDF Canvas Viewer (PDF.js)            │  │
│  │ (CodeMirror) │◀─┼──── SyncTeX Inverse Sync (click PDF → line) │  │
│  │              │──┼────▶ SyncTeX Forward Sync (line → PDF highlight)│ │
│  └──────┬───────┘  └───────────────────────┬─────────────────────┘  │
│         │                                   │                        │
│  ┌──────┴───────────────────────────────────┴────────────────────┐   │
│  │              LatexResumeTailorApp (Main State)                 │   │
│  │  - LaTeX source, suggestions, SyncTeX mapping, auth, projects │   │
│  └──────────────────────────┬────────────────────────────────────┘   │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ HTTP (fetch)
┌─────────────────────────────┼────────────────────────────────────────┐
│                      Server (Next.js API)                             │
│                             │                                        │
│  ┌────────────┐  ┌─────────┴────┐  ┌──────────┐  ┌───────────────┐  │
│  │/suggestions│  │/compile-latex │  │ /polish  │  │ /synctex/[id] │  │
│  │ (JSON)     │  │(PDF+SyncTeX) │  │ (stream) │  │ (.synctex.gz) │  │
│  └─────┬──────┘  └──────┬───────┘  └────┬─────┘  └───────────────┘  │
│        │                │                │                           │
│  ┌─────┴────────────────┴────────────────┴───────────────────────┐   │
│  │          LLM Providers (Gemini / Claude / Groq)               │   │
│  │          LaTeX Compilers (pdflatex / xelatex / tectonic)      │   │
│  │          SyncTeX Engine (--synctex=1 flag)                    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │          Supabase (Auth, PostgreSQL, RLS)                     │   │
│  │          - resume_projects, resume_settings, resume_drafts    │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
resume-generator/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Inter font, metadata)
│   ├── page.tsx                  # Home page entry point
│   ├── globals.css               # Global styles and Tailwind base
│   └── api/resume/               # Backend API routes
│       ├── suggestions/route.ts  # AI resume suggestion generation
│       ├── polish/route.ts       # Streaming text polish
│       ├── compile-latex/route.ts# LaTeX → PDF compilation (+ SyncTeX)
│       ├── audit/route.ts        # ATS resume audit
│       ├── preview/[id]/route.ts # Cached PDF preview retrieval
│       ├── synctex/[id]/route.ts # SyncTeX mapping data endpoint
│       └── test-key/route.ts     # API key validation
├── components/                   # React components
│   ├── latex-resume-tailor-app.tsx    # Main application (orchestrator)
│   ├── pdf-canvas-viewer.tsx          # PDF.js canvas viewer with SyncTeX
│   ├── latex-resume-preview.tsx       # A4 resume preview renderer
│   ├── latex-project-fields.tsx       # Project draft form/JSON editor
│   ├── latex-suggestion-panel.tsx     # Suggestion review panel
│   ├── latex-pdf-preview.tsx          # PDF iframe viewer (legacy)
│   ├── latex-editor-suggestions.ts    # CodeMirror suggestion extension
│   ├── latex-polish-extension.ts      # CodeMirror polish extension
│   ├── home-resume-loader.tsx         # Dynamic import loader
│   └── ui/                            # shadcn/ui primitives
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       └── textarea.tsx
├── lib/                          # Core logic and utilities
│   ├── latex-resume.ts           # LaTeX parsing, manipulation, templates
│   ├── resume.ts                 # Resume data structures and operations
│   ├── pdf.ts                    # PDF text extraction and layout analysis
│   ├── pdf-cache.ts              # In-memory PDF + SyncTeX cache
│   ├── synctex-parser.ts         # SyncTeX format parser + forward/inverse sync
│   ├── synctex-client.ts         # Browser-side SyncTeX fetch + decompress
│   ├── supabase.ts               # Supabase browser client singleton
│   ├── latex-log-parser.ts       # LaTeX compiler log parser
│   ├── schemas.ts                # Zod validation schemas
│   └── utils.ts                  # Tailwind class merge utility
├── types/                        # TypeScript type definitions
│   ├── resume.ts                 # Core domain types
│   ├── latex-diagnostics.ts      # Compiler diagnostic types
│   └── html2pdf.d.ts             # html2pdf.js type declarations
├── prompts/                      # Standalone AI prompt references
│   └── standalone-gemini-resume-optimizer.md
├── public/
│   └── resume-tailor.png         # App logo/screenshot
├── .env.example                  # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
└── pnpm-workspace.yaml
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd resume-generator

# 2. Install dependencies
pnpm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your API keys

# 4. Start development server
pnpm dev

# 5. Open in browser
# http://localhost:3000
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js development server with hot reload |
| `pnpm build` | Create production build |
| `pnpm start` | Run production server |
| `pnpm lint` | Run ESLint checks |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | At least one LLM key | Google Gemini API key |
| `GROQ_API_KEY` | At least one LLM key | Groq API key |
| `ANTHROPIC_API_KEY` | At least one LLM key | Anthropic Claude API key |
| `NEXT_PUBLIC_SUPABASE_URL` | For auth/persistence | Supabase project URL (e.g., `https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth/persistence | Supabase publishable anon key |

At minimum, one LLM provider key is needed. Users can also supply LLM keys via the in-app settings panel (stored per-user in Supabase, sent per-request).

Supabase variables are optional — without them, the app runs in local-only mode (localStorage persistence, no auth).

---

## LaTeX Compiler Setup

PDF compilation requires a LaTeX engine accessible on `PATH`. The app tries compilers in order: `pdflatex` → `xelatex` → `tectonic`. If none are found, it falls back to cloud compilation via texlive.net.

### Windows

1. Install one compiler:
   - **MiKTeX**: Download from https://miktex.org/download, enable "Install missing packages on the fly"
   - **Tectonic**: Download from https://tectonic-typesetting.github.io/, add to PATH
2. Open a new PowerShell and verify:
   ```powershell
   pdflatex --version   # or xelatex --version / tectonic --version
   ```
3. Restart the Next.js dev server so it picks up the updated PATH.

### macOS

```bash
brew install --cask mactex    # Full TeX Live
# or
brew install tectonic          # Lightweight alternative
```

### Linux

```bash
sudo apt install texlive-full   # Full TeX Live
# or
curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh  # Tectonic
```

### Cloud Fallback

If no local compiler is available, the app automatically compiles via texlive.net (slower, requires internet). No configuration needed.

---

## API Reference

### POST `/api/resume/suggestions`

Generates AI-powered resume improvement suggestions aligned to a job description.

**Request Body:**
```json
{
  "resumeSections": [{ "id": "string", "title": "string", "lines": [...] }],
  "project": "string (formatted project details)",
  "companyRole": "string (max 300 chars)",
  "jd": "string (max 20000 chars)",
  "provider": "gemini" | "groq" | "claude",
  "model": "string (optional, provider-specific model ID)",
  "apiKey": "string (optional, overrides env var)"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "string",
      "targetLineId": "string",
      "sectionId": "string",
      "action": "replace" | "insert_before" | "insert_after" | "delete",
      "originalText": "string (optional)",
      "suggestedText": "string",
      "reason": "string",
      "jdMatchReason": "string"
    }
  ],
  "sectionReviews": [
    {
      "sectionId": "string",
      "status": "strong" | "needs_changes" | "missing_jd_keywords" | "not_relevant",
      "summary": "string"
    }
  ]
}
```

**Error Responses:** `400` (invalid payload), `429` (quota exceeded), `500` (missing key), `503` (provider busy)

**Method:**
1. Validates request with Zod schema
2. Resolves API key (request-level override → environment variable)
3. Builds a multi-phase resume tailoring prompt (JD decomposition, project scoring, bullet construction, skills optimization, summary generation, validation, layout density enforcement)
4. Calls the selected LLM provider
5. Parses JSON response with recovery logic for truncated/malformed JSON
6. Validates response structure and filters suggestions targeting invalid line IDs
7. Returns validated suggestions and section reviews

---

### POST `/api/resume/polish`

Polishes selected resume text with streaming response.

**Request Body:**
```json
{
  "text": "string (max 5000 chars)",
  "action": "improve" | "elaborate" | "professional" | "concise" | "quantify",
  "provider": "gemini" | "groq" | "claude",
  "model": "string (optional)",
  "apiKey": "string (optional)"
}
```

**Response:** `ReadableStream` of plain text (the polished result, streamed token by token).

**Polish Actions:**
| Action | Behavior |
|--------|----------|
| `improve` | Fix weak verbs, vague language, passive voice. Same length. |
| `elaborate` | Expand with technical context. 1.5-2x original length. |
| `professional` | Rewrite in formal corporate resume tone. |
| `concise` | Trim filler words. Target: 1 clean line. |
| `quantify` | Add implied scale/impact language without fabricating numbers. |

**System Prompt Rules:**
- Never changes core meaning or fabricates facts
- Preserves LaTeX commands and formatting
- Preserves existing metrics exactly
- Formats links using `\textcolor{blue}{\href{URL}{\textit{\small LinkText}}}`
- Returns only the rewritten text (no explanation, no markdown)

---

### POST `/api/resume/compile-latex`

Compiles LaTeX source to PDF.

**Request Body:**
```json
{
  "latex": "string (max 250000 chars)",
  "engine": "pdflatex" | "xelatex" | "tectonic" (optional preference)
}
```

**Success Response:** PDF binary with headers:
- `Content-Type: application/pdf`
- `X-Preview-Id: <id>` (for cached retrieval and SyncTeX fetch)
- `X-Compiler: <engine>`
- `X-Synctex-Available: true|false` (indicates if SyncTeX data was generated)

**Error Response:**
```json
{
  "error": "LaTeX compilation failed.",
  "compiler": "pdflatex",
  "details": "trimmed log output",
  "diagnostics": [
    { "id": "diag-1", "line": 42, "severity": "error", "message": "Undefined control sequence", "context": "\\badcommand" }
  ]
}
```

**Method:**
1. Validates request with Zod
2. Resolves compiler (tries preferred engine → fallback chain → cloud)
3. For local compilation:
   - Creates temp directory
   - Normalizes LaTeX source (strips pdflatex-specific commands for XeTeX/Tectonic, wraps bare URLs)
   - Runs compiler with `--synctex=1` (pdflatex/xelatex) or `--synctex` (tectonic) for SyncTeX generation
   - Two passes for pdflatex (cross-reference resolution)
   - Reads `resume.synctex.gz` from workdir if it exists
   - Parses log file for diagnostics
   - Caches PDF + SyncTeX data together via `storePdf(id, pdf, synctexBuffer, lineOffset)`
4. For cloud compilation:
   - Sends source to texlive.net API
   - Returns compiled PDF (SyncTeX unavailable for cloud compiles)

---

### GET `/api/resume/compile-latex`

Returns current compiler availability status.

**Response:**
```json
{
  "available": true,
  "compiler": "pdflatex" | "xelatex" | "tectonic" | "cloud (texlive.net)",
  "candidates": ["pdflatex", "xelatex", "tectonic"],
  "message": "LaTeX compiler found: pdflatex."
}
```

---

### POST `/api/resume/audit`

Performs ATS-focused resume audit without requiring a job description.

**Request Body:**
```json
{
  "resumeSections": [{ "id": "string", "title": "string", "lines": [...] }],
  "provider": "gemini" | "groq" | "claude",
  "model": "string (optional)",
  "apiKey": "string (optional)"
}
```

**Response:** Same structure as `/suggestions` (suggestions + section reviews).

**Audit Categories:**
1. **Quantifying Impact** — Suggests adding metrics, scale, or measurable outcomes
2. **Repetition** — Detects repeated verbs/phrases and suggests synonyms
3. **Spelling & Grammar** — Fixes errors, inconsistencies, and awkward phrasing

---

### GET `/api/resume/preview/[id]`

Retrieves a previously compiled and cached PDF preview.

**URL Parameter:** `id` — Preview ID returned in `X-Preview-Id` header from compilation

**Success:** PDF binary (`Content-Type: application/pdf`, 30-minute cache)
**Error:** `404` if preview expired or not found

---

### GET `/api/resume/synctex/[id]`

Retrieves the SyncTeX mapping data for a compiled PDF preview.

**URL Parameter:** `id` — Preview ID (same as used for PDF preview)

**Success Response:** Raw `.synctex.gz` binary with headers:
- `Content-Type: application/gzip`
- `Cache-Control: private, max-age=1800`
- `X-Line-Offset: <number>` — Number of lines added by `normalizeLatexForPdf()` before compilation (used to offset line numbers back to editor coordinates)

**Error:** `404` if preview not found, expired, or SyncTeX data unavailable (cloud compile)

**Client Usage:**
1. Fetch this endpoint after successful compilation
2. Decompress gzip via browser `DecompressionStream` API
3. Parse decompressed text with `parseSynctex()` into `SynctexMapping`
4. Use `lineOffset` to adjust between editor lines and compiled-document lines

---

### POST `/api/resume/test-key`

Validates an API key against a provider by making a minimal generation request.

**Request Body:**
```json
{
  "provider": "gemini" | "groq" | "claude",
  "model": "string",
  "apiKey": "string"
}
```

**Response:**
```json
{ "ok": true, "reply": "OK" }
```

**Error Responses:**
- `401`: Invalid API key
- `429`: Key valid but quota exceeded
- `500`: Other provider error

---

## Core Libraries

### `lib/latex-resume.ts`

LaTeX parsing and manipulation engine.

| Export | Description |
|--------|-------------|
| `ProjectDraft` | Type for project input fields: heading, explanation, techStack, link, fromDate, toDate |
| `DEFAULT_LATEX_RESUME` | Template LaTeX document with resume commands (resumeItem, resumeProjectHeading, resumeSubheading) |
| `parseLatexResume(latex: string): ResumeSection[]` | Parses raw LaTeX into structured sections with stable line IDs. Handles `\section{}`, visible commands (resumeItem, resumeSubheading, etc.), multi-line arguments, and center/header blocks |
| `applySuggestionToLatex(latex: string, suggestion: AiSuggestion, sections: ResumeSection[]): string` | Applies an AI suggestion edit to raw LaTeX source, preserving structure |
| `insertProjectsIntoLatex(latex: string, drafts: ProjectDraft[]): string` | Inserts formatted project blocks into the LaTeX source at the Projects section |
| `canInsertProject(latex: string): boolean` | Checks if a Projects section exists for insertion |
| `formatProjectsInput(drafts: ProjectDraft[]): string` | Formats project drafts into text for the AI prompt |
| `hasProjectDraftContent(draft: ProjectDraft): boolean` | Checks if a draft has any meaningful content |
| `emptyProjectDraft(): ProjectDraft` | Returns an empty project draft |
| `buildProjectLatexBlock(draft: ProjectDraft): string` | Generates a properly-formatted LaTeX project block |
| `escapeLatexText(text: string): string` | Escapes special LaTeX characters (`&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`) |
| `previewSuggestionLatexLine(suggestion: AiSuggestion): string` | Previews how a suggestion will render in context |

**Parsing Logic:**
- Detects `\section{}` boundaries to split into sections
- Recognizes visible commands: `resumeItem`, `resumeProjectHeading`, `resumeSubheading`, `resumeItemNoBullet`, `resumeSubItem`, `achievementEntry`
- Handles multi-line arguments with brace counting
- Extracts `\begin{center}` blocks as the Header section
- Assigns stable IDs (`sec-*`, `line-*`) to all parsed elements
- Maps each line to its source line numbers for editor navigation

---

### `lib/resume.ts`

Resume data manipulation and utility functions.

| Export | Description |
|--------|-------------|
| `createId(prefix: string): string` | Generates unique IDs using `crypto.randomUUID()` with fallback |
| `sanitizeFilename(input: string): string` | Converts a string to a safe filename (lowercase, alphanumeric + hyphens) |
| `getDownloadFilename(companyRole: string): string` | Produces `<role>-resume.pdf` download name |
| `detectSectionTitle(line: string): string \| undefined` | Recognizes section headings using an alias map and heuristics |
| `titleCase(value: string): string` | Converts a string to Title Case |
| `applySuggestionToSections(sections, suggestion): ResumeSection[]` | Core engine to apply an AI suggestion (replace/insert/delete) to the parsed resume structure |
| `getResumeText(sections: ResumeSection[]): string` | Extracts plain text representation of resume for AI prompt context |

**Section Title Aliases:**
Maps variations like "work experience", "professional experience", "employment" all to "Experience". Covers Summary, Skills, Experience, Projects, Education, Certifications, Awards, Achievements.

---

### `lib/pdf.ts`

PDF text extraction and layout analysis using pdfjs-dist.

| Export | Description |
|--------|-------------|
| `extractResumeSectionsFromPdf(file: File): Promise<{ sections, layouts }>` | Main entry point: extracts text items from PDF, groups them into positioned lines, detects sections, and produces `ResumeSection[]` with full `ResumeLineLayout` metadata |

**Internal Methods:**
- Text item extraction with position, font, and transform metadata
- Line grouping algorithm (groups items by vertical position with tolerance)
- Font family resolution (maps PDF internal font names to web-safe families)
- Font weight and style inference from PDF font descriptors
- Page dimension normalization (72 DPI → pixel coordinates)
- Column detection for multi-column layouts

---

### `lib/pdf-cache.ts`

In-memory PDF + SyncTeX cache with TTL-based eviction.

| Export | Description |
|--------|-------------|
| `generatePreviewId(): string` | Creates a 12-character hex ID via `crypto.randomUUID()` |
| `storePdf(id, pdf, synctex?, lineOffset?): void` | Stores compiled PDF + optional SyncTeX buffer (triggers eviction) |
| `getPdf(id: string): Buffer \| null` | Retrieves PDF if within 30-minute TTL, returns null otherwise |
| `getSynctex(id): { data: Buffer; lineOffset: number } \| null` | Retrieves SyncTeX gzip data + line offset if available and within TTL |

**Cache Entry Structure:**
```typescript
{ pdf: Buffer; synctex: Buffer | null; lineOffset: number; createdAt: number }
```

**Behavior:**
- Uses `globalThis` for persistence across hot reloads in development
- 30-minute TTL per entry
- Auto-evicts expired entries on every `storePdf()` call
- SyncTeX data is co-located with its PDF (same cache key = preview ID)
- `lineOffset` tracks lines prepended by LaTeX normalization for coordinate translation

---

### `lib/synctex-parser.ts`

Client-side SyncTeX format parser with forward and inverse sync lookup algorithms.

| Export | Description |
|--------|-------------|
| `SynctexRect` | Type: `{ page, x, y, width, height }` — PDF rectangle in points |
| `SynctexElement` | Type: `{ page, line, x, y, width, height }` — Element with source line number |
| `SynctexMapping` | Type: `{ forwardMap: Map<number, SynctexRect[]>; pageElements: SynctexElement[] }` |
| `parseSynctex(raw: string): SynctexMapping` | Parses decompressed SyncTeX text into lookup structures |
| `forwardSync(mapping, line): SynctexRect \| null` | Editor line → PDF rect (with ±5 line fuzzy fallback) |
| `inverseSync(mapping, page, x, y): number \| null` | PDF click → source line (nearest-neighbor by Euclidean distance) |

**SyncTeX Coordinate System:**
- SyncTeX uses scaled points (sp): 1 PDF point = 65,536 sp
- Scale formula: `(unit / 65536) * (1000 / magnification)`
- Preamble values (magnification, unit, x/y offset) are parsed from file header

**Parsing Logic:**
1. Parse preamble for `magnification`, `unit`, `x offset`, `y offset`
2. Skip to `Content:` section
3. Parse page starts (`{pageNumber`), box records (`[`/`(` for vbox/hbox), kern/glue records (`h`)
4. Box records: `[tag,line:x,y,w,h,d` — extracts source line, converts coordinates via scale + offsets
5. Kern/glue records: `htag,line:x,y` — point elements with default 10×10 size

**Forward Sync Algorithm:** Direct lookup in `forwardMap` by line number. On miss, searches ±5 nearby lines alternating above/below for the closest match.

**Inverse Sync Algorithm:** Filters elements by page, computes Euclidean distance from click point to each element's center (`(x + width/2, y + height/2)`), returns the line of the nearest element.

---

### `lib/synctex-client.ts`

Browser-side helper to fetch, decompress, and parse SyncTeX data.

| Export | Description |
|--------|-------------|
| `fetchSynctexMapping(previewId): Promise<{ mapping: SynctexMapping \| null; lineOffset: number }>` | Fetches `/api/resume/synctex/{id}`, decompresses gzip, parses into mapping |

**Decompression Pipeline:**
1. Fetch raw `.synctex.gz` as `ArrayBuffer`
2. Wrap in `Blob`, create `ReadableStream` via `.stream()`
3. Pipe through `DecompressionStream("gzip")` (Web Streams API)
4. Collect chunks, merge into single `Uint8Array`, decode as UTF-8 text
5. Pass to `parseSynctex()` for structured mapping

Returns `{ mapping: null, lineOffset: 0 }` on any failure (graceful degradation).

---

### `lib/supabase.ts`

Supabase browser client singleton using `@supabase/ssr`.

| Export | Description |
|--------|-------------|
| `createClient(): SupabaseClient` | Returns a singleton Supabase browser client configured from environment variables |

Uses `createBrowserClient()` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The singleton pattern ensures a single client instance across the React component tree.

**Supabase Tables:**
| Table | Purpose | RLS |
|-------|---------|-----|
| `resume_projects` | Per-user resume projects (LaTeX source, company/role, JD) | Yes — `user_id = auth.uid()` |
| `resume_settings` | Per-user LLM provider/model/API key preferences | Yes — `user_id = auth.uid()` |
| `resume_drafts` | Per-user project draft data | Yes — `user_id = auth.uid()` |

---

### `lib/latex-log-parser.ts`

Parses LaTeX compiler output into structured diagnostics.

| Export | Description |
|--------|-------------|
| `parseLatexLog(rawLog: string, lineOffset?: number): LatexDiagnostic[]` | Parses compiler log text into an array of errors/warnings with line numbers |

**Detection Patterns:**
1. File-line-error format: `./resume.tex:42: Undefined control sequence`
2. Traditional `!` errors: `! Undefined control sequence` followed by `l.42 \badcommand`
3. LaTeX warnings: `LaTeX Warning: ... on input line 42`
4. Overfull/Underfull box warnings with line numbers

Returns diagnostics sorted by line number, deduplicated, with auto-assigned IDs.

---

### `lib/schemas.ts`

Zod validation schemas shared between client and server.

| Schema | Validates |
|--------|-----------|
| `resumeLineSchema` | Individual resume line (id, page, sectionId, text, kind, layout) |
| `resumeSectionSchema` | Section with id, title, and lines array |
| `suggestionRequestSchema` | POST /suggestions input (resumeSections, project, companyRole, jd, provider, model, apiKey) |
| `aiSuggestionSchema` | Single AI suggestion (id, targetLineId, sectionId, action, texts, reasons) |
| `sectionReviewSchema` | Section review (sectionId, status, summary) |
| `suggestionResponseSchema` | Full response (suggestions[] + sectionReviews[]) |
| `polishRequestSchema` | POST /polish input (text, action, provider, model, apiKey) |

---

### `lib/utils.ts`

```typescript
cn(...inputs: ClassValue[]): string
```
Combines `clsx` and `tailwind-merge` for safe Tailwind class composition without conflicts.

---

## Components

### `LatexResumeTailorApp` — Main Application

The primary application component (2898 lines). Manages all state and orchestrates child components.

**Key Responsibilities:**
- LaTeX editor with CodeMirror integration (syntax highlighting, extensions)
- Resume suggestion lifecycle (request → display → accept/decline)
- Project draft management with form and JSON modes
- PDF compilation, preview, and download
- LLM settings configuration (provider, model, API keys per provider)
- Pane resizing (editor/preview split, min 34%, max 68%)
- Undo/redo with debounced history tracking (450ms)
- File upload (PDF → extract sections → populate editor)
- View mode switching (parsed preview vs compiled PDF)
- Toast notifications for async operations
- Keyboard shortcuts and search integration

**State Variables:**
| State | Type | Description |
|-------|------|-------------|
| `latexCode` | `string` | Current LaTeX source |
| `suggestions` | `AiSuggestion[]` | Active AI suggestions |
| `sectionReviews` | `SectionReview[]` | Section-level assessments |
| `projectDrafts` | `ProjectDraft[]` | Multiple project inputs |
| `companyRole` | `string` | Target company/role text |
| `jd` | `string` | Job description text |
| `pdfUrl` | `string \| null` | URL to compiled PDF preview |
| `pdfArrayBuffer` | `ArrayBuffer \| null` | Raw PDF binary for canvas viewer |
| `synctexMapping` | `SynctexMapping \| null` | Parsed SyncTeX bidirectional mapping |
| `synctexLineOffset` | `number` | Line offset for editor ↔ compiled coordinate translation |
| `forwardHighlight` | `SynctexRect \| null` | Current forward sync highlight rectangle |
| `viewMode` | `"pdf"` | Preview mode (defaults to PDF canvas viewer) |
| `previewZoom` | `number` | Preview zoom percentage |
| `llmProvider` | `LlmProvider` | Selected AI provider |
| `llmModel` | `string` | Selected model ID |
| `polishState` | `PolishState` | Current inline polish operation |
| `diagnostics` | `LatexDiagnostic[]` | Compilation errors/warnings |
| `isCompiling` | `boolean` | Compilation in progress |
| `isGenerating` | `boolean` | AI generation in progress |

**Constants:**
| Name | Value | Description |
|------|-------|-------------|
| `COMPANY_ROLE_LIMIT` | 300 | Max chars for company/role field |
| `JD_LIMIT` | 20000 | Max chars for job description |
| `MIN_EDITOR_PANE_WIDTH` | 34% | Minimum editor panel width |
| `MAX_EDITOR_PANE_WIDTH` | 68% | Maximum editor panel width |
| `PDF_ZOOM_STEP` | 10 | Zoom increment for PDF view |
| `PREVIEW_WHEEL_ZOOM_STEP` | 2 | Zoom increment for scroll wheel |

**Available LLM Models:**
| Provider | Models |
|----------|--------|
| Gemini | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |
| Claude | claude-sonnet-4-20250514 |
| Groq | llama-3.3-70b-versatile |

---

### `PdfCanvasViewer` — PDF.js Canvas Renderer with SyncTeX

Canvas-based PDF viewer using `pdfjs-dist` with bidirectional SyncTeX navigation and hybrid zoom.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `pdfData` | `ArrayBuffer \| null` | Compiled PDF binary data |
| `zoom` | `number` | Current zoom percentage (50–300) |
| `onZoomChange` | `(zoom: number) => void` | Callback when zoom changes (pinch/wheel) |
| `synctexMapping` | `SynctexMapping \| null` | Parsed SyncTeX data for navigation |
| `lineOffset` | `number` | Line offset for editor ↔ compiled coordinate translation |
| `highlightRect` | `SynctexRect \| null` | Forward sync highlight rectangle to display |
| `onPdfClick` | `(line: number) => void` | Inverse sync callback (PDF click → source line) |
| `onHighlightFade` | `() => void` | Called after highlight auto-fades (2s timeout) |
| `onPageCount` | `(n: number) => void` | Reports total page count on load |

**Imperative Handle:**
- `scrollToPage(page: number)` — Smoothly scrolls the container to bring a specific page into view

**Hybrid Zoom Architecture:**
1. **Instant visual zoom** via CSS `transform: scale()` on the wrapper div — no re-render, no React state change
2. **Debounced sharp render** (300ms idle) — full PDF.js canvas re-render at target resolution
3. **React bypass pattern** — `liveZoomRef` holds current zoom, `onZoomChangeRef` avoids stale closures, wheel handler reads from refs not state

**Zoom Interaction:**
- Ctrl+Wheel / Cmd+Wheel: zoom in/out
- Trackpad pinch: detected via `e.ctrlKey` (browser synthesizes ctrlKey for pinch gestures)
- Toolbar +/- buttons: prop-driven zoom change
- Range: 50%–300%, step adapts to input magnitude (small for trackpad, larger for mouse wheel)

**Canvas Rendering Pipeline:**
1. Load PDF: `pdfjs.getDocument({ data: pdfData.slice(0) })`
2. Configure worker: `pdfjs-dist/build/pdf.worker.min.mjs`
3. Get page dimensions: `page.getViewport({ scale: 1 })`
4. Render at HiDPI: `viewport = page.getViewport({ scale: zoom/100 * devicePixelRatio })`
5. Canvas physical size: `viewport.width × viewport.height`
6. Canvas CSS size: `viewport.width/dpr × viewport.height/dpr`

**Inverse Sync (Click → Source):**
1. Capture click coordinates relative to canvas
2. Account for CSS scale transform and display zoom: `clickX / displayScale / scaleOnScreen`
3. Call `inverseSync(mapping, pageNumber, pdfX, pdfY)`
4. Subtract `lineOffset` from result
5. Fire `onPdfClick(adjustedLine)`

**Forward Sync Highlight:**
- Absolutely positioned `<div>` over the target page canvas
- Style: `bg-yellow-300/40` (semi-transparent yellow overlay)
- Position computed from `highlightRect` coordinates × zoom scale
- Auto-fades after 2 seconds via `useEffect` + `setTimeout`

---

### `HomeResumeLoader` — Dynamic Import Wrapper

Lazy-loads `LatexResumeTailorApp` with SSR disabled (client-only component). Displays a centered "Loading..." state during import.

---

### `ResumePreview` — A4 Page Preview

Renders a pixel-perfect A4 resume preview from parsed `ResumeSection[]` data.

**Exports:**
| Export | Description |
|--------|-------------|
| `ResumePreview` | Main preview component with pagination |
| `derivePreviewLayoutFromLatex(latex)` | Extracts layout info from LaTeX for preview rendering |
| `paginateResumeSections(sections, fontSizes)` | Splits sections across pages based on available height |
| `PreviewFontSizes` | Type for configurable font size mappings |
| `ResumePreviewSelection` | Type for click-to-source selection state |

**Features:**
- A4 dimensions: 793.7px width, 1122.5px height
- Interactive click-to-source navigation (click preview → jump to editor line)
- Visual suggestion highlighting with accept/reject overlays
- Zoom and page navigation controls
- Font size and styling calculations from PDF metadata

---

### `LatexProjectFields` — Project Form

Manages project inputs with two editing modes.

**Modes:**
- **Form Mode** — Structured fields: heading, explanation, techStack, link, fromDate, toDate
- **JSON Mode** — Bulk edit all projects as a JSON array

**Features:**
- Carousel-style navigation between multiple project drafts
- Add/remove projects
- JSON validation with error display
- LocalStorage persistence (`resume-tailor-projects-v1`)

---

### `LatexSuggestionPanel` — Suggestion Review

Displays AI suggestions grouped by section with diff-style visualization.

**Props:**
- `sections` — Current resume sections
- `suggestions` — Active AI suggestions
- `sectionReviews` — Section assessments
- `onAccept(id)` — Accept suggestion callback
- `onDecline(id)` — Decline suggestion callback
- `onAcceptAll()` — Accept all suggestions
- `onDeclineAll()` — Decline all suggestions

**Behavior:**
- Filters out "strong" sections (only shows actionable items)
- Groups suggestions by section ID
- Shows original text vs suggested text diff
- Displays reason and JD match explanation per suggestion
- Section review badges: `needs_changes`, `missing_jd_keywords`, `not_relevant`

---

### `PdfPreview` / `PdfFullscreenPreview` — PDF Viewer

Iframe-based PDF display with zoom controls.

**Constants:**
- `MIN_PDF_ZOOM`: 50%
- `MAX_PDF_ZOOM`: 200%

**Exports:**
- `PdfPreview` — Inline preview within the split pane
- `PdfFullscreenPreview` — Overlay fullscreen mode
- `clampPdfZoom(zoom)` — Ensures zoom stays within bounds

---

### UI Primitives (`components/ui/`)

Built with shadcn/ui patterns using class-variance-authority (CVA) and Radix UI.

| Component | Variants/Features |
|-----------|-------------------|
| `Button` | Variants: default, secondary, outline, ghost, destructive. Sizes: sm, default, lg, icon |
| `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `Alert` | Default, destructive variants with AlertTitle and AlertDescription |
| `Badge` | Default, secondary, outline, destructive variants |
| `Input` | Standard text input with focus ring |
| `Label` | Form label using Radix Label primitive |
| `Textarea` | Multi-line text input |
| `ScrollArea` | Custom scrollbar using Radix ScrollArea |

---

## Types & Schemas

### Core Types (`types/resume.ts`)

```typescript
type ResumeLine = {
  id: string;              // Stable identifier (line-<uuid>)
  page: number;            // Page number (1-indexed)
  sectionId: string;       // Parent section ID
  text: string;            // Primary display text
  rightText?: string;      // Right-aligned text (dates, locations)
  secondaryText?: string;  // Subtitle text
  sourceLine?: number;     // LaTeX source line number (start)
  sourceEndLine?: number;  // LaTeX source line number (end)
  sourceText?: string;     // Raw LaTeX source for this line
  kind?: "header" | "text" | "bullet" | "projectHeading" | "subheading";
  replacedText?: string;   // Previous text (after suggestion applied)
  changeKind?: "replace" | "insert";  // Type of recent change
  layout?: ResumeLineLayout;  // PDF-extracted positioning metadata
};

type ResumeSection = {
  id: string;      // Stable identifier (sec-<uuid>)
  title: string;   // Section heading (e.g., "Experience", "Skills")
  lines: ResumeLine[];
};

type ResumeLineLayout = {
  pageWidth: number;       pageHeight: number;
  x: number;               y: number;
  width: number;           height: number;
  fontSize: number;        fontFamily: string;
  fontWeight: number;      lineHeight: number;
  textAlign: "left" | "center" | "right";
  color?: string;          fontStyle?: "normal" | "italic";
  fontVariantCaps?: "normal" | "small-caps";
  variant?: "body" | "sectionHeading" | "headerName" | "headerSub" | "link";
  renderedTextWidth?: number;
  textScaleX?: number;
  pageBackground?: string;
};

type AiSuggestion = {
  id: string;
  targetLineId: string;    // Which resume line to modify
  sectionId: string;       // Which section contains the target
  action: "replace" | "insert_before" | "insert_after" | "delete";
  originalText?: string;   // Text being replaced (for replace action)
  suggestedText: string;   // New text to apply
  reason: string;          // Why this change improves the resume
  jdMatchReason: string;   // How this aligns with the job description
};

type SectionReview = {
  sectionId: string;
  status: "strong" | "needs_changes" | "missing_jd_keywords" | "not_relevant";
  summary: string;         // Human-readable assessment
};

type LlmProvider = "gemini" | "groq" | "claude";
type PolishAction = "improve" | "elaborate" | "professional" | "concise" | "quantify";

type PolishState = {
  range: { from: number; to: number };  // Editor selection range
  original: string;       // Original selected text
  polished: string | null; // Polished result (null while loading)
  loading: boolean;
  action: PolishAction;
} | null;
```

### LaTeX Diagnostics (`types/latex-diagnostics.ts`)

```typescript
type DiagnosticSeverity = "error" | "warning";

type LatexDiagnostic = {
  id: string;            // Auto-assigned (diag-1, diag-2, ...)
  line: number;          // Source line number
  severity: DiagnosticSeverity;
  message: string;       // Human-readable error/warning text
  context?: string;      // Surrounding code context
};
```

---

## Data Flow

### Resume Loading Flow

```
PDF Upload → pdfjs-dist extracts text items with positions
           → groupItemsIntoPositionedLines() reconstructs lines
           → detectSectionTitle() identifies sections
           → Returns ResumeSection[] with ResumeLineLayout metadata
           → Populates editor + preview

LaTeX Input → parseLatexResume() splits by \section{}
           → Recognizes visible commands (resumeItem, etc.)
           → Returns ResumeSection[] with source line mappings
           → Populates preview with editor-linked navigation
```

### AI Suggestion Flow

```
1. User enters Job Description + Company/Role
2. User clicks "Get Suggestions"
3. Client sends POST /api/resume/suggestions:
   - Resume sections (parsed with stable IDs)
   - JD text + Company/Role
   - Project details (formatted)
   - Provider + Model + API Key
4. Server builds multi-phase prompt:
   - Phase 1: JD decomposition (extract key requirements)
   - Phase 2: Project scoring (rank projects by JD relevance)
   - Phase 3: Bullet construction (craft impactful bullets)
   - Phase 4: Skills optimization (align skills section)
   - Phase 5: Summary generation (tailored summary)
   - Phase 6: Validation (ensure no fabrication)
   - Phase 7: Layout density enforcement
5. Server calls LLM, parses JSON response
6. Server validates against Zod schema, filters invalid targets
7. Client receives suggestions + section reviews
8. User reviews each suggestion (accept/decline)
9. On accept: applySuggestionToLatex() modifies LaTeX source
10. Editor updates, preview re-renders
```

### Text Polish Flow

```
1. User selects text in CodeMirror editor
2. Polish tooltip appears with 5 action options
3. User clicks an action (e.g., "improve")
4. Client sends POST /api/resume/polish (streaming)
5. Server streams polished text token by token
6. CodeMirror extension shows inline diff widget
7. User accepts (replaces text) or dismisses
```

### PDF Compilation Flow

```
1. User clicks "Compile PDF"
2. Client sends POST /api/resume/compile-latex
3. Server resolves compiler:
   a. Tries preferred engine (if specified)
   b. Falls back through: pdflatex → xelatex → tectonic
   c. If none available: uses texlive.net cloud API
4. For local compilation:
   a. Creates temp directory
   b. Normalizes LaTeX (XeTeX/Tectonic compatibility), records lineOffset
   c. Writes source file, runs compiler with --synctex=1 (2 passes for pdflatex)
   d. On success: reads PDF + resume.synctex.gz, stores both in cache
   e. On failure: parses log, returns diagnostics
5. Client receives PDF blob → stores as ArrayBuffer → renders via PdfCanvasViewer
6. Client auto-fetches SyncTeX mapping in background:
   GET /api/resume/synctex/{previewId} → decompress gzip → parseSynctex()
7. Diagnostics (if any) shown as inline editor annotations
```

### SyncTeX Bidirectional Sync Flow

```
Forward Sync (editor → PDF):
1. User clicks crosshair button in toolbar (or cursor-based trigger)
2. Get current editor line from EditorView.state.selection.main
3. Add lineOffset to convert editor line → compiled-document line
4. Call forwardSync(mapping, adjustedLine) → SynctexRect
5. Set forwardHighlight state → yellow overlay rendered on target page
6. Call pdfViewerRef.scrollToPage(rect.page)
7. Highlight auto-fades after 2 seconds

Inverse Sync (PDF → editor):
1. User clicks on PDF canvas
2. PdfCanvasViewer converts click coordinates to PDF points
3. Call inverseSync(mapping, page, x, y) → source line number
4. Subtract lineOffset to convert compiled line → editor line
5. Call focusEditorAtSourceLine(line) → editor scrolls and highlights
```

### Supabase Auth & Persistence Flow

```
Authentication:
1. User signs up/signs in via email + password
2. Supabase Auth issues JWT, stored in browser cookie (via @supabase/ssr)
3. All subsequent Supabase queries include JWT automatically
4. RLS policies on all tables enforce user_id = auth.uid()

Project Save/Load:
1. On auth: fetch user's resume_projects list from Supabase
2. On project switch: load LaTeX source, company/role, JD from selected project
3. On edit: debounced auto-save updates resume_projects row
4. Settings (LLM provider, model, API keys): stored in resume_settings (per-user)
5. Uses .maybeSingle() for settings queries (returns null for new users)
```

---

## State Management

The application uses pure React hooks (no external state library):

### Local State (`useState`)
All primary state lives in `LatexResumeTailorApp` and is passed to children via props.

### Ref-Based State (`useRef`)
Non-render-critical state uses refs to avoid unnecessary re-renders:
- `pastLatexRef` — Undo stack (array of previous LaTeX states)
- `futureLatexRef` — Redo stack
- `editorViewRef` — CodeMirror EditorView instance
- `abortControllerRef` — AbortController for cancellable requests
- `pdfViewerRef` — PdfCanvasViewer imperative handle (for `scrollToPage()`)
- `liveZoomRef` — Current zoom level (bypasses React during active pinch/wheel)
- `onZoomChangeRef` — Stable callback ref for zoom commit (avoids stale closures)
- `renderedZoomRef` — Last zoom level at which canvases were rasterized (prevents redundant re-renders)

### Memoization (`useMemo`, `useCallback`)
- `useMemo` for expensive computations: LaTeX parsing, section pagination, layout derivation
- `useCallback` for event handlers passed to child components

### Persistence

**Supabase (primary, when authenticated):**
| Table | Data |
|-------|------|
| `resume_projects` | LaTeX source, company/role, JD, project name per user |
| `resume_settings` | LLM provider, model, API keys per user |
| `resume_drafts` | Project draft data per user |

**localStorage (fallback / supplementary):**
| Key | Data |
|-----|------|
| `resume-tailor-projects-v1` | Project drafts array (JSON) — used when not authenticated |
| `resume-tailor-llm-settings-v1` | Provider, model, and API keys per provider — legacy fallback |

### History/Undo System
- Debounced tracking: LaTeX changes are recorded to the undo stack after 450ms of inactivity
- Max stack depth prevents unbounded memory growth
- Redo stack clears on new edits (standard undo/redo semantics)

---

## AI/LLM Integration

### Supported Providers

| Provider | SDK | Default Model | Temperature |
|----------|-----|---------------|-------------|
| Gemini | `@google/genai` | gemini-2.5-pro | 0.25 (suggestions), 0.3 (polish), 0.2 (audit) |
| Claude | `@anthropic-ai/sdk` | claude-sonnet-4-20250514 | Same |
| Groq | `groq-sdk` | llama-3.3-70b-versatile | Same |

### API Key Resolution

Priority order:
1. Per-request `apiKey` field (user-provided in settings panel)
2. Environment variable (`GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`)

### Error Handling

| Error | Status | Behavior |
|-------|--------|----------|
| Missing key | 500 | Prompt user to add key |
| Invalid key | 401 | Show "Invalid API key" |
| Quota exceeded | 429 | Show retry message, include `Retry-After` header |
| Provider busy | 503 | Show retry message |
| Invalid response shape | 500 | Zod validation error |
| Truncated JSON | — | Recovery logic attempts to fix common issues |

### JSON Recovery Logic

The suggestions endpoint includes robust JSON parsing that handles:
- Unescaped newlines in strings
- Truncated responses (reconstructs closing brackets)
- Missing quotes around property values
- BOM and invisible characters
- Markdown code fences wrapping the JSON

### Gemini Retry Logic

For Gemini specifically, the suggestions endpoint implements model fallback:
- Tries models in order: `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.0-flash`
- On 429/503 errors, retries with the next model in the chain

---

## Editor Extensions

### Suggestion Extension (`latex-editor-suggestions.ts`)

CodeMirror 6 extension that renders inline suggestion widgets.

**Function:** `createLatexSuggestionExtension(config)`

**Config:**
- `suggestions` — Current suggestion array
- `sections` — Parsed resume sections
- `onAccept(id)` — Callback when user clicks accept
- `onDecline(id)` — Callback when user clicks decline

**Rendering:**
- `LatexInlineSuggestionWidget` — Custom `WidgetType` that renders a diff-style UI:
  - Strikethrough for original text (red)
  - Highlighted new text (green)
  - Accept (checkmark) and Decline (X) buttons
- Positioned at the target line in the editor using `Decoration.widget`
- Custom theme (`latexSuggestionTheme`) with branded colors

---

### Polish Extension (`latex-polish-extension.ts`)

CodeMirror 6 extension for inline text polishing via tooltip menu.

**Function:** `createPolishExtension(config)`

**Config:**
- `onPolish(text, action)` — Callback to trigger polish API call
- `polishState` — Current polish operation state
- `onAcceptPolish()` — Accept polished text
- `onDismissPolish()` — Dismiss/cancel

**Behavior:**
1. User selects text in editor → tooltip menu appears above selection
2. Menu shows 5 action buttons with icons:
   - Improve (FiTrendingUp)
   - Elaborate (FiFileText)
   - Professional (FiBriefcase)
   - Concise (FiScissors)
   - Quantify (FiBarChart2)
3. On action click → sends streaming request
4. `PolishDiffWidget` renders inline diff with loading spinner
5. Accept replaces the selected text; Dismiss reverts

---

## PDF Pipeline

### Extraction (Upload)

Uses `pdfjs-dist` to extract text and positioning from uploaded PDF resumes:

1. Load PDF document via `pdfjsLib.getDocument()`
2. For each page, get text content items with transforms
3. Group items into lines by vertical position (Y-coordinate tolerance)
4. Sort lines top-to-bottom, items within lines left-to-right
5. Detect section boundaries (large/bold text, ALL CAPS headings)
6. Map PDF fonts to web font families (e.g., "TimesNewRoman-Bold" → "Times New Roman", weight 700)
7. Calculate layout metadata: x, y, width, height, fontSize, fontWeight, textAlign

### Compilation (Download)

1. **Normalization** — Before compilation, LaTeX is adjusted per engine:
   - For XeTeX/Tectonic: strips `\usepackage[T1]{fontenc}`, adjusts font commands
   - For all: wraps bare URLs in `\url{}` commands

2. **Execution** — Spawns compiler as child process with:
   - Working directory: `tmp/latex-compile/<uuid>/`
   - Timeout: 60s (tectonic) to 120s (pdflatex/xelatex)
   - Two passes for pdflatex (cross-reference resolution)

3. **Caching** — Compiled PDFs stored in-memory with 30-minute TTL for preview access

4. **Cloud Fallback** — When no local compiler exists:
   - Sends LaTeX source to texlive.net API
   - Returns compiled PDF directly

---

## Caching Strategy

| Cache | Location | TTL | Purpose |
|-------|----------|-----|---------|
| PDF Preview | In-memory (server) | 30 minutes | Serve compiled PDFs via `/preview/[id]` without recompilation |
| SyncTeX Data | In-memory (server) | 30 minutes | Co-located with PDF cache entry, served via `/synctex/[id]` |
| SyncTeX Mapping | In-memory (client) | Session | Parsed `SynctexMapping` struct for forward/inverse sync lookups |
| Resume Projects | Supabase (PostgreSQL) | Permanent | Per-user project data with RLS |
| LLM Settings | Supabase (PostgreSQL) | Permanent | Per-user provider, model, API key preferences |
| Project Drafts | localStorage (fallback) | Permanent | Persist user's project inputs when not authenticated |
| Editor History | In-memory (refs) | Session | Undo/redo stack for LaTeX editor |

---

## Configuration

### `next.config.ts`

Minimal configuration — empty `NextConfig` object (Next.js defaults).

### `tsconfig.json`

- Target: ES2017
- Module: ESNext with bundler resolution
- Strict mode enabled
- Path alias: `@/*` → project root
- JSX: preserve (handled by Next.js)

### `tailwind.config.ts`

- Dark mode: `class` strategy
- Content: `./app/**`, `./components/**`, `./lib/**`
- Custom theme:
  - CSS variable-based HSL color system (background, foreground, primary, secondary, muted, accent, destructive, card, popover, border, input, ring)
  - Custom `resume` box-shadow
  - Custom border-radius from CSS variable (`--radius`)
- Plugins: none

### `postcss.config.mjs`

- Plugins: Tailwind CSS, Autoprefixer

---

## Development Notes

- **Server state:** PDF and SyncTeX data are cached in-memory (30-minute TTL) for preview access; no persistent server-side state
- **Authentication:** Supabase Auth (email/password) with Row Level Security on all user tables; app works without auth in local-only mode
- **User data:** Stored in Supabase PostgreSQL when authenticated, falls back to localStorage for unauthenticated use
- API keys can be provided per-request or via environment variables; user-supplied keys stored in Supabase `resume_settings`
- PDF compilation creates temporary directories that are cleaned up after each request
- SyncTeX `.synctex.gz` files are generated alongside PDFs and cached together; unavailable for cloud compiles
- The app dynamically imports the main component with SSR disabled since it relies on browser APIs (Canvas, File, localStorage, DecompressionStream)
- CodeMirror extensions are rebuilt on each relevant state change via `useMemo`
- The PDF canvas viewer uses a React-bypass pattern for smooth zoom: refs hold live state, direct DOM manipulation during active gestures, debounced React state commits after gesture ends
