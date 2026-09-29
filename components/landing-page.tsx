"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Globe,
  KeyRound,
  Mail,
  Menu,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#tools", label: "Tools" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#capabilities", label: "Features" },
  { href: "/api-docs", label: "API Docs" },
] as const;

const TOOLS = [
  {
    id: "resume",
    name: "Resume Tailor Studio",
    href: "/resume-generator",
    icon: FileText,
    badge: "Core",
    summary:
      "Edit LaTeX in CodeMirror 6, tailor bullets to a job description with Gemini, Claude, or Groq, polish inline, run an ATS audit, and compile with SyncTeX bidirectional PDF sync.",
    points: [
      "Local or cloud LaTeX compile (pdflatex, xelatex, tectonic)",
      "PDF upload & parse into structured resume data",
      "Fact-grounded suggestions — no fabricated metrics",
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio Generator",
    href: "/portfolio-generator",
    icon: Globe,
    badge: "Deploy",
    summary:
      "Turn resume data into a single-page HTML portfolio with GitHub and LeetCode enrichments, then deploy to Vercel or Netlify in one click.",
    points: [
      "Live preview with committed/uncommitted recompile",
      "GitHub contribution calendar & LeetCode stats",
      "Personal access token deploy to Vercel or Netlify",
    ],
  },
  {
    id: "cold-mail",
    name: "Cold Email Studio",
    href: "/cold-mail-generator",
    icon: Mail,
    badge: "Outreach",
    summary:
      "Generate recruiter outreach tailored to the company and role, grounded in your resume facts.",
    points: [
      "Role-aligned subject and body drafts",
      "Tone options for technical outreach",
      "Copy-ready output for your inbox",
    ],
  },
  {
    id: "pdf",
    name: "PDF Template Editor",
    href: "/pdf-editor",
    icon: SlidersHorizontal,
    badge: "Visual",
    summary:
      "Visually edit resume templates — fonts, margins, and sections — with live PDF canvas preview.",
    points: [
      "Curated LaTeX templates",
      "PDF.js high-DPI canvas rendering",
      "Export publication-ready PDF",
    ],
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Add your API key",
    body: "Bring Gemini, Claude, or Groq keys — stored client-side in your browser.",
    href: "/api-key",
  },
  {
    n: "02",
    title: "Load a resume or template",
    body: "Paste LaTeX, pick a template, or upload a PDF to parse into the editor.",
    href: "/resume-generator",
  },
  {
    n: "03",
    title: "Tailor to the job description",
    body: "Paste the JD, review grounded AI suggestions, polish bullets, and audit for ATS.",
    href: "/resume-generator",
  },
  {
    n: "04",
    title: "Export or deploy",
    body: "Download PDF / .tex, or generate a portfolio and deploy to Vercel or Netlify.",
    href: "/portfolio-generator",
  },
] as const;

const CAPABILITIES = [
  {
    icon: FileText,
    title: "LaTeX + SyncTeX",
    body: "CodeMirror 6 editor with bidirectional source ↔ PDF navigation — Overleaf-style click-to-sync.",
  },
  {
    icon: Sparkles,
    title: "Multi-LLM suggestions",
    body: "JD-aligned resume improvements via Gemini, Claude, or Groq — switch providers anytime.",
  },
  {
    icon: ShieldCheck,
    title: "Fact guardrails",
    body: "Suggestions stay grounded in your experience. Polish never invents metrics or skills.",
  },
  {
    icon: SearchCheck,
    title: "ATS audit",
    body: "Automated checks for quantified impact, repetition, and spelling — without needing a JD.",
  },
  {
    icon: Globe,
    title: "Portfolio deploy",
    body: "HTML portfolio from resume data with GitHub/LeetCode stats and one-click cloud deploy.",
  },
  {
    icon: Mail,
    title: "Cold email studio",
    body: "Recruiter outreach drafts aligned to the role and your real background.",
  },
] as const;

function ProductMock() {
  return (
    <div
      className="relative w-full min-h-[320px] overflow-hidden rounded-lg border border-border bg-card shadow-resume lg:min-h-[420px]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          resume.tex · SyncTeX live
        </span>
        <Badge variant="muted" className="ml-auto hidden font-mono sm:inline-flex">
          Fact-guarded · Gemini
        </Badge>
      </div>
      <div className="grid h-full md:grid-cols-2">
        <div className="border-b border-border bg-[hsl(220_23%_13%)] p-5 font-mono text-[11px] leading-relaxed text-[hsl(210_20%_78%)] md:border-b-0 md:border-r lg:p-6 lg:text-[12px]">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[hsl(173_40%_55%)]">
            Editor · line 38
          </div>
          <p>
            <span className="text-[hsl(48_70%_65%)]">\resumeSubheading</span>
            {"{Backend Eng}"}
            {"{2022–Present}"}
          </p>
          <p className="mt-3 rounded bg-[hsl(0_50%_20%/0.45)] px-2 py-1.5 text-[hsl(0_70%_78%)] line-through decoration-[hsl(0_60%_50%)]">
            Built Redis caching that cut p99 latency by 42%.
          </p>
          <p className="mt-2 rounded border-l-2 border-primary bg-[hsl(173_40%_20%/0.35)] px-2 py-1.5 text-[hsl(173_45%_78%)]">
            Engineered Redis caching for peak traffic, cutting p99 latency by{" "}
            <span className="text-white">42%</span> — metric sourced from your resume.
          </p>
          <p className="mt-4 text-[10px] text-[hsl(173_40%_55%)]">
            ✓ Ground-truth whitelist matched
          </p>
        </div>
        <div className="flex flex-col bg-white p-5 text-[hsl(220_23%_13%)] lg:p-6">
          <div className="border-b border-[hsl(210_18%_81%)] pb-2 text-center">
            <p className="font-display text-base font-semibold tracking-wide lg:text-lg">
              Alex Rivera
            </p>
            <p className="mt-0.5 text-[9px] text-[hsl(219_12%_39%)] lg:text-[10px]">
              alex@tech.dev · github.com/alexrivera
            </p>
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[hsl(173_80%_28%)]">
            Experience
          </p>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold lg:text-[11px]">
            <span>Backend Engineer</span>
            <span className="font-normal text-[hsl(219_12%_39%)]">2022–Present</span>
          </div>
          <p className="mt-2 rounded-sm border-l-2 border-primary bg-[hsl(173_40%_94%)] px-2 py-1.5 text-[9px] leading-snug lg:text-[10px]">
            Engineered Redis caching for peak traffic, cutting p99 latency by 42% — metric sourced
            from your resume.
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-[hsl(210_18%_88%)] pt-3 text-[9px] text-[hsl(219_12%_39%)]">
            <span className="inline-flex items-center gap-1 text-primary">
              <Check className="h-3 w-3" /> SyncTeX mapped
            </span>
            <span className="font-mono">pdflatex</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [activeTool, setActiveTool] = useState<(typeof TOOLS)[number]["id"]>("resume");
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const CurrentIcon = current.icon;

  return (
    <div className="landing-paper relative min-h-screen overflow-x-clip text-foreground selection:bg-primary/20">
      <div className="landing-grain" aria-hidden />

      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/aurabio-refined-logo.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">
              AURABIO
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/api-key">
                <KeyRound className="h-3.5 w-3.5" />
                API Key
              </Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/resume-generator">
                Launch Studio
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <ThemeToggle className="sm:hidden" />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) =>
                link.href.startsWith("/") ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ),
              )}
              <Separator className="my-1" />
              <Button variant="outline" size="sm" asChild>
                <Link href="/api-key" onClick={() => setMobileOpen(false)}>
                  API Key
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/resume-generator" onClick={() => setMobileOpen(false)}>
                  Launch Studio
                </Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero — one composition */}
      <section className="relative">
        <div className="landing-ink-wash absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:items-center lg:gap-10 lg:pb-24 lg:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
          >
            <p className="font-display text-[clamp(3.25rem,9vw,5.75rem)] font-semibold leading-[0.92] tracking-tight text-foreground">
              AURABIO
            </p>
            <h1 className="mt-5 font-display text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
              Tailor LaTeX resumes to the job — with AI that stays on your facts.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Precision editing, JD-aligned suggestions, SyncTeX PDF sync, and portfolios you can
              deploy in one click.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/resume-generator">
                  Open Resume Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/portfolio-generator">Build Portfolio</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:-mr-6 xl:-mr-10"
          >
            <ProductMock />
          </motion.div>
        </div>
      </section>

      <Separator />

      {/* Tools */}
      <section id="tools" className="scroll-mt-20 px-5 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Tools</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Four studios. One workspace.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Jump into the surface you need — each link opens a real product route.
            </p>
          </motion.div>

          <div className="mt-10 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id;
              const shortLabel =
                tool.id === "cold-mail"
                  ? "Cold Email"
                  : tool.id === "pdf"
                    ? "PDF Editor"
                    : tool.id === "resume"
                      ? "Resume Studio"
                      : "Portfolio";
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md border px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tool.name}</span>
                  <span className="lg:hidden">{shortLabel}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <CurrentIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold tracking-tight">
                        {current.name}
                      </h3>
                      <Badge variant="secondary">{current.badge}</Badge>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {current.summary}
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href={current.href}>
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <Separator className="my-6" />
              <ul className="grid gap-3 sm:grid-cols-3">
                {current.points.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              How it works
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              From key to PDF in four steps
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              No agent jargon — a straight path from setup to a tailored resume or live portfolio.
            </p>
          </motion.div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="relative"
              >
                <span className="font-display text-4xl font-semibold tabular-nums text-primary/25">
                  {step.n}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                <Link
                  href={step.href}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <Separator />

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-20 px-5 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Features
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for technical job seekers
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Capabilities that match the product — LaTeX precision, grounded AI, and deployable
              portfolios.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                >
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* Final CTA */}
      <section className="px-5 py-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Start with the Resume Studio
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Load your LaTeX, paste a job description, and export a tailored PDF — or spin up a
            portfolio from the same workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/resume-generator">
                Launch Studio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/portfolio-generator">Portfolio Generator</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border bg-muted/40 px-5 py-12 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/aurabio-refined-logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">AURABIO</p>
              <p className="text-xs text-muted-foreground">
                LaTeX resume tailor · portfolios · outreach
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/resume-generator" className="hover:text-foreground">
              Resume Tailor
            </Link>
            <Link href="/portfolio-generator" className="hover:text-foreground">
              Portfolio
            </Link>
            <Link href="/cold-mail-generator" className="hover:text-foreground">
              Cold Email
            </Link>
            <Link href="/pdf-editor" className="hover:text-foreground">
              PDF Editor
            </Link>
            <Link href="/api-key" className="hover:text-foreground">
              API Keys
            </Link>
            <Link href="/api-docs" className="hover:text-foreground">
              API Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
