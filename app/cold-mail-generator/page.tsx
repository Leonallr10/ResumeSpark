"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Mail,
  Loader2,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import type { LlmProvider } from "@/types/resume";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default function ColdMailGenerator() {
  const [formData, setFormData] = useState({
    receiverName: "",
    companyName: "",
    role: "",
    skill: "",
    experience: "",
    achievement: "",
    portfolioLink: "",
    linkedinLink: "",
    githubLink: "",
    resumeLink: "",
  });
  const [jd, setJd] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [llmConfig, setLlmConfig] = useState<{
    provider: LlmProvider;
    model: string;
    apiKey: string;
  } | null>(null);

  useEffect(() => {
    const provider = (getCookie("llm_provider") as LlmProvider) || "gemini";
    const model = getCookie("llm_model") || "gemini-2.5-pro";
    let apiKey = "";
    if (provider === "gemini") apiKey = getCookie("gemini_api_key") || "";
    if (provider === "groq") apiKey = getCookie("groq_api_key") || "";
    if (provider === "claude") apiKey = getCookie("claude_api_key") || "";

    if (provider && apiKey) {
      setLlmConfig({ provider, model, apiKey });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!llmConfig) {
      setError("API Key not found. Please configure your LLM settings first.");
      return;
    }

    if (!formData.companyName || !formData.role) {
      setError("Company Name and Target Role are required.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSubject("");
    setBody("");

    try {
      const res = await fetch("/api/cold-mail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: llmConfig.apiKey,
          formData,
          jd,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate email.");
      }

      const fullEmail = data.email || "";
      const subjectMatch = fullEmail.match(/^Subject:\s*(.*)\n/i);
      
      if (subjectMatch) {
        setSubject(subjectMatch[1].trim());
        setBody(fullEmail.replace(/^Subject:\s*(.*)\n/i, "").trim());
      } else {
        setSubject("");
        setBody(fullEmail.trim());
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!subject && !body) return;
    const textToCopy = subject ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
      <nav className="sticky top-0 z-40 border-b border-emerald-500/10 bg-black/80 backdrop-blur-xl shrink-0">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              AURABIO
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {!llmConfig ? (
               <Link
               href="/api-key"
               className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
             >
               <AlertTriangle className="h-3.5 w-3.5" />
               Missing API Key
             </Link>
            ) : (
              <Link
                href="/api-key"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {llmConfig.provider.toUpperCase()} Ready
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-emerald-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Back Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[150px]" />
          <div className="absolute -right-40 bottom-1/4 h-[500px] w-[500px] rounded-full bg-emerald-400/5 blur-[120px]" />
        </div>

        <div className="w-full md:w-1/2 lg:w-[45%] h-full overflow-y-auto border-r border-emerald-500/10 p-6 lg:p-8 z-10 custom-scrollbar pb-24 md:pb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Mail className="h-6 w-6 text-emerald-400" />
              Cold Mail Generator
            </h1>
            <p className="text-sm text-gray-400">
              Fill in your details and the job description to generate a highly effective cold email.
            </p>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Receiver Name (Optional)</label>
                <input type="text" name="receiverName" value={formData.receiverName} onChange={handleChange} placeholder="e.g. John Doe" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Company Name *</label>
                <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="e.g. Acme Corp" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Target Role *</label>
              <input type="text" name="role" value={formData.role} onChange={handleChange} placeholder="e.g. Frontend Engineer" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Key Skill (Optional)</label>
              <input type="text" name="skill" value={formData.skill} onChange={handleChange} placeholder="e.g. React, Node.js" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Experience (Optional)</label>
              <input type="text" name="experience" value={formData.experience} onChange={handleChange} placeholder="e.g. 2 years of full-stack dev" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Key Achievement (Optional)</label>
              <textarea name="achievement" value={formData.achievement} onChange={handleChange} placeholder="e.g. Increased conversion rate by 20%" rows={2} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Portfolio Link (Optional)</label>
                <input type="url" name="portfolioLink" value={formData.portfolioLink} onChange={handleChange} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Resume Link (Optional)</label>
                <input type="url" name="resumeLink" value={formData.resumeLink} onChange={handleChange} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">LinkedIn Link (Optional)</label>
                <input type="url" name="linkedinLink" value={formData.linkedinLink} onChange={handleChange} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">GitHub Link (Optional)</label>
                <input type="url" name="githubLink" value={formData.githubLink} onChange={handleChange} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Job Description (Optional, but recommended)</label>
              <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD here..." rows={4} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 resize-none" />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !llmConfig}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-6 py-3.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              {isGenerating ? "Generating..." : "Generate Cold Email"}
            </button>
          </div>
        </div>
        {/* Right Panel: Editor */}
        <div className="w-full md:w-1/2 lg:w-[55%] h-full flex flex-col p-6 lg:p-8 z-10 bg-[#1e1e1e]">
          
          <div className="flex-1 relative rounded-xl border border-white/10 bg-[#282a2d] flex flex-col overflow-hidden shadow-2xl">
             
             {/* Header / Subject */}
             <div className="flex items-center px-5 py-4 border-b border-white/5 shrink-0">
               <span className="text-gray-400 text-sm mr-2 font-medium">Subject:</span>
               <input 
                 type="text" 
                 value={subject} 
                 onChange={(e) => setSubject(e.target.value)}
                 placeholder="Email subject will appear here..."
                 className="bg-transparent text-white text-sm font-medium focus:outline-none flex-1"
               />
             </div>
             
             {/* Body */}
             <div className="flex-1 relative">
               <textarea
                 value={body}
                 onChange={(e) => setBody(e.target.value)}
                 placeholder="Your generated email body will appear here. You can edit it before sending."
                 className="w-full h-full bg-transparent p-5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-relaxed custom-scrollbar pb-20"
               />
             </div>
             
             {/* Bottom Actions */}
             <div className="absolute bottom-4 right-4 flex items-center gap-2">
               <button
                 onClick={copyToClipboard}
                 disabled={!body && !subject}
                 className="flex items-center justify-center w-10 h-10 rounded-md bg-[#3c4043] text-gray-300 hover:bg-[#4a4d51] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 title="Copy to clipboard"
               >
                 {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
               </button>
               <a
                 href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className={`flex items-center gap-2 px-4 h-10 rounded-md bg-[#3c4043] text-gray-200 hover:bg-[#4a4d51] transition-colors text-sm font-medium ${(!body && !subject) ? 'opacity-50 pointer-events-none' : ''}`}
               >
                 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.25 7.02758V18.15C2.25 19.3926 3.25736 20.4 4.5 20.4H19.5C20.7426 20.4 21.75 19.3926 21.75 18.15V7.02758C21.75 6.43821 21.3533 5.92984 20.7937 5.76811L12.7937 3.457L12 3.22754L11.2063 3.457L3.20632 5.76811C2.6467 5.92984 2.25 6.43821 2.25 7.02758Z" fill="#EA4335"/>
                    <path d="M12 14.15L2.25 8.15V18.15C2.25 19.3926 3.25736 20.4 4.5 20.4H19.5C20.7426 20.4 21.75 19.3926 21.75 18.15V8.15L12 14.15Z" fill="#4285F4"/>
                    <path d="M19.5 20.4H4.5C3.87868 20.4 3.375 19.8963 3.375 19.275V7.45731L12 12.765L20.625 7.45731V19.275C20.625 19.8963 20.1213 20.4 19.5 20.4Z" fill="#34A853"/>
                    <path d="M20.625 7.45731L12 12.765L3.375 7.45731L11.7523 2.30256C11.9056 2.20815 12.0944 2.20815 12.2477 2.30256L20.625 7.45731Z" fill="#FBBC05"/>
                 </svg>
                 Send via Gmail
               </a>
             </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.4);
        }
      `}} />
    </div>
  );
}
