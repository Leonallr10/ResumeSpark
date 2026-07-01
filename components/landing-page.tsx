"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Layers,
  Lightbulb,
  Rocket,
  SearchCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-Powered Suggestions",
    description: "Get intelligent, JD-aligned resume improvements powered by Claude, Gemini, and Groq LLMs with streaming responses.",
  },
  {
    icon: Code2,
    title: "LaTeX Editor with SyncTeX",
    description: "Professional-grade CodeMirror 6 editor with bidirectional PDF sync — click source to highlight PDF and vice versa.",
  },
  {
    icon: Brain,
    title: "Multi-LLM Support",
    description: "Choose your preferred AI provider — Gemini, Claude, or Groq — for maximum flexibility and cost control.",
  },
  {
    icon: Globe,
    title: "One-Click Deploy",
    description: "Deploy your generated portfolio directly to Netlify or Vercel with a single click. Supports redeployment.",
  },
  {
    icon: GitBranch,
    title: "GitHub & LeetCode Integration",
    description: "Automatically fetch contribution stats, repos, stars, coding achievements, and streaks.",
  },
  {
    icon: SearchCheck,
    title: "ATS Audit & Scoring",
    description: "Score your resume against job descriptions with section-by-section feedback and keyword matching.",
  },
  {
    icon: Target,
    title: "Text Polish Actions",
    description: "Five polish modes — improve, elaborate, professional, concise, quantify — with real-time streaming.",
  },
  {
    icon: Layers,
    title: "Multi-Compiler Pipeline",
    description: "Automatic fallback chain: pdflatex → xelatex → tectonic → cloud. Never fails to compile.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Sign Up & Configure",
    description: "Create an account and add your preferred AI provider key (Gemini, Claude, or Groq).",
  },
  {
    step: "02",
    title: "Upload or Write Resume",
    description: "Upload an existing .tex file or start from scratch using our professional LaTeX template.",
  },
  {
    step: "03",
    title: "AI-Powered Tailoring",
    description: "Paste a job description and get intelligent suggestions, polishing, and ATS audit feedback.",
  },
  {
    step: "04",
    title: "Generate Portfolio",
    description: "Auto-extract your data into a portfolio with GitHub/LeetCode stats, then deploy with one click.",
  },
];

const USE_CASES = [
  {
    icon: Users,
    title: "Job Seekers",
    description: "Tailor resumes to each JD, improve bullet points, and score ATS compatibility before applying.",
  },
  {
    icon: Rocket,
    title: "Developers",
    description: "Showcase projects with auto-generated portfolios, GitHub stats, and LeetCode achievements.",
  },
  {
    icon: BarChart3,
    title: "Career Coaches",
    description: "Audit client resumes, suggest improvements, and generate professional portfolios at scale.",
  },
  {
    icon: Lightbulb,
    title: "Students & Graduates",
    description: "Build professional presence from scratch with AI guidance and one-click portfolio deployment.",
  },
];

const TECH_SPECS = [
  { label: "Frontend", value: "Next.js 15, React 19, TypeScript" },
  { label: "Editor", value: "CodeMirror 6 with LaTeX syntax" },
  { label: "PDF Engine", value: "PDF.js with SyncTeX mapping" },
  { label: "AI Providers", value: "Gemini, Claude (Anthropic), Groq" },
  { label: "Auth & DB", value: "Supabase (PostgreSQL + Auth + RLS)" },
  { label: "Styling", value: "Tailwind CSS, Framer Motion, Radix UI" },
  { label: "Deployment", value: "Netlify & Vercel API integration" },
  { label: "LaTeX Engines", value: "pdflatex, xelatex, tectonic, cloud" },
];

const METRICS = [
  { value: "40%", label: "Faster resume tailoring vs manual editing" },
  { value: "5+", label: "AI polish modes for text refinement" },
  { value: "3", label: "LLM providers supported simultaneously" },
  { value: "4", label: "LaTeX compilers with auto-fallback" },
  { value: "< 2s", label: "Average PDF compilation time" },
  { value: "1-Click", label: "Portfolio deployment to Vercel/Netlify" },
];

export function LandingPage() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-500/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              AURABIO
            </span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">How It Works</a>
            <a href="#tech" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">Tech</a>
            <Link href="/api-docs" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">API Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/resume-generator" className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400">
              Go to App
            </Link>
          </div>
        </div>
      </nav>

      {/* 1. Hero / Cover Section */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[150px]" />
          <div className="absolute -right-40 bottom-1/4 h-[500px] w-[500px] rounded-full bg-green-500/8 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/5 blur-[80px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 mx-auto max-w-4xl text-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400"
          >
            <Zap className="h-3.5 w-3.5" /> AI-Powered Resume & Portfolio Platform
          </motion.div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500 bg-clip-text text-transparent">
              AURABIO
            </span>
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-lg text-gray-300 sm:text-xl">
            Tailor resumes with multi-LLM intelligence, generate stunning portfolios, and deploy — all with LaTeX-grade precision.
          </p>
          <p className="mx-auto mb-10 max-w-xl text-sm text-gray-500">
            One platform to polish, audit, and present your professional story with AI that understands job descriptions.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/resume-generator"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-8 py-3.5 text-base font-semibold text-black transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
            >
              <FileText className="h-5 w-5" />
              Resume Generator
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/portfolio-generator"
              className="group flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-8 py-3.5 text-base font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            >
              <Globe className="h-5 w-5" />
              Portfolio Generator
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 2. Overview / About the Product */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
            <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
              What is <span className="text-emerald-400">AURABIO</span>?
            </h2>
            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-400">
              AURABIO is an AI-powered platform that transforms how professionals create resumes and portfolios.
              It combines a professional LaTeX editor with multi-LLM intelligence (Gemini, Claude, Groq) to provide
              real-time suggestions, text polishing, and ATS auditing — all tailored to specific job descriptions.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/10 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
                <div className="mb-3 text-3xl font-bold text-emerald-400">Resume</div>
                <p className="text-sm text-gray-400">AI-tailored LaTeX resumes with live PDF preview and multi-compiler support</p>
              </div>
              <div className="rounded-xl border border-emerald-500/10 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
                <div className="mb-3 text-3xl font-bold text-emerald-400">Portfolio</div>
                <p className="text-sm text-gray-400">Auto-generated portfolios with GitHub/LeetCode stats and one-click deploy</p>
              </div>
              <div className="rounded-xl border border-emerald-500/10 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
                <div className="mb-3 text-3xl font-bold text-emerald-400">AI Audit</div>
                <p className="text-sm text-gray-400">ATS scoring with section-by-section feedback and keyword optimization</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Features & Capabilities */}
      <section id="features" className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Features & <span className="text-emerald-400">Capabilities</span>
            </h2>
            <p className="mx-auto max-w-xl text-gray-400">Everything you need to create, tailor, and deploy professional resumes and portfolios.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="landing-card rounded-xl p-6 transition-all hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10">
                  <f.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="mb-2 text-sm font-semibold">{f.title}</h3>
                <p className="text-xs leading-relaxed text-gray-400">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              How It <span className="text-emerald-400">Works</span>
            </h2>
            <p className="mx-auto max-w-xl text-gray-400">Four simple steps from sign-up to deployed portfolio.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
            <div className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent sm:block" />
            <div className="space-y-12">
              {STEPS.map((s, i) => (
                <motion.div key={s.step} variants={fadeUp} className="flex gap-6">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-lg font-bold text-emerald-400">
                      {s.step}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="absolute left-1/2 top-16 h-12 w-px -translate-x-1/2 bg-gradient-to-b from-emerald-500/30 to-transparent sm:hidden" />
                    )}
                  </div>
                  <div className="pt-3">
                    <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                    <p className="text-sm text-gray-400">{s.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. Use Cases / Applications */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Use <span className="text-emerald-400">Cases</span>
            </h2>
            <p className="mx-auto max-w-xl text-gray-400">Real-world scenarios where AURABIO makes a difference.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((uc) => (
              <motion.div key={uc.title} variants={fadeUp} className="landing-card rounded-xl p-6 text-center transition-all hover:border-emerald-500/30">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <uc.icon className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{uc.title}</h3>
                <p className="text-xs leading-relaxed text-gray-400">{uc.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 6. Technical Specifications */}
      <section id="tech" className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Technical <span className="text-emerald-400">Specifications</span>
            </h2>
            <p className="mx-auto max-w-xl text-gray-400">Built with modern, production-grade technologies.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-3 sm:grid-cols-2">
            {TECH_SPECS.map((spec) => (
              <motion.div key={spec.label} variants={fadeUp} className="flex items-center gap-4 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] px-5 py-4">
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-400 w-28 shrink-0">{spec.label}</span>
                <span className="text-sm text-gray-300">{spec.value}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 7. Results / Impact */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Results & <span className="text-emerald-400">Impact</span>
            </h2>
            <p className="mx-auto max-w-xl text-gray-400">Measurable outcomes from using the platform.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((m) => (
              <motion.div key={m.label} variants={fadeUp} className="landing-card rounded-xl p-6 text-center">
                <div className="mb-2 text-4xl font-bold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                  {m.value}
                </div>
                <p className="text-sm text-gray-400">{m.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* 9. Testimonials / Social Proof */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              What People <span className="text-emerald-400">Say</span>
            </h2>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-3">
            <motion.div variants={fadeUp} className="landing-card rounded-xl p-6">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-gray-300 italic">
                &ldquo;AURABIO cut my resume tailoring time from 2 hours to 15 minutes. The ATS audit caught issues I never noticed.&rdquo;
              </p>
              <div className="text-xs text-gray-500">— Software Engineer, FAANG applicant</div>
            </motion.div>
            <motion.div variants={fadeUp} className="landing-card rounded-xl p-6">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-gray-300 italic">
                &ldquo;The portfolio generator pulled my GitHub stats automatically. Deployed to Vercel in one click — my portfolio was live in seconds.&rdquo;
              </p>
              <div className="text-xs text-gray-500">— Full-Stack Developer, Open Source Contributor</div>
            </motion.div>
            <motion.div variants={fadeUp} className="landing-card rounded-xl p-6">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-gray-300 italic">
                &ldquo;The multi-LLM support is brilliant. I use Gemini for quick edits and Claude for deep rewrites. Best resume tool I&apos;ve used.&rdquo;
              </p>
              <div className="text-xs text-gray-500">— Product Manager, Career Transition</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to <span className="text-emerald-400">get started</span>?
          </h2>
          <p className="mb-8 text-gray-400">Create your account and build your professional presence in minutes.</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/resume-generator"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-8 py-3.5 text-base font-semibold text-black transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
            >
              <FileText className="h-5 w-5" />
              Resume Generator
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/portfolio-generator"
              className="group flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-8 py-3.5 text-base font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            >
              <Globe className="h-5 w-5" />
              Portfolio Generator
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-emerald-500/10 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-lg font-bold text-transparent">AURABIO</span>
            <span className="text-xs text-gray-600">AI-Powered Resume & Portfolio Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/resume-generator" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">Resume Generator</Link>
            <Link href="/portfolio-generator" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">Portfolio Generator</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
