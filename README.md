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
- **Real-time Preview** — Parsed A4 resume preview with pagination and interactive source navigation
- **PDF Compilation** — Local (pdflatex/xelatex/tectonic) or cloud (texlive.net) LaTeX compilation
- **Project Management** — Add/edit projects with structured fields or bulk JSON editing
- **Multi-Provider LLM** — Switch between Gemini, Claude, and Groq with per-provider API key management
- **PDF Upload** — Upload existing PDF resumes with automatic text extraction and structure detection
- **Download** — Export as compiled PDF or raw `.tex` source
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
| PDF | pdfjs-dist (extraction), html2pdf.js (export) |
| Validation | Zod |
| Animation | Framer Motion |
| Icons | Lucide React, React Icons |
| Notifications | Sonner |
| Package Manager | pnpm |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ LaTeX Editor │  │  Resume Preview  │  │   PDF Preview    │  │
│  │ (CodeMirror) │  │  (Parsed A4)     │  │   (iframe)       │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘  │
│         │                   │                      │            │
│  ┌──────┴───────────────────┴──────────────────────┴─────────┐  │
│  │              LatexResumeTailorApp (Main State)             │  │
│  │  - LaTeX source, suggestions, reviews, projects, LLM cfg  │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP (fetch)
┌───────────────────────────────┼─────────────────────────────────┐
│                        Server (Next.js API)                      │
│                               │                                 │
│  ┌────────────┐  ┌───────────┴──┐  ┌───────────┐  ┌─────────┐ │
│  │ /suggestions│  │ /compile-latex│  │  /polish  │  │  /audit │ │
│  │ (JSON)     │  │ (PDF binary) │  │ (stream)  │  │ (JSON)  │ │
│  └─────┬──────┘  └──────┬───────┘  └─────┬─────┘  └────┬────┘ │
│        │                │                 │              │      │
│  ┌─────┴────────────────┴─────────────────┴──────────────┴───┐  │
│  │          LLM Providers (Gemini / Claude / Groq)           │  │
│  │          LaTeX Compilers (pdflatex / xelatex / tectonic)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
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
│       ├── compile-latex/route.ts# LaTeX → PDF compilation
│       ├── audit/route.ts        # ATS resume audit
│       ├── preview/[id]/route.ts # Cached PDF preview retrieval
│       └── test-key/route.ts     # API key validation
├── components/                   # React components
│   ├── latex-resume-tailor-app.tsx    # Main application (2898 lines)
│   ├── latex-resume-preview.tsx       # A4 resume preview renderer
│   ├── latex-project-fields.tsx       # Project draft form/JSON editor
│   ├── latex-suggestion-panel.tsx     # Suggestion review panel
│   ├── latex-pdf-preview.tsx          # PDF iframe viewer
│   ├── latex-editor-suggestions.ts    # CodeMirror suggestion extension
│   ├── latex-polish-extension.ts      # CodeMirror polish extension
│   ├── home-resume-loader.tsx         # Dynamic import loader
│   └── ui/                            # shadcn/ui primitives
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       └── textarea.tsx
├── lib/                          # Core logic and utilities
│   ├── latex-resume.ts           # LaTeX parsing, manipulation, templates
│   ├── resume.ts                 # Resume data structures and operations
│   ├── pdf.ts                    # PDF text extraction and layout analysis
│   ├── pdf-cache.ts              # In-memory PDF preview cache
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
| `GEMINI_API_KEY` | At least one | Google Gemini API key |
| `GROQ_API_KEY` | At least one | Groq API key |
| `ANTHROPIC_API_KEY` | At least one | Anthropic Claude API key |

At minimum, one provider key is needed. Users can also supply keys via the in-app settings panel (stored in localStorage, sent per-request).

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
- `X-Preview-Id: <id>` (for cached retrieval)
- `X-Compiler: <engine>`

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
   - Runs compiler (2 passes for pdflatex to resolve cross-references)
   - Parses log file for diagnostics
   - Caches PDF for preview retrieval
4. For cloud compilation:
   - Sends source to texlive.net API
   - Returns compiled PDF

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

In-memory PDF preview cache with TTL-based eviction.

| Export | Description |
|--------|-------------|
| `generatePreviewId(): string` | Creates a 12-character hex ID |
| `storePdf(id: string, pdf: Buffer): void` | Stores compiled PDF with timestamp (triggers eviction) |
| `getPdf(id: string): Buffer \| null` | Retrieves PDF if within 30-minute TTL, returns null otherwise |

**Behavior:**
- Uses `globalThis` for persistence across hot reloads in development
- 30-minute TTL per entry
- Auto-evicts expired entries on every `storePdf()` call
- No size limit (bounded by TTL and server memory)

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
| `viewMode` | `"preview" \| "pdf"` | Current preview mode |
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
   b. Normalizes LaTeX (XeTeX/Tectonic compatibility)
   c. Writes source file, runs compiler (2 passes for pdflatex)
   d. On success: reads PDF, stores in cache, returns binary
   e. On failure: parses log, returns diagnostics
5. Client receives PDF blob → creates object URL → displays in iframe
6. Diagnostics (if any) shown as inline editor annotations
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

### Memoization (`useMemo`, `useCallback`)
- `useMemo` for expensive computations: LaTeX parsing, section pagination, layout derivation
- `useCallback` for event handlers passed to child components

### Persistence (localStorage)
| Key | Data |
|-----|------|
| `resume-tailor-projects-v1` | Project drafts array (JSON) |
| `resume-tailor-llm-settings-v1` | Provider, model, and API keys per provider |

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
| Project Drafts | localStorage | Permanent | Persist user's project inputs across sessions |
| LLM Settings | localStorage | Permanent | Persist provider, model, and API key selections |
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

- The app is **stateless on the server** — no database, no authentication, no sessions
- All user data lives in the browser (localStorage + component state)
- API keys can be provided per-request or via environment variables
- PDF compilation creates temporary directories that are cleaned up after each request
- The app dynamically imports the main component with SSR disabled since it relies on browser APIs (Canvas, File, localStorage)
- CodeMirror extensions are rebuilt on each relevant state change via `useMemo`
