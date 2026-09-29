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
import { StudioBackButton } from "@/components/studio-back-button";
import { ThemeToggle } from "@/components/theme-toggle";

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
    } catch {}
    router.push(flow === "latex" ? "/edit-latex" : "/Edit-a-PDF?view=gallery");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[5%] h-[400px] w-[600px] rounded-full bg-primary/5 blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-card/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <StudioBackButton href="/" label="Home" />
          <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-foreground">AURABIO</h1>
              <Badge variant="muted" className="px-1.5 py-0 font-mono text-[10px]">
                Dual-Engine
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">AI-Powered Resume Studio &amp; Portfolio Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/portfolio-generator"
            className="hidden items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground sm:flex"
          >
            <Globe className="h-3.5 w-3.5 text-primary" /> Portfolio Builder
          </Link>
          <Link
            href="/cold-mail-generator"
            className="hidden items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground sm:flex"
          >
            <Mail className="h-3.5 w-3.5 text-primary" /> Cold Mailer
          </Link>
          <Link
            href="/api-key"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <Badge variant="muted" className="mb-5 inline-flex items-center gap-1.5 px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Guardrail-Protected LLM Pipeline
          </Badge>
          <h2 className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
            Choose Your{" "}
            <span className="text-primary">Editing Experience</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Tailor your resume against real job descriptions using structured STAR bullet construction.
            Both flows share the same document model — switch anytime without losing work.
          </p>
        </motion.div>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
          >
            <Card
              onClick={() => handleSelectFlow("latex")}
              className="relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
            >
              <div className="h-1 w-full bg-gradient-to-r from-primary to-teal-500 opacity-60 transition-opacity group-hover:opacity-100" />

              <div className="flex flex-1 flex-col p-7">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl border border-border bg-muted p-3.5 text-primary transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10">
                    <Code2 className="h-7 w-7" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {lastUsedFlow === "latex" && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> Last Used
                      </Badge>
                    )}
                    <Badge variant="muted" className="text-[10px]">
                      <Cpu className="mr-1 h-2.5 w-2.5" /> LaTeX Engine
                    </Badge>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="mb-1 text-2xl font-bold text-foreground transition-colors duration-200 group-hover:text-primary">
                    Edit in LaTeX
                  </h3>
                  <p className="text-xs font-medium text-primary/80">
                    Overleaf-Style CodeMirror 6 + SyncTeX Engine
                  </p>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Full control over LaTeX source. Bidirectional SyncTeX navigation — click the PDF to
                  jump to source, or click source to highlight the PDF. Multi-engine with error diagnostics.
                </p>

                <div className="mb-7 flex-1 space-y-2.5 border-t border-border pt-5">
                  {[
                    "Bidirectional SyncTeX click-to-sync",
                    "pdflatex, xelatex, tectonic & cloud compilers",
                    "Streaming text polish with 5 rewrite actions",
                    "ATS Audit & keyword gap analysis",
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-foreground/80">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFlow("latex");
                  }}
                  className="h-11 w-full gap-2 text-sm font-semibold"
                >
                  Launch LaTeX Editor
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative"
          >
            <Card
              onClick={() => handleSelectFlow("pdf")}
              className="relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
            >
              <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-primary opacity-60 transition-opacity group-hover:opacity-100" />

              <div className="flex flex-1 flex-col p-7">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl border border-border bg-muted p-3.5 text-primary transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10">
                    <FileText className="h-7 w-7" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {lastUsedFlow === "pdf" && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Clock className="h-3 w-3" /> Last Used
                      </Badge>
                    )}
                    {!lastUsedFlow && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Zap className="h-3 w-3" /> Recommended
                      </Badge>
                    )}
                    <Badge variant="muted" className="text-[10px]">
                      <Layers className="mr-1 h-2.5 w-2.5" /> 4 Templates
                    </Badge>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="mb-1 text-2xl font-bold text-foreground transition-colors duration-200 group-hover:text-primary">
                    Edit a PDF Template
                  </h3>
                  <p className="text-xs font-medium text-primary/80">
                    Pure HTML/CSS Templates + Side-by-Side STAR Diff
                  </p>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Zero LaTeX knowledge required. Pick a template, edit structured fields and inline
                  content directly. Instant preview with zero compile latency.
                </p>

                <div className="mb-7 flex-1 space-y-2.5 border-t border-border pt-5">
                  {[
                    "template1.tex & template2.tex pixel-faithful rendering",
                    "Instant re-render with zero compile latency",
                    "Side-by-side Before vs After diff verification",
                    "1-click PDF export & 100% ATS-friendly output",
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-foreground/80">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFlow("pdf");
                  }}
                  variant="outline"
                  className="h-11 w-full gap-2 border-primary/40 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Explore Templates &amp; Edit
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border bg-muted/30 px-6 py-4 text-center text-xs text-muted-foreground">
        AURABIO — LaTeX &amp; PDF Resume Tailoring with Server Guardrails
      </footer>
    </div>
  );
}
