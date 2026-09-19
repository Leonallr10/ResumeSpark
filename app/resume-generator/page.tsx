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
  ChevronRight,
  FolderGit2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ProjectSummary {
  heading: string;
  explanation: string;
  techStack: string;
  link?: string;
  lastFlow?: "latex" | "pdf";
}

export default function ResumeGeneratorPage() {
  const router = useRouter();
  const [lastUsedFlow, setLastUsedFlow] = useState<"latex" | "pdf" | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    try {
      const activeFlow = localStorage.getItem("resume_active_flow") as "latex" | "pdf" | null;
      setLastUsedFlow(activeFlow);

      const stored = localStorage.getItem("resume_projects_list");
      if (stored) {
        setRecentProjects(JSON.parse(stored));
      } else {
        setRecentProjects([
          {
            heading: "Resume Tailor AI — LaTeX & PDF Studio",
            explanation:
              "Production resume editor with SyncTeX, streaming AI polish, ATS audit, and dual editing pipelines.",
            techStack: "Next.js 15, TypeScript, CodeMirror 6, Gemini API, PDF.js",
            link: "https://resume-spark-lake.vercel.app/",
            lastFlow: "pdf",
          },
          {
            heading: "Hive AI Agent Runtime Platform",
            explanation:
              "YC-backed agent runtime with multi-agent orchestration and dynamic document ingestion.",
            techStack: "Python, React, LiteLLM, Agent Architecture",
            link: "https://github.com/aden-hive/hive",
            lastFlow: "latex",
          },
          {
            heading: "Chess Insight — AI Coaching SaaS",
            explanation:
              "Real-time Stockfish engine integration with move-by-move pattern analysis and subscription billing.",
            techStack: "Next.js, TypeScript, Stockfish, Webhooks",
            lastFlow: "latex",
          },
        ]);
      }
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[350px] bg-teal-500/10 blur-[120px] rounded-full" />
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
            <p className="text-[11px] text-slate-400">AI-Powered Resume Studio & Portfolio Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Main Choice Screen Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        {/* Title Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mb-4 px-3 py-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline text-emerald-400" />
              Guardrail-Protected LLM Pipeline
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Choose Your Editing Experience
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
              Tailor your resume against real job descriptions using structured STAR bullet
              construction. Both flows share the same document model for instant cross-switching.
            </p>
          </motion.div>
        </div>

        {/* Dual Primary Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-14">
          {/* Card 1: Edit in LaTeX → /edit-latex */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -6 }}
            className="group relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-300" />
            <Card
              onClick={() => handleSelectFlow("latex")}
              className="relative cursor-pointer bg-slate-900 border-slate-800 hover:border-emerald-500/50 rounded-2xl p-7 flex flex-col justify-between h-full shadow-2xl transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
                    <Code2 className="w-7 h-7" />
                  </div>
                  {lastUsedFlow === "latex" && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px]">
                      <Clock className="w-3 h-3 mr-1 inline" /> Last Used
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Edit in LaTeX
                  </h3>
                  <p className="text-xs text-emerald-400/90 font-medium">
                    Overleaf-Style CodeMirror 6 + SyncTeX Engine
                  </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Full control over LaTeX AST source code. Features bidirectional SyncTeX navigation
                  (click PDF to jump to source code), error diagnostics, macro extensions, and
                  multi-engine compilation.
                </p>

                <div className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Bidirectional SyncTeX click-to-sync</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>pdflatex, xelatex, tectonic &amp; cloud compilers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Streaming text polish with 5 rewrite actions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ATS Audit &amp; keyword gap analysis</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFlow("latex");
                  }}
                  className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-semibold text-xs h-10 group-hover:bg-emerald-600 transition-colors gap-2"
                >
                  <span>Launch LaTeX Editor</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Card 2: Edit a PDF Template → /Edit-a-PDF */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -6 }}
            className="group relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-300" />
            <Card
              onClick={() => handleSelectFlow("pdf")}
              className="relative cursor-pointer bg-slate-900 border-slate-800 hover:border-teal-500/50 rounded-2xl p-7 flex flex-col justify-between h-full shadow-2xl transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-teal-400 group-hover:bg-teal-500/20 group-hover:border-teal-500/40 transition-colors">
                    <FileText className="w-7 h-7" />
                  </div>
                  {lastUsedFlow === "pdf" && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px]">
                      <Clock className="w-3 h-3 mr-1 inline" /> Last Used
                    </Badge>
                  )}
                  {!lastUsedFlow && (
                    <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-[11px]">
                      <Zap className="w-3 h-3 mr-1 inline" /> Instant Preview
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">
                    Edit a PDF Template
                  </h3>
                  <p className="text-xs text-teal-400/90 font-medium">
                    Pure HTML/CSS Templates + Side-by-Side STAR Diff
                  </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Zero LaTeX knowledge required. Edit structured fields and inline content directly.
                  Features 4 starter templates faithfully modeled after Ivy Academic and Trey Hunner
                  CV standards.
                </p>

                <div className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>template1.tex &amp; template2.tex pixel-faithful rendering</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Instant re-render with zero compile latency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Side-by-side Before vs After diff verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>1-click client PDF export &amp; 100% ATS score</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFlow("pdf");
                  }}
                  className="w-full bg-slate-800 hover:bg-teal-600 text-white font-semibold text-xs h-10 group-hover:bg-teal-600 transition-colors gap-2"
                >
                  <span>Explore Templates &amp; Edit</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>


      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-400">
        <p>ResumeSpark — Enterprise-grade LaTeX &amp; PDF Resume Tailoring with Server Guardrails Layer</p>
      </footer>
    </div>
  );
}
