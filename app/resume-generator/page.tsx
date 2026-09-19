"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Code2,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Globe,
  Mail,
  Clock,
  Layers,
  Cpu,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResumeGeneratorPage() {
  const router = useRouter();
  const [lastUsedFlow, setLastUsedFlow] = useState<"latex" | "pdf" | null>(null);

  useEffect(() => {
    try {
      const activeFlow = localStorage.getItem("resume_active_flow") as "latex" | "pdf" | null;
      setLastUsedFlow(activeFlow);
    } catch {
      // ignore
    }
  }, []);

  const handleSelectFlow = (flow: "latex" | "pdf") => {
    try {
      localStorage.setItem("resume_active_flow", flow);
    } catch { }
    router.push(flow === "latex" ? "/edit-latex" : "/Edit-a-PDF");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/8 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[5%] w-[600px] h-[400px] bg-teal-500/8 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 left-[-10%] w-[400px] h-[400px] bg-emerald-600/5 blur-[100px] rounded-full" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">ResumeSpark</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 font-mono">
                v2.0 Dual-Engine
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">AI-Powered Resume Studio &amp; Portfolio Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/portfolio-generator"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800/60 border border-transparent hover:border-slate-700"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" /> Portfolio Builder
          </Link>
          <Link
            href="/cold-mail-generator"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800/60 border border-transparent hover:border-slate-700"
          >
            <Mail className="w-3.5 h-3.5 text-teal-400" /> Cold Mailer
          </Link>
          <Link
            href="/api-key"
            className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60 border border-slate-800"
          >
            Settings
          </Link>
        </div>
      </header>

      {/* Main — vertically centered */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mb-5 px-3 py-1 text-xs inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Guardrail-Protected LLM Pipeline
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Editing Experience
            </span>
          </h2>
          <p className="text-slate-400 mt-4 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Tailor your resume against real job descriptions using structured STAR bullet construction.
            Both flows share the same document model — switch anytime without losing work.
          </p>
        </motion.div>

        {/* Dual Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
          {/* Card 1 — Edit in LaTeX */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
          >
            <div className="absolute -inset-px bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl blur-sm opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
            <Card
              onClick={() => handleSelectFlow("latex")}
              className="relative cursor-pointer bg-slate-900 border border-slate-800 group-hover:border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col h-full"
            >
              {/* Card top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="p-7 flex flex-col flex-1">
                {/* Icon + badge row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-emerald-400 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/40 transition-all duration-300">
                    <Code2 className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {lastUsedFlow === "latex" && (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px] gap-1">
                        <Clock className="w-3 h-3" /> Last Used
                      </Badge>
                    )}
                    <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                      <Cpu className="w-2.5 h-2.5 mr-1" /> LaTeX Engine
                    </Badge>
                  </div>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors duration-200 mb-1">
                    Edit in LaTeX
                  </h3>
                  <p className="text-xs text-emerald-400/80 font-medium">
                    Overleaf-Style CodeMirror 6 + SyncTeX Engine
                  </p>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Full control over LaTeX source. Bidirectional SyncTeX navigation — click the PDF to
                  jump to source, or click source to highlight the PDF. Multi-engine with error diagnostics.
                </p>

                {/* Feature list */}
                <div className="space-y-2.5 border-t border-slate-800/60 pt-5 mb-7 flex-1">
                  {[
                    "Bidirectional SyncTeX click-to-sync",
                    "pdflatex, xelatex, tectonic & cloud compilers",
                    "Streaming text polish with 5 rewrite actions",
                    "ATS Audit & keyword gap analysis",
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Button
                  onClick={(e) => { e.stopPropagation(); handleSelectFlow("latex"); }}
                  className="w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-600/40 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold text-sm h-11 transition-all duration-200 gap-2"
                >
                  Launch LaTeX Editor
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Card 2 — Edit a PDF Template */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
          >
            <div className="absolute -inset-px bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl blur-sm opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
            <Card
              onClick={() => handleSelectFlow("pdf")}
              className="relative cursor-pointer bg-slate-900 border border-slate-800 group-hover:border-teal-500/40 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col h-full"
            >
              {/* Card top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="p-7 flex flex-col flex-1">
                {/* Icon + badge row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-teal-400 group-hover:bg-teal-500/15 group-hover:border-teal-500/40 transition-all duration-300">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {lastUsedFlow === "pdf" && (
                      <Badge className="bg-teal-500/15 text-teal-300 border-teal-500/30 text-[11px] gap-1">
                        <Clock className="w-3 h-3" /> Last Used
                      </Badge>
                    )}
                    {!lastUsedFlow && (
                      <Badge className="bg-teal-500/15 text-teal-300 border-teal-500/30 text-[11px] gap-1">
                        <Zap className="w-3 h-3" /> Recommended
                      </Badge>
                    )}
                    <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                      <Layers className="w-2.5 h-2.5 mr-1" /> 4 Templates
                    </Badge>
                  </div>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <h3 className="text-2xl font-bold text-white group-hover:text-teal-400 transition-colors duration-200 mb-1">
                    Edit a PDF Template
                  </h3>
                  <p className="text-xs text-teal-400/80 font-medium">
                    Pure HTML/CSS Templates + Side-by-Side STAR Diff
                  </p>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Zero LaTeX knowledge required. Pick a template, edit structured fields and inline
                  content directly. Instant preview with zero compile latency.
                </p>

                {/* Feature list */}
                <div className="space-y-2.5 border-t border-slate-800/60 pt-5 mb-7 flex-1">
                  {[
                    "template1.tex & template2.tex pixel-faithful rendering",
                    "Instant re-render with zero compile latency",
                    "Side-by-side Before vs After diff verification",
                    "1-click PDF export & 100% ATS-friendly output",
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Button
                  onClick={(e) => { e.stopPropagation(); handleSelectFlow("pdf"); }}
                  className="w-full bg-teal-600/20 hover:bg-teal-600 border border-teal-600/40 hover:border-teal-500 text-teal-300 hover:text-white font-semibold text-sm h-11 transition-all duration-200 gap-2"
                >
                  Explore Templates &amp; Edit
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-xs text-slate-600 mt-10"
        >
          Both editors share the same document model — start in one, switch to the other anytime.
        </motion.p>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        ResumeSpark — Enterprise-grade LaTeX &amp; PDF Resume Tailoring with Server Guardrails Layer
      </footer>
    </div>
  );
}
