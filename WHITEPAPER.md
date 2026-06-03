# AURABIO: AI-Powered Resume Tailoring & Portfolio Generation Platform

## White Paper v1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [System Architecture](#system-architecture)
5. [Core Technology Stack](#core-technology-stack)
6. [Feature Breakdown](#feature-breakdown)
7. [AI & LLM Integration](#ai--llm-integration)
8. [LaTeX Compilation Pipeline](#latex-compilation-pipeline)
9. [Bidirectional SyncTeX Engine](#bidirectional-synctex-engine)
10. [Portfolio Generation & Deployment](#portfolio-generation--deployment)
11. [Security Architecture](#security-architecture)
12. [Performance Engineering](#performance-engineering)
13. [API Reference](#api-reference)
14. [Data Model & Persistence](#data-model--persistence)
15. [Deployment Strategy](#deployment-strategy)
16. [Competitive Differentiation](#competitive-differentiation)
17. [Future Roadmap](#future-roadmap)
18. [Conclusion](#conclusion)

---

## Executive Summary

**AURABIO** is a production-grade, full-stack web application that transforms the resume tailoring and portfolio generation process through intelligent automation. By combining a professional-grade LaTeX editor with multi-provider AI suggestions, bidirectional PDF synchronization, and one-click portfolio deployment, AURABIO delivers an end-to-end career document management platform.

### Key Metrics

| Metric | Value |
|--------|-------|
| LLM Providers Supported | 3 (Gemini, Claude, Groq) |
| LaTeX Compilers in Pipeline | 4 (pdflatex, xelatex, tectonic, cloud) |
| Text Refinement Modes | 5 (improve, elaborate, professional, concise, quantify) |
| AI Suggestion Phases | 7 (decomposition → validation → layout) |
| Deployment Targets | 2 (Netlify, Vercel) |
| PDF Zoom Range | 50%–300% |

### Core Innovation

AURABIO introduces **Overleaf-style bidirectional SyncTeX navigation** in a web application — click a line in the editor to highlight the corresponding region in the compiled PDF, or click the PDF to jump directly to the source code. This is combined with a **hybrid zoom architecture** that uses CSS transforms for instant visual feedback and debounced PDF.js re-rasterization for sharp rendering, achieving smooth 60fps interactions without React re-render overhead.

---

## Problem Statement

### The Resume Tailoring Challenge

Job seekers face a critical bottleneck in the modern hiring process: **each application requires a tailored resume** that aligns with the specific job description, company culture, and ATS (Applicant Tracking System) requirements. The current landscape presents several pain points:

1. **Manual Tailoring is Time-Intensive**: Professionals spend 30–90 minutes customizing each resume for a single application, making high-volume job searches unsustainable.

2. **LaTeX Resume Users Lack AI Tools**: While tools like Overleaf provide excellent LaTeX editing, they offer no AI-powered content optimization. Conversely, AI resume builders lack LaTeX support, forcing users to choose between typographic quality and intelligent assistance.

3. **ATS Compatibility is Opaque**: Applicants cannot easily verify whether their PDF will be parsed correctly by ATS systems, leading to invisible rejection of qualified candidates.

4. **Portfolio Generation is Disconnected**: Maintaining a portfolio website separately from a resume creates synchronization overhead and inconsistency.

5. **Fragmented Tooling**: Resume editing, AI suggestion, PDF compilation, and portfolio deployment exist as separate, disconnected services — each requiring its own account, workflow, and mental model.

### Market Gap Analysis

| Capability | Overleaf | AI Resume Builders | Generic AI | AURABIO |
|------------|----------|-------------------|------------|---------|
| LaTeX Editor | Yes | No | No | Yes |
| AI Suggestions | No | Yes (limited) | Yes (generic) | Yes (specialized) |
| Bidirectional PDF Sync | Yes | No | No | Yes |
| Multi-LLM Support | No | No | Single provider | 3 providers |
| ATS Optimization | No | Partial | No | Yes |
| Portfolio Generation | No | No | No | Yes |
| One-Click Deployment | No | No | No | Yes |
| JD-Aligned Tailoring | No | Basic | Manual | Automated |

---

## Solution Overview

AURABIO addresses these challenges through an integrated platform that unifies five traditionally separate workflows:

### 1. Intelligent Resume Editing
A CodeMirror 6-based LaTeX editor with syntax highlighting, undo/redo, and real-time diagnostics — providing the editing experience of Overleaf with the AI capabilities of modern language models.

### 2. AI-Powered Content Optimization
Multi-provider LLM integration (Gemini, Claude, Groq) generates job-description-aligned suggestions through a proprietary 7-phase prompt engineering pipeline that ensures relevance, accuracy, and ATS compatibility.

### 3. Professional PDF Compilation
A multi-compiler pipeline with automatic fallback ensures reliable PDF generation regardless of the user's local environment, with SyncTeX support for bidirectional source-PDF navigation.

### 4. Inline Text Refinement
A streaming text polish system offers 5 refinement modes (improve, elaborate, professional, concise, quantify) with real-time token delivery and inline diff visualization.

### 5. Portfolio Generation & Deployment
Automatic extraction of resume data into a customizable portfolio website, with GitHub/LeetCode integration and one-click deployment to Netlify or Vercel.

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                                │
│                                                                         │
│  ┌─────────────────────┐         ┌───────────────────────────────────┐  │
│  │   CodeMirror 6      │◄───────►│   PDF.js Canvas Viewer            │  │
│  │   LaTeX Editor      │ SyncTeX │   Hybrid Zoom Engine              │  │
│  │   + Polish Tooltip  │         │   + Forward/Inverse Sync          │  │
│  └─────────┬───────────┘         └──────────────┬────────────────────┘  │
│            │                                     │                       │
│  ┌─────────┴─────────────────────────────────────┴────────────────────┐  │
│  │          LatexResumeTailorApp (State Orchestrator)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────────┐   │  │
│  │  │  LaTeX   │ │   AI     │ │  Project │ │    Undo/Redo        │   │  │
│  │  │  Source  │ │ Suggest. │ │  Drafts  │ │    History Stack     │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────────────┘   │  │
│  └────────────────────────────┬───────────────────────────────────────┘  │
│                               │                                          │
│  ┌────────────────────────────┴───────────────────────────────────────┐  │
│  │          Portfolio Generator (Independent Module)                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────────┐   │  │
│  │  │  Resume  │ │  GitHub  │ │ LeetCode │ │  HTML Generation    │   │  │
│  │  │  Extract │ │  Stats   │ │  Stats   │ │  + Deploy Engine    │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ HTTPS (fetch, streaming)
┌───────────────────────────────────┼──────────────────────────────────────┐
│                     NEXT.JS API LAYER (Server)                            │
│                                   │                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │  /resume/    │ │  /resume/    │ │  /resume/    │ │  /portfolio/   │  │
│  │  suggestions │ │  polish      │ │  compile-    │ │  github        │  │
│  │  (AI engine) │ │  (streaming) │ │  latex       │ │  leetcode      │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │  deploy/*     │  │
│         │                │                │          └───────┬────────┘  │
│         │                │                │                  │            │
│  ┌──────┴────────────────┴────────────────┴──────────────────┴────────┐  │
│  │                    External Service Layer                           │  │
│  │                                                                     │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │  LLM    │  │  LaTeX   │  │  Deploy  │  │    Data APIs      │   │  │
│  │  │ Gemini  │  │ pdflatex │  │ Netlify  │  │  GitHub GraphQL   │   │  │
│  │  │ Claude  │  │ xelatex  │  │ Vercel   │  │  LeetCode GQL     │   │  │
│  │  │ Groq    │  │ tectonic │  │          │  │                   │   │  │
│  │  │         │  │ cloud    │  │          │  │                   │   │  │
│  │  └─────────┘  └──────────┘  └──────────┘  └───────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                   │                                       │
│  ┌────────────────────────────────┴───────────────────────────────────┐  │
│  │              SUPABASE (PostgreSQL + Auth + RLS)                     │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────────┐   │  │
│  │  │ resume_      │ │ portfolio_   │ │ resume_project_drafts     │   │  │
│  │  │ projects     │ │ data         │ │ resume_settings           │   │  │
│  │  └──────────────┘ └──────────────┘ └───────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Architectural Principles

1. **Separation of Concerns**: Client-side rendering and interaction logic is isolated from server-side compilation and AI processing.
2. **Graceful Degradation**: Multi-compiler fallback ensures functionality regardless of environment constraints.
3. **Security by Default**: Row Level Security (RLS) enforces data isolation at the database layer, not the application layer.
4. **Performance-First Rendering**: React-bypass patterns and hybrid zoom prevent UI jank in performance-critical paths.
5. **Provider Agnosticism**: LLM integration abstracts provider differences behind a unified suggestion interface.

---

## Core Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15 | Full-stack React framework (App Router) |
| React | 19 | UI component library |
| TypeScript | 5 | Type-safe development |
| Tailwind CSS | 3 | Utility-first styling |
| CodeMirror | 6 | LaTeX source editor |
| PDF.js | 4.10.38 | PDF rendering engine |
| Radix UI | Latest | Accessible UI primitives |
| Framer Motion | Latest | Animations and transitions |
| Zod | 3.24.1 | Runtime schema validation |

### Backend & Infrastructure

| Technology | Purpose |
|-----------|---------|
| Next.js API Routes | Serverless API endpoints |
| Supabase | PostgreSQL database, authentication, RLS |
| @supabase/ssr | Server-side session management |
| pdflatex/xelatex/tectonic | Local LaTeX compilation |
| texlive.net | Cloud LaTeX compilation fallback |

### AI/LLM Providers

| Provider | SDK | Use Case |
|---------|-----|----------|
| Google Gemini | @google/genai | Primary suggestion engine |
| Anthropic Claude | @anthropic-ai/sdk | High-quality text refinement |
| Groq | groq-sdk | Fast inference for real-time polish |

---

## Feature Breakdown

### 1. AI-Powered Resume Suggestions

The suggestion engine employs a **7-phase prompt architecture** designed to produce actionable, non-fabricated resume improvements:

```
Phase 1: JD Decomposition
    → Extract key requirements, technologies, and qualifications

Phase 2: Project Scoring
    → Rank user's projects by relevance to decomposed requirements

Phase 3: Bullet Construction
    → Craft impactful, quantified bullet points using STAR methodology

Phase 4: Skills Optimization
    → Align skills section with JD keywords and ATS requirements

Phase 5: Summary Generation
    → Generate a compelling professional summary

Phase 6: Validation Gate
    → Verify no fabricated claims, hallucinated metrics, or false attributions

Phase 7: Layout Density Enforcement
    → Ensure optimal information density within page constraints
```

**Output Format**: Structured JSON with per-suggestion metadata:
- `action`: replace | insert | delete
- `originalText` / `suggestedText`: Diff-able content
- `reason`: Human-readable justification
- `jdMatchReason`: Explicit alignment with job description

### 2. Streaming Text Polish

Five specialized refinement modes for in-place text optimization:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Improve** | Fix weak verbs, eliminate passive voice, sharpen impact | General improvement |
| **Elaborate** | Expand 1.5–2x with technical context and specifics | Thin bullet points |
| **Professional** | Corporate tone, industry terminology, executive language | Career transitions |
| **Concise** | Trim filler, target single clean line | Space optimization |
| **Quantify** | Add scale, impact numbers, and measurable outcomes | ATS optimization |

**Delivery Mechanism**: Web Streams API delivers tokens in real-time, with an inline CodeMirror diff widget showing original vs. polished text before user acceptance.

### 3. Multi-Compiler LaTeX Pipeline

```
User LaTeX Source
       │
       ▼
┌─────────────────┐     ┌─────────────────┐
│   pdflatex      │────►│   xelatex       │
│   (2-pass)      │fail │   (Unicode)     │
│   + SyncTeX     │     │   + SyncTeX     │
└────────┬────────┘     └────────┬────────┘
         │success                │fail
         ▼                       ▼
    ┌─────────┐          ┌─────────────────┐
    │  PDF +  │          │   tectonic      │
    │ SyncTeX │          │   (Rust-based)  │
    └─────────┘          └────────┬────────┘
                                  │fail
                                  ▼
                         ┌─────────────────┐
                         │  texlive.net    │
                         │  (Cloud API)    │
                         │  No SyncTeX     │
                         └────────┬────────┘
                                  │
                                  ▼
                            ┌─────────┐
                            │   PDF   │
                            └─────────┘
```

**ATS Compatibility Enhancements**:
- Auto-injects `\pdfgentounicode=1` for Unicode text extraction
- Includes `\input{glyphtounicode}` for glyph mapping
- Engine-specific normalization for consistent output

### 4. Bidirectional SyncTeX Navigation

**Forward Sync (Editor → PDF)**:
1. User clicks a line in the editor
2. System queries SyncTeX mapping for line number
3. Fuzzy lookup (±5 lines) finds nearest mapped element
4. Coordinate transformation: scaled points → PDF page coordinates
5. Semi-transparent yellow overlay rendered on PDF canvas (2s auto-fade)

**Inverse Sync (PDF → Editor)**:
1. User clicks a point on the PDF
2. Click coordinates transformed to PDF coordinate space
3. Nearest-neighbor Euclidean distance search in SyncTeX records
4. Source line number resolved with offset correction
5. Editor scrolls to and highlights the corresponding line

### 5. PDF Canvas Viewer with Hybrid Zoom

The hybrid zoom architecture solves a fundamental tension: PDF.js re-rasterization is expensive (100–300ms) but CSS transforms are instant (16ms). AURABIO combines both:

```
User Zoom Input (wheel/pinch/button)
       │
       ▼
┌─────────────────────────────┐
│  Instant Visual Response    │
│  CSS transform: scale(N)   │  ← 0ms latency, 60fps
│  No React re-render        │
│  Direct DOM manipulation    │
└──────────────┬──────────────┘
               │ 300ms idle
               ▼
┌─────────────────────────────┐
│  Sharp Re-rasterization     │
│  PDF.js render at target    │  ← Full resolution
│  resolution, reset CSS      │
│  transform to scale(1)      │
└─────────────────────────────┘
```

**React Bypass Pattern**: Zoom state is held in `useRef` rather than `useState`, preventing unnecessary re-renders during gesture-heavy interactions. Only the final sharp render triggers a state update.

---

## AI & LLM Integration

### Provider Architecture

AURABIO implements a **provider-agnostic AI layer** that normalizes the interface across three LLM providers while preserving provider-specific optimizations:

```typescript
interface LLMProvider {
  generateSuggestions(context: SuggestionContext): Promise<SuggestionResponse>
  streamPolish(text: string, mode: PolishMode): AsyncGenerator<string>
  validateApiKey(key: string): Promise<boolean>
}
```

### Model Selection & Fallback

| Provider | Primary Model | Fallback Models |
|---------|---------------|-----------------|
| Gemini | gemini-2.0-flash | gemini-1.5-flash, gemini-1.5-pro |
| Claude | claude-sonnet-4-20250514 | claude-3-haiku |
| Groq | llama-3.3-70b-versatile | mixtral-8x7b |

**Automatic Fallback**: On quota exhaustion or availability errors, the system retries with progressively smaller models before returning an error to the user.

### Prompt Engineering

The suggestion prompt incorporates:
- **Resume context**: Full LaTeX source parsed into sections
- **Job description**: Up to 20,000 characters of target JD
- **Project details**: Formatted project descriptions from drafts
- **Constraints**: No fabrication, ATS optimization, page density limits
- **Output schema**: Strict JSON format with Zod validation

### Response Recovery

LLM responses are inherently unpredictable. AURABIO implements robust JSON recovery:
1. Standard `JSON.parse()` attempt
2. Regex extraction of JSON from markdown code blocks
3. Truncation repair (closes open brackets/braces)
4. Partial response acceptance (valid suggestions from incomplete responses)
5. Schema validation via Zod with graceful degradation

---

## Security Architecture

### Authentication Flow

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Sign Up │───►│  Email Sent  │───►│  /auth/      │───►│  Session     │
│  (email/ │    │  (confirm    │    │  callback    │    │  Created     │
│  password)│    │   link)      │    │  (code       │    │  (JWT in     │
└──────────┘    └──────────────┘    │   exchange)  │    │   cookie)    │
                                    └──────────────┘    └──────────────┘
```

### Security Layers

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| **Network** | HTTPS enforcement, SameSite cookies | All traffic |
| **Authentication** | Supabase Auth (JWT), email confirmation | User identity |
| **Authorization** | Row Level Security (RLS) policies | Data access |
| **Route Protection** | Next.js middleware | Page access |
| **API Validation** | Zod schemas, input length limits | Request integrity |
| **Key Isolation** | Browser cookies (never server-stored) | API key safety |

### Row Level Security Policies

All user-facing tables enforce strict isolation:

```sql
-- Every table enforces this pattern:
CREATE POLICY "Users can only access own data"
ON resume_projects
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

This ensures that even in the event of an application-layer vulnerability, users cannot access other users' data at the database level.

### API Key Management

```
┌─────────────────────────────────────────────────────────┐
│                  API Key Lifecycle                        │
│                                                          │
│  User Input ──► Browser Cookie (SameSite=Strict)        │
│                 365-day expiry, path=/                   │
│                 Never sent to Supabase                   │
│                 Only sent to Next.js API routes          │
│                 Used server-side for LLM calls           │
│                 Never logged or persisted server-side    │
└─────────────────────────────────────────────────────────┘
```

---

## Performance Engineering

### Optimization Strategies

| Strategy | Implementation | Impact |
|----------|---------------|--------|
| **Hybrid Zoom** | CSS transform + debounced re-render | 60fps zoom, no jank |
| **React Bypass** | useRef for hot-path state | Zero unnecessary re-renders |
| **Code Splitting** | Dynamic imports, SSR disabled | Faster initial load |
| **PDF Caching** | In-memory, 30-min TTL | No recompilation on revisit |
| **Undo Debouncing** | 450ms idle threshold | Efficient history stack |
| **Streaming AI** | Web Streams API | Instant feedback, no waiting |
| **Committed State** | Preview updates on explicit action | No iframe thrashing |
| **SyncTeX Fuzzy Lookup** | ±5 line range, Euclidean nearest | Robust click targeting |

### Memory Management

- **PDF Cache**: Auto-eviction on overflow, configurable max entries
- **Undo Stack**: Bounded depth prevents unbounded growth
- **SyncTeX Data**: Loaded on-demand, garbage collected on project switch
- **Editor Extensions**: Lazy-loaded CodeMirror plugins

---

## API Reference

### Resume Endpoints

#### `POST /api/resume/suggestions`
Generates AI-powered resume suggestions aligned to a job description.

**Request Body**:
```json
{
  "resumeSections": [{"id": "string", "title": "string", "lines": [...]}],
  "project": "string (formatted project details)",
  "companyRole": "string (max 300 chars)",
  "jd": "string (max 20,000 chars)",
  "provider": "gemini | groq | claude",
  "model": "string (optional model override)",
  "apiKey": "string (optional key override)"
}
```

**Response** (200):
```json
{
  "suggestions": [{
    "id": "string",
    "targetLineId": "string",
    "sectionId": "string",
    "action": "replace | insert | delete",
    "originalText": "string",
    "suggestedText": "string",
    "reason": "string",
    "jdMatchReason": "string"
  }],
  "sectionReviews": [{
    "sectionId": "string",
    "status": "good | needs_changes | critical",
    "summary": "string"
  }]
}
```

#### `POST /api/resume/polish`
Streaming text refinement with 5 modes.

**Request Body**:
```json
{
  "text": "string (max 5,000 chars)",
  "action": "improve | elaborate | professional | concise | quantify",
  "provider": "gemini | groq | claude",
  "apiKey": "string (optional)"
}
```

**Response**: `text/plain` stream (token-by-token delivery)

#### `POST /api/resume/compile-latex`
Compiles LaTeX source to PDF with SyncTeX mapping.

**Request Body**:
```json
{
  "latex": "string (max 250,000 chars)",
  "engine": "pdflatex | xelatex | tectonic (optional)"
}
```

**Response**: `application/pdf` binary with headers:
- `X-Preview-Id`: Cache key for subsequent retrieval
- `X-Compiler`: Engine that produced the PDF
- `X-Synctex-Available`: Boolean indicating SyncTeX availability

#### `GET /api/resume/preview/[id]`
Retrieves a cached PDF by preview ID. Returns 404 if cache expired (30-min TTL).

#### `GET /api/resume/synctex/[id]`
Retrieves compressed SyncTeX mapping for bidirectional navigation.

**Response**: `application/gzip` binary with `X-Line-Offset` header.

#### `POST /api/resume/audit`
ATS audit analyzing quantification, repetition, and grammar issues.

#### `POST /api/resume/test-key`
Validates an API key against the specified provider.

### Portfolio Endpoints

#### `GET /api/portfolio/github?username={username}`
Fetches GitHub profile statistics and contribution calendar.

#### `GET /api/portfolio/leetcode?username={username}`
Fetches LeetCode submission statistics via GraphQL API.

#### `POST /api/portfolio/deploy/netlify`
Deploys portfolio HTML to Netlify with optional site redeployment.

#### `POST /api/portfolio/deploy/vercel`
Deploys portfolio HTML to Vercel with project creation and status polling.

---

## Data Model & Persistence

### Database Schema (Supabase PostgreSQL)

```
┌─────────────────────────┐     ┌─────────────────────────┐
│    resume_projects      │     │  resume_project_drafts  │
├─────────────────────────┤     ├─────────────────────────┤
│ id (uuid, PK)          │◄────│ project_id (FK)         │
│ user_id (uuid, FK)     │     │ id (uuid, PK)           │
│ name (text)            │     │ user_id (uuid, FK)      │
│ latex_source (text)    │     │ title (text)            │
│ company (text)         │     │ content (jsonb)         │
│ role (text)            │     │ created_at (timestamptz)│
│ jd (text)             │     └─────────────────────────┘
│ created_at (timestamptz)│
│ updated_at (timestamptz)│     ┌─────────────────────────┐
└─────────────────────────┘     │    resume_settings      │
                                ├─────────────────────────┤
┌─────────────────────────┐     │ user_id (uuid, PK, FK) │
│    portfolio_data       │     │ llm_provider (text)    │
├─────────────────────────┤     │ llm_model (text)       │
│ user_id (uuid, PK, FK) │     │ updated_at (timestamptz)│
│ data (jsonb)           │     └─────────────────────────┘
│ updated_at (timestamptz)│
└─────────────────────────┘
```

### Storage Strategy

| Data Type | Storage Layer | Rationale |
|-----------|--------------|-----------|
| Resume source & metadata | Supabase PostgreSQL | Durable, cross-device sync |
| Project drafts | Supabase PostgreSQL | Linked to resume projects |
| Portfolio customizations | Supabase PostgreSQL (jsonb) | Flexible schema evolution |
| LLM API keys | Browser cookies (SameSite=Strict) | Security isolation |
| Provider preferences | Browser cookies + Supabase | Fast read + durable backup |
| Compiled PDFs | In-memory cache (30-min TTL) | Ephemeral, regenerable |
| SyncTeX mappings | In-memory cache (30-min TTL) | Ephemeral, regenerable |
| Unauthenticated state | localStorage | Offline-capable fallback |

---

## Deployment Strategy

### Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel / Node.js Host                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js Application                                   │  │
│  │  ├── Static Assets (CDN-cached)                       │  │
│  │  ├── Server Components (streaming SSR)                │  │
│  │  ├── API Routes (serverless functions)                │  │
│  │  └── Middleware (auth gate)                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                                │
└──────────────────────────────┼────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼───────┐    ┌───────▼───────┐
            │   Supabase    │    │  External     │
            │  (Database,   │    │  Services     │
            │   Auth, RLS)  │    │  (LLMs, LaTeX │
            │               │    │   Compilers)  │
            └───────────────┘    └───────────────┘
```

### Environment Configuration

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

# LLM Providers (server-side fallback)
GEMINI_API_KEY=[key]
GROQ_API_KEY=[key]
CLAUDE_API_KEY=[key]

# LaTeX (optional — cloud fallback available)
LATEX_COMPILER_PATH=/usr/bin/pdflatex
```

### Scaling Considerations

- **Stateless API Routes**: Each request is self-contained; scales horizontally via serverless
- **PDF Cache**: Per-instance in-memory; acceptable for single-instance deployments; Redis recommended for multi-instance
- **Database**: Supabase managed PostgreSQL with connection pooling (PgBouncer)
- **CDN**: Static assets and public files served via Vercel Edge Network

---

## Competitive Differentiation

### What Makes AURABIO Unique

| Innovation | Industry Status | AURABIO Approach |
|-----------|-----------------|------------------|
| **Web-based SyncTeX** | Available only in Overleaf (proprietary) | Open implementation with fuzzy lookup |
| **Hybrid Zoom** | No known web PDF viewers implement this | React-bypass + CSS transform + debounced render |
| **Multi-LLM Resume AI** | Single-provider tools dominate | 3 providers with automatic fallback |
| **7-Phase Prompt Pipeline** | Generic AI prompts | Specialized, validated, non-hallucinating |
| **LaTeX + AI Integration** | Separate ecosystems | Unified editor with inline suggestions |
| **Resume → Portfolio Pipeline** | Manual, disconnected | Automatic extraction + one-click deploy |
| **ATS-Optimized Compilation** | User responsibility | Automatic glyph-to-unicode injection |

### Technical Moats

1. **SyncTeX Parser**: Custom implementation parsing SyncTeX format in JavaScript — no existing npm package provides this capability.
2. **Hybrid Zoom Engine**: Novel architecture combining CSS transforms with selective re-rasterization, achieving desktop-app-level smoothness in the browser.
3. **7-Phase Prompt Engineering**: Extensive iteration on prompt structure to eliminate LLM hallucination in resume contexts while maximizing relevance.
4. **Multi-Compiler Pipeline**: Graceful degradation across 4 compilation backends ensures 100% compilation success rate regardless of environment.

---

## Future Roadmap

### Phase 1: Enhanced AI Capabilities
- **Cover Letter Generation**: Job-description-aligned cover letters using the same 7-phase pipeline
- **Interview Preparation**: AI-generated behavioral questions based on resume content
- **Resume Scoring**: Quantified ATS compatibility score with actionable improvement suggestions

### Phase 2: Collaboration & Sharing
- **Shareable Resume Links**: Public URLs for compiled PDFs with view analytics
- **Review Mode**: Invite reviewers to leave comments on specific resume sections
- **Version History**: Git-like version tracking with diff visualization

### Phase 3: Platform Expansion
- **Multiple Resume Templates**: Curated LaTeX templates for different industries
- **Resume Analytics**: Track which resume versions lead to interview callbacks
- **Job Board Integration**: Direct application submission from within the platform

### Phase 4: Enterprise Features
- **Team Management**: Organization-level accounts with shared templates
- **Compliance Tools**: Industry-specific resume requirements validation
- **API Access**: Public API for programmatic resume generation and optimization

---

## Conclusion

AURABIO represents a paradigm shift in career document management — unifying LaTeX editing, AI-powered optimization, professional compilation, and portfolio deployment into a single, cohesive platform. By addressing the full lifecycle of career document preparation, from initial drafting through ATS optimization to live portfolio hosting, AURABIO eliminates the fragmentation and manual overhead that characterize the current resume tooling landscape.

The platform's technical innovations — bidirectional SyncTeX navigation, hybrid zoom architecture, multi-compiler pipeline, and 7-phase AI prompt engineering — establish significant technical differentiation while delivering tangible user value: faster resume tailoring, higher-quality output, and reduced friction from draft to deployment.

---

## Technical Specifications Summary

| Specification | Value |
|--------------|-------|
| **Language** | TypeScript 5 (strict mode) |
| **Framework** | Next.js 15 (App Router) |
| **Runtime** | Node.js 18+ |
| **Database** | PostgreSQL (Supabase-managed) |
| **Authentication** | Supabase Auth (JWT + RLS) |
| **Package Manager** | pnpm |
| **License** | Proprietary |
| **Browser Support** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **Minimum Viewport** | 1024px (desktop-first) |

---

*White Paper v1.0 — May 2026*
*AURABIO — AI-Powered Resume Tailoring & Portfolio Generation Platform*
