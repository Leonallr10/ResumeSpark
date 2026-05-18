"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Key,
  Lock,
  Send,
  Server,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface ApiEndpoint {
  title: string;
  method: "GET" | "POST";
  endpoint: string;
  description: string;
  auth: "API Key" | "Bearer Token" | "None";
  request: string | null;
  response: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
}

const ENDPOINTS: { category: string; icon: typeof Server; endpoints: ApiEndpoint[] }[] = [
  {
    category: "Resume",
    icon: Server,
    endpoints: [
      {
        title: "Get Suggestions",
        method: "POST",
        endpoint: "/api/resume/suggestions",
        description: "Generate AI-powered resume improvement suggestions tailored to a specific job description.",
        auth: "API Key",
        params: [
          { name: "latex", type: "string", required: true, description: "Full LaTeX resume content" },
          { name: "jd", type: "string", required: true, description: "Target job description text" },
          { name: "provider", type: "string", required: true, description: "AI provider: \"gemini\" | \"claude\" | \"groq\"" },
          { name: "apiKey", type: "string", required: true, description: "Your provider API key" },
        ],
        request: `{
  "latex": "\\\\documentclass{article}\\n\\\\begin{document}\\n\\\\resumeSubheading{Software Engineer}{2023 -- Present}{Company Inc}{City, ST}\\n\\\\resumeItemListStart\\n\\\\resumeItem{Developed web applications using React}\\n\\\\resumeItemListEnd\\n\\\\end{document}",
  "jd": "We are looking for a Senior Frontend Engineer with experience in React, TypeScript, and performance optimization. Must have 3+ years of experience building scalable web applications.",
  "provider": "gemini",
  "apiKey": "AIzaSy..."
}`,
        response: `{
  "suggestions": [
    {
      "section": "Experience",
      "original": "Developed web applications using React",
      "improved": "Architected and developed 5 high-performance React applications with TypeScript, serving 100K+ monthly active users with 99.9% uptime",
      "reason": "Quantifies impact, adds TypeScript (from JD), and demonstrates scale"
    },
    {
      "section": "Experience",
      "original": "Worked on frontend performance",
      "improved": "Led frontend performance optimization initiative, reducing bundle size by 35% and improving Core Web Vitals LCP from 4.2s to 1.8s",
      "reason": "Adds specific metrics and demonstrates leadership aligned with JD requirements"
    }
  ]
}`,
      },
      {
        title: "Polish Text",
        method: "POST",
        endpoint: "/api/resume/polish",
        description: "Improve a specific text snippet using one of five polish modes. Returns a streaming response.",
        auth: "API Key",
        params: [
          { name: "text", type: "string", required: true, description: "The text to polish" },
          { name: "action", type: "string", required: true, description: "\"improve\" | \"elaborate\" | \"professional\" | \"concise\" | \"quantify\"" },
          { name: "provider", type: "string", required: true, description: "AI provider: \"gemini\" | \"claude\" | \"groq\"" },
          { name: "apiKey", type: "string", required: true, description: "Your provider API key" },
          { name: "context", type: "string", required: false, description: "Surrounding LaTeX context for better results" },
        ],
        request: `{
  "text": "Made websites faster and improved user experience",
  "action": "quantify",
  "provider": "claude",
  "apiKey": "sk-ant-api03-..."
}`,
        response: `{
  "polished": "Optimized web application performance by implementing lazy loading and code splitting, reducing initial load time by 42% (3.8s → 2.2s) and improving Lighthouse performance score from 67 to 94 across 12 production pages"
}`,
      },
      {
        title: "Audit Resume",
        method: "POST",
        endpoint: "/api/resume/audit",
        description: "Perform a comprehensive ATS audit of your resume against a job description with section-by-section scoring.",
        auth: "API Key",
        params: [
          { name: "latex", type: "string", required: true, description: "Full LaTeX resume content" },
          { name: "jd", type: "string", required: true, description: "Target job description" },
          { name: "provider", type: "string", required: true, description: "AI provider: \"gemini\" | \"claude\" | \"groq\"" },
          { name: "apiKey", type: "string", required: true, description: "Your provider API key" },
        ],
        request: `{
  "latex": "\\\\documentclass{article}\\n...(full resume LaTeX)...",
  "jd": "Senior Frontend Engineer at TechCorp. Requirements: 5+ years React, TypeScript, GraphQL, AWS, CI/CD pipelines...",
  "provider": "groq",
  "apiKey": "gsk_..."
}`,
        response: `{
  "score": 72,
  "sections": [
    {
      "name": "Skills Match",
      "score": 85,
      "feedback": "Strong alignment with React and TypeScript. Missing explicit mention of GraphQL and AWS."
    },
    {
      "name": "Experience Relevance",
      "score": 78,
      "feedback": "Good frontend focus. Consider adding CI/CD pipeline experience to match JD requirements."
    },
    {
      "name": "Quantification",
      "score": 55,
      "feedback": "Only 2 of 8 bullet points include metrics. Add numbers for impact, scale, and performance improvements."
    },
    {
      "name": "Keyword Optimization",
      "score": 68,
      "feedback": "Missing keywords: 'GraphQL', 'AWS', 'CI/CD', 'scalable'. Add these naturally to relevant sections."
    }
  ],
  "recommendations": [
    "Add GraphQL experience to skills or a project description",
    "Include AWS/cloud deployment mentions",
    "Quantify at least 5 more bullet points with metrics"
  ]
}`,
      },
      {
        title: "Compile LaTeX",
        method: "POST",
        endpoint: "/api/resume/compile-latex",
        description: "Compile LaTeX source into PDF using the multi-compiler pipeline (pdflatex → xelatex → tectonic → cloud).",
        auth: "None",
        params: [
          { name: "latex", type: "string", required: true, description: "LaTeX source to compile" },
          { name: "compiler", type: "string", required: false, description: "Preferred compiler: \"pdflatex\" | \"xelatex\" | \"tectonic\" | \"auto\"" },
        ],
        request: `{
  "latex": "\\\\documentclass[letterpaper,11pt]{article}\\n\\\\usepackage{geometry}\\n\\\\begin{document}\\n\\\\section*{John Doe}\\nSoftware Engineer\\n\\\\end{document}",
  "compiler": "auto"
}`,
        response: `{
  "success": true,
  "pdfId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "pdfUrl": "/api/resume/preview/a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "compiler": "pdflatex",
  "synctexId": "a1b2c3d4-synctex"
}`,
      },
      {
        title: "Test API Key",
        method: "POST",
        endpoint: "/api/resume/test-key",
        description: "Validate an API key against its provider to confirm it's active and has proper permissions.",
        auth: "None",
        params: [
          { name: "provider", type: "string", required: true, description: "\"gemini\" | \"claude\" | \"groq\"" },
          { name: "apiKey", type: "string", required: true, description: "The API key to validate" },
        ],
        request: `{
  "provider": "gemini",
  "apiKey": "AIzaSyB..."
}`,
        response: `{
  "valid": true,
  "provider": "gemini",
  "model": "gemini-2.0-flash"
}`,
      },
      {
        title: "Preview PDF",
        method: "GET",
        endpoint: "/api/resume/preview/:id",
        description: "Retrieve a previously compiled PDF by its ID. Returns the PDF binary.",
        auth: "None",
        params: [
          { name: "id", type: "string (path)", required: true, description: "The PDF ID from compile-latex response" },
        ],
        request: null,
        response: `// Returns: application/pdf binary
// Content-Disposition: inline
// Cache-Control: public, max-age=3600`,
      },
    ],
  },
  {
    category: "Portfolio",
    icon: Globe,
    endpoints: [
      {
        title: "GitHub Stats",
        method: "GET",
        endpoint: "/api/portfolio/github?username=:username",
        description: "Fetch a GitHub user's contribution stats including total contributions, repos, stars, and contribution calendar.",
        auth: "None",
        params: [
          { name: "username", type: "string (query)", required: true, description: "GitHub username" },
        ],
        request: null,
        response: `{
  "contributions": 1247,
  "repos": 42,
  "stars": "3.2k",
  "calendar": [
    [0, 1, 3, 2, 0, 4, 1, ...],
    [2, 0, 1, 5, 3, 0, 2, ...],
    ...
  ],
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/..."
}`,
      },
      {
        title: "LeetCode Stats",
        method: "GET",
        endpoint: "/api/portfolio/leetcode?username=:username",
        description: "Fetch a LeetCode user's problem-solving stats, ranking, and streak information.",
        auth: "None",
        params: [
          { name: "username", type: "string (query)", required: true, description: "LeetCode username" },
        ],
        request: null,
        response: `{
  "solved": {
    "easy": 120,
    "medium": 85,
    "hard": 30
  },
  "total": 235,
  "ranking": 45000,
  "streak": 15,
  "percentile": 92.5,
  "username": "user123"
}`,
      },
      {
        title: "Deploy to Netlify",
        method: "POST",
        endpoint: "/api/portfolio/deploy/netlify",
        description: "Deploy a generated portfolio HTML to Netlify. Creates a new site or redeploys an existing one.",
        auth: "Bearer Token",
        params: [
          { name: "html", type: "string", required: true, description: "Complete portfolio HTML content" },
          { name: "siteName", type: "string", required: false, description: "Preferred site subdomain name" },
          { name: "siteId", type: "string", required: false, description: "Existing site ID for redeployment" },
          { name: "token", type: "string", required: true, description: "Netlify personal access token" },
        ],
        request: `{
  "html": "<!DOCTYPE html><html>...(full portfolio HTML)...</html>",
  "siteName": "john-doe-portfolio",
  "token": "nfp_..."
}`,
        response: `{
  "success": true,
  "url": "https://john-doe-portfolio.netlify.app",
  "siteId": "abc123-def456",
  "deployId": "deploy-789xyz"
}`,
      },
      {
        title: "Deploy to Vercel",
        method: "POST",
        endpoint: "/api/portfolio/deploy/vercel",
        description: "Deploy a generated portfolio HTML to Vercel. Creates a new project or redeploys.",
        auth: "Bearer Token",
        params: [
          { name: "html", type: "string", required: true, description: "Complete portfolio HTML content" },
          { name: "projectName", type: "string", required: false, description: "Vercel project name" },
          { name: "projectId", type: "string", required: false, description: "Existing project ID for redeployment" },
          { name: "token", type: "string", required: true, description: "Vercel personal access token" },
        ],
        request: `{
  "html": "<!DOCTYPE html><html>...(full portfolio HTML)...</html>",
  "projectName": "john-doe-portfolio",
  "token": "vercel_..."
}`,
        response: `{
  "success": true,
  "url": "https://john-doe-portfolio.vercel.app",
  "projectId": "prj_abc123",
  "deploymentId": "dpl_xyz789"
}`,
      },
    ],
  },
];

export default function ApiDocsPage() {
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(ENDPOINTS[0].endpoints[0].endpoint);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-emerald-500/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                AURABIO
              </span>
            </Link>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              API Docs
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-emerald-400">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-12">
          <h1 className="mb-4 text-4xl font-bold">
            API <span className="text-emerald-400">Reference</span>
          </h1>
          <p className="max-w-2xl text-gray-400">
            Complete documentation for the AURABIO REST API. Integrate resume tailoring, portfolio generation, and deployment into your workflow.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-4 py-2 text-sm">
              <Server className="h-4 w-4 text-emerald-400" />
              <span className="text-gray-400">Base URL:</span>
              <code className="text-emerald-300">https://resume-spark-lake.vercel.app</code>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-4 py-2 text-sm">
              <Key className="h-4 w-4 text-emerald-400" />
              <span className="text-gray-400">Auth:</span>
              <span className="text-gray-300">API Key in request body</span>
            </div>
          </div>
        </motion.div>

        {/* Authentication Info */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-12 rounded-xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Lock className="h-5 w-5 text-emerald-400" /> Authentication
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            AURABIO uses a bring-your-own-key model. AI endpoints require an API key from your preferred provider passed in the request body. Deployment endpoints require platform-specific bearer tokens.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-blue-400">Gemini</div>
              <code className="text-xs text-gray-300">AIzaSy...</code>
              <p className="mt-2 text-xs text-gray-500">Google AI Studio key</p>
            </div>
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-orange-400">Claude</div>
              <code className="text-xs text-gray-300">sk-ant-api03-...</code>
              <p className="mt-2 text-xs text-gray-500">Anthropic API key</p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-purple-400">Groq</div>
              <code className="text-xs text-gray-300">gsk_...</code>
              <p className="mt-2 text-xs text-gray-500">Groq Cloud key</p>
            </div>
          </div>
        </motion.div>

        {/* Endpoints */}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-10">
          {ENDPOINTS.map((cat) => (
            <motion.div key={cat.category} variants={fadeUp}>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <cat.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold">{cat.category} API</h2>
              </div>

              <div className="space-y-4">
                {cat.endpoints.map((ep) => {
                  const isExpanded = expandedEndpoint === ep.endpoint;
                  return (
                    <div key={ep.endpoint} className="overflow-hidden rounded-xl border border-emerald-500/10 bg-gray-950/50 transition-all">
                      {/* Header */}
                      <button
                        onClick={() => setExpandedEndpoint(isExpanded ? null : ep.endpoint)}
                        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-emerald-500/5"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${ep.method === "GET" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                            {ep.method}
                          </span>
                          <code className="text-sm text-gray-300">{ep.endpoint}</code>
                          <span className="hidden text-sm text-gray-500 sm:inline">— {ep.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="hidden rounded-md border border-gray-700 px-2 py-0.5 text-[10px] text-gray-500 sm:inline">
                            {ep.auth}
                          </span>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-emerald-500/10"
                        >
                          <div className="px-6 py-5">
                            <p className="mb-5 text-sm text-gray-400">{ep.description}</p>

                            {/* Parameters */}
                            {ep.params && ep.params.length > 0 && (
                              <div className="mb-6">
                                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Parameters</h4>
                                <div className="overflow-hidden rounded-lg border border-emerald-500/10">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-emerald-500/10 bg-emerald-500/5">
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400">Name</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400">Type</th>
                                        <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-gray-400 sm:table-cell">Required</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ep.params.map((p) => (
                                        <tr key={p.name} className="border-b border-emerald-500/5 last:border-0">
                                          <td className="px-4 py-2.5"><code className="text-xs text-emerald-300">{p.name}</code></td>
                                          <td className="px-4 py-2.5 text-xs text-gray-400">{p.type}</td>
                                          <td className="hidden px-4 py-2.5 sm:table-cell">
                                            {p.required ? (
                                              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">required</span>
                                            ) : (
                                              <span className="rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] text-gray-500">optional</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-xs text-gray-400">{p.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Request / Response */}
                            <div className="grid gap-4 lg:grid-cols-2">
                              {ep.request && (
                                <div>
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                                      <Send className="h-3 w-3" /> Request Body
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(ep.request!, `req-${ep.endpoint}`)}
                                      className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-emerald-400"
                                    >
                                      {copiedIdx === `req-${ep.endpoint}` ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                      {copiedIdx === `req-${ep.endpoint}` ? "Copied!" : "Copy"}
                                    </button>
                                  </div>
                                  <pre className="overflow-x-auto rounded-lg border border-emerald-500/10 bg-black/60 p-4 text-xs leading-relaxed text-emerald-300/90">
                                    <code>{ep.request}</code>
                                  </pre>
                                </div>
                              )}
                              <div className={!ep.request ? "lg:col-span-2" : ""}>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                                    <Zap className="h-3 w-3" /> Response
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(ep.response, `res-${ep.endpoint}`)}
                                    className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-emerald-400"
                                  >
                                    {copiedIdx === `res-${ep.endpoint}` ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                    {copiedIdx === `res-${ep.endpoint}` ? "Copied!" : "Copy"}
                                  </button>
                                </div>
                                <pre className="overflow-x-auto rounded-lg border border-emerald-500/10 bg-black/60 p-4 text-xs leading-relaxed text-green-300/90">
                                  <code>{ep.response}</code>
                                </pre>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Rate Limits & Notes */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-16 rounded-xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
          <h2 className="mb-4 text-lg font-semibold">Notes</h2>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-emerald-400">•</span>
              All AI endpoints (suggestions, polish, audit) return streaming responses for real-time UI updates.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">•</span>
              API keys are validated before each request. Use <code className="text-emerald-300/80">/api/resume/test-key</code> to verify keys upfront.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">•</span>
              Compiled PDFs are cached for 1 hour. The <code className="text-emerald-300/80">pdfId</code> can be used to retrieve them via the preview endpoint.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">•</span>
              Portfolio deployment tokens (Netlify/Vercel) are stored client-side only and never persisted on the server.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">•</span>
              Rate limits depend on your AI provider plan. AURABIO itself does not impose additional rate limits.
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-emerald-500/10 px-6 py-8 mt-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-sm font-bold text-transparent">AURABIO</span>
          <Link href="/" className="text-sm text-gray-400 transition-colors hover:text-emerald-400">
            Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
