"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  ArrowLeft,
  Image as ImageIcon,
  Rocket,
  ExternalLink,
  Check,
  Save,
  FileText,
} from "lucide-react";
import type {
  PortfolioData,
  EducationEntry,
  SkillCategory,
  CertificateEntry,
  ExperienceEntry,
  ProjectEntry,
  AchievementEntry,
  SocialLink,
} from "@/types/portfolio";
import {
  portfolioFromStorage,
  portfolioToStorage,
  generatePortfolioHtml,
  createDefaultPortfolioData,
  extractPortfolioFromResume,
} from "@/lib/portfolio";
import { parseLatexResume, type ProjectDraft } from "@/lib/latex-resume";
import { createClient } from "@/lib/supabase";

const TABS = [
  { id: "intro", label: "Intro" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "achievements", label: "Achieve" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PortfolioGenerator() {
  const [data, setData] = useState<PortfolioData>(createDefaultPortfolioData);
  const [committedData, setCommittedData] = useState<PortfolioData>(createDefaultPortfolioData);
  const [activeTab, setActiveTab] = useState<TabId>("intro");
  const [templateHtml, setTemplateHtml] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const uid = session.user.id;

        const { data: projects } = await supabase
          .from("resume_projects")
          .select("id, latex_code")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (projects && projects.length > 0) {
          const latexCode = projects[0].latex_code || "";
          const { data: drafts } = await supabase
            .from("resume_project_drafts")
            .select("*")
            .eq("project_id", projects[0].id)
            .order("sort_order");

          const mappedDrafts: ProjectDraft[] = (drafts ?? []).map(
            (d: Record<string, string>) => ({
              heading: d.heading || "",
              explanation: d.explanation || "",
              techStack: d.tech_stack || "",
              link: d.link || "",
              fromDate: d.from_date || "",
              toDate: d.to_date || "",
            }),
          );

          const sections = parseLatexResume(latexCode);
          const extracted = extractPortfolioFromResume(sections, mappedDrafts);

          const { data: saved } = await supabase
            .from("portfolio_data")
            .select("data")
            .eq("user_id", uid)
            .single();

          if (saved?.data) {
            const savedPortfolio = saved.data as PortfolioData;
            const merged = {
              ...extracted,
              intro: { ...extracted.intro, profileImageBase64: savedPortfolio.intro?.profileImageBase64 || null, resumeLink: savedPortfolio.intro?.resumeLink || extracted.intro.resumeLink },
              github: { ...extracted.github, ...savedPortfolio.github, username: savedPortfolio.github?.username || extracted.github.username },
              leetcode: { ...extracted.leetcode, ...savedPortfolio.leetcode, username: savedPortfolio.leetcode?.username || extracted.leetcode.username },
            };
            setData(merged);
            setCommittedData(merged);
          } else {
            setData(extracted);
            setCommittedData(extracted);
          }
        } else {
          const { data: saved } = await supabase
            .from("portfolio_data")
            .select("data")
            .eq("user_id", uid)
            .single();
          if (saved?.data) {
            setData(saved.data as PortfolioData);
            setCommittedData(saved.data as PortfolioData);
          } else {
            const stored = portfolioFromStorage();
            if (stored) { setData(stored); setCommittedData(stored); }
          }
        }
      } else {
        const stored = portfolioFromStorage();
        if (stored) { setData(stored); setCommittedData(stored); }
      }
    }
    loadData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { id: string } } | null) => {
        setUserId(session?.user?.id ?? null);
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch("/portfolio.html")
      .then((r) => r.text())
      .then(setTemplateHtml)
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => portfolioToStorage(data), 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data]);

  const portfolioHtml = useMemo(
    () => generatePortfolioHtml(committedData, templateHtml),
    [committedData, templateHtml],
  );

  const update = useCallback(
    <K extends keyof PortfolioData>(key: K, value: PortfolioData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const [deployOpen, setDeployOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployPlatform, setDeployPlatform] = useState<"netlify" | "vercel" | null>(null);
  const [deployToken, setDeployToken] = useState("");
  const deployDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("portfolio-deploy-state");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.url) setDeployedUrl(parsed.url);
        if (parsed.platform) setDeployPlatform(parsed.platform);
        if (parsed.token) setDeployToken(parsed.token);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (deployDropdownRef.current && !deployDropdownRef.current.contains(e.target as Node)) {
        setDeployOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const deployToNetlify = async (token: string) => {
    setDeploying(true);
    setDeployError(null);
    try {
      const stored = localStorage.getItem("portfolio-deploy-state");
      const prev = stored ? JSON.parse(stored) : {};
      const res = await fetch("/api/portfolio/deploy/netlify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          html: portfolioHtml,
          siteName: data.intro.name ? `${data.intro.name.toLowerCase().replace(/\s+/g, "-")}-portfolio` : "my-portfolio",
          siteId: prev.netlifySiteId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setDeployError(err.error || "Deploy failed");
        return;
      }
      const result = await res.json();
      setDeployedUrl(result.url);
      setDeployOpen(false);
      localStorage.setItem("portfolio-deploy-state", JSON.stringify({
        url: result.url,
        platform: "netlify",
        token,
        netlifySiteId: result.siteId,
      }));
    } catch {
      setDeployError("Network error during deploy");
    } finally {
      setDeploying(false);
    }
  };

  const deployToVercel = async (token: string) => {
    setDeploying(true);
    setDeployError(null);
    try {
      const res = await fetch("/api/portfolio/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          html: portfolioHtml,
          projectName: data.intro.name ? `${data.intro.name.toLowerCase().replace(/\s+/g, "-")}-portfolio` : "my-portfolio",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setDeployError(err.error || "Deploy failed");
        return;
      }
      const result = await res.json();
      setDeployedUrl(result.url);
      setDeployOpen(false);
      localStorage.setItem("portfolio-deploy-state", JSON.stringify({
        url: result.url,
        platform: "vercel",
        token,
        projectName: result.projectName,
      }));
    } catch {
      setDeployError("Network error during deploy");
    } finally {
      setDeploying(false);
    }
  };

  const handleDeploy = () => {
    if (!deployToken.trim()) {
      setDeployError("Please enter your access token");
      return;
    }
    if (deployPlatform === "netlify") deployToNetlify(deployToken);
    else if (deployPlatform === "vercel") deployToVercel(deployToken);
  };

  const redeployExisting = async () => {
    const stored = localStorage.getItem("portfolio-deploy-state");
    if (!stored) return;
    const prev = JSON.parse(stored);
    if (prev.platform === "netlify" && prev.token) {
      await deployToNetlify(prev.token);
    } else if (prev.platform === "vercel" && prev.token) {
      await deployToVercel(prev.token);
    } else {
      setDeployError("No saved token. Please enter your token and deploy again.");
    }
  };

  const saveToSupabase = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("portfolio_data")
        .upsert(
          { user_id: userId, data, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (!error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const recompile = useCallback(() => setCommittedData(data), [data]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleResumeUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
      const sections = parseLatexResume(text);

      const extracted = extractPortfolioFromResume(sections, []);

      const merged: PortfolioData = {
        ...extracted,
        intro: {
          ...extracted.intro,
          profileImageBase64: data.intro.profileImageBase64 || null,
        },
        github: { ...extracted.github, username: data.github.username || extracted.github.username },
        leetcode: { ...extracted.leetcode, username: data.leetcode.username || extracted.leetcode.username },
      };

      setData(merged);
      setCommittedData(merged);
      setUploadDialogOpen(false);
    } catch {
      setUploadError("Failed to parse the file. Please ensure it is a valid LaTeX (.tex) resume.");
    } finally {
      setUploadLoading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }, [data]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Panel - Preview */}
      <div className="flex-[3] min-w-0 border-r flex flex-col">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-2.5 bg-slate-800 text-slate-100 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-700/50"
            onClick={() => window.close()}
            title="Back to Resume Editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-5 bg-slate-700/60" />
          <h1 className="text-sm font-bold text-slate-200 tracking-wide">Portfolio Preview</h1>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-slate-700/60 border border-slate-650 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
            onClick={() => setUploadDialogOpen(true)}
            title="Upload a LaTeX resume (.tex) to populate portfolio"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Resume
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {deployedUrl && (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/80 rounded-md hover:bg-emerald-950/60 transition-colors shadow-sm"
              >
                <Check className="h-3 w-3 text-emerald-400" />
                Live
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {deployedUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-slate-700/60 border border-slate-650 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
                onClick={redeployExisting}
                disabled={deploying}
              >
                {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Redeploy
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs bg-slate-700/60 border border-slate-650 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
              onClick={recompile}
              title="Update preview with current edits"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recompile
            </Button>
            {userId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-slate-700/60 border border-slate-650 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-40"
                onClick={saveToSupabase}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving..." : saveSuccess ? "Saved" : "Save"}
              </Button>
            )}
            <div className="relative" ref={deployDropdownRef}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white font-semibold transition-all shadow-md shadow-emerald-950/20 active:scale-95"
                onClick={() => setDeployOpen(!deployOpen)}
                disabled={deploying}
              >
                {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                Deploy
                <ChevronDown className="h-3 w-3" />
              </Button>
              {deployOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-4 space-y-3.5 text-slate-100">
                  <p className="text-xs font-semibold text-slate-200">Deploy Portfolio</p>
                  <div className="flex gap-1.5">
                    <button
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium border rounded-md transition-colors ${deployPlatform === "netlify" ? "border-[#00C7B7] bg-[#00C7B7]/10 text-[#00E5D5]" : "border-slate-750 hover:bg-slate-800 text-slate-300 hover:text-slate-100"}`}
                      onClick={() => setDeployPlatform("netlify")}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 40 40" fill="none"><path d="M20.593 3.007L3.478 20.122l17.115 17.115 17.115-17.115L20.593 3.007z" fill="#00C7B7" /></svg>
                      Netlify
                    </button>
                    <button
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium border rounded-md transition-colors ${deployPlatform === "vercel" ? "border-white bg-white/5 text-white" : "border-slate-750 hover:bg-slate-800 text-slate-300 hover:text-slate-100"}`}
                      onClick={() => setDeployPlatform("vercel")}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 76 65" fill="none"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="white" /></svg>
                      Vercel
                    </button>
                  </div>
                  {deployPlatform && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          {deployPlatform === "netlify" ? "Netlify" : "Vercel"} Personal Access Token
                        </label>
                        <input
                          type="password"
                          value={deployToken}
                          onChange={(e) => setDeployToken(e.target.value)}
                          placeholder="Paste your token here..."
                          className="h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500 transition-all"
                        />
                        <p className="text-[9px] leading-relaxed text-slate-500">
                          {deployPlatform === "netlify"
                            ? "Get it from app.netlify.com → User settings → Applications → Personal access tokens"
                            : "Get it from vercel.com → Settings → Tokens → Create"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold transition-all border-0 shadow-sm active:scale-95"
                        onClick={handleDeploy}
                        disabled={deploying || !deployToken.trim()}
                      >
                        {deploying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                        {deploying ? "Deploying..." : `Deploy to ${deployPlatform === "netlify" ? "Netlify" : "Vercel"}`}
                      </Button>
                    </>
                  )}
                  {deployError && (
                    <p className="text-[10px] text-rose-400 animate-pulse font-medium">{deployError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {templateHtml ? (
          <iframe
            srcDoc={portfolioHtml}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts"
            title="Portfolio Preview"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading template...
          </div>
        )}
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-[1] min-w-0 flex flex-col bg-white">
        {/* Tab nav */}
        <div className="border-b px-3 py-2.5 shrink-0 bg-slate-900">
          <div
            className="grid grid-cols-5 rounded-lg border border-slate-700/60 bg-slate-800 p-1"
            role="tablist"
            aria-label="Portfolio editor tabs"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 text-xs font-semibold rounded-md transition-all duration-150 ${activeTab === tab.id
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md border-0 hover:from-emerald-450 hover:to-teal-450"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {activeTab === "intro" && (
              <IntroForm data={data} update={update} />
            )}
            {activeTab === "education" && (
              <EducationForm data={data} update={update} />
            )}
            {activeTab === "experience" && (
              <ExperienceForm data={data} update={update} />
            )}
            {activeTab === "projects" && (
              <ProjectsForm data={data} update={update} />
            )}
            {activeTab === "achievements" && (
              <AchievementsForm data={data} update={update} />
            )}
          </div>
        </ScrollArea>
      </div>

      {uploadDialogOpen && (
        <DialogContent onClose={() => { setUploadDialogOpen(false); setUploadError(null); setUploadLoading(false); }}>
          <DialogHeader>
            <DialogTitle>Upload LaTeX Resume</DialogTitle>
            <DialogDescription>
              Upload a .tex resume file to automatically populate your portfolio sections.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <AnimatePresence mode="wait">
              {uploadLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-10 gap-4"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-10 w-10 text-emerald-500" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground animate-pulse font-medium">
                    Parsing your resume...
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/5 transition-colors">
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Click to select a .tex file
                    </span>
                    <span className="text-xs text-muted-foreground/60 mt-1">
                      Only LaTeX resume files (.tex)
                    </span>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept=".tex"
                      className="sr-only"
                      onChange={handleResumeUpload}
                    />
                  </label>
                  {uploadError && (
                    <p className="text-xs text-destructive text-center font-medium">{uploadError}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setUploadDialogOpen(false); setUploadError(null); setUploadLoading(false); }}
              disabled={uploadLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </div>
  );
}

type FormProps = {
  data: PortfolioData;
  update: <K extends keyof PortfolioData>(key: K, val: PortfolioData[K]) => void;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
  );
}

function ImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    onChange(base64);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-10 w-10 rounded-md object-cover border"
          />
        ) : (
          <div className="h-10 w-10 rounded-md border border-dashed flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3 w-3" />
          Upload
        </Button>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive"
            onClick={() => onChange(null)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

/* ─── INTRO TAB ─────────────────────────────────────────────── */
function IntroForm({ data, update }: FormProps) {
  const intro = data.intro;
  const set = (patch: Partial<typeof intro>) =>
    update("intro", { ...intro, ...patch });

  const addSocialLink = () =>
    set({
      socialLinks: [
        ...intro.socialLinks,
        { platform: "github", url: "" },
      ],
    });

  const removeSocialLink = (i: number) =>
    set({ socialLinks: intro.socialLinks.filter((_, idx) => idx !== i) });

  const updateSocialLink = (i: number, patch: Partial<SocialLink>) =>
    set({
      socialLinks: intro.socialLinks.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    });

  return (
    <>
      <SectionHeader title="Intro / Home" />
      <ImageUpload
        label="Profile Photo"
        value={intro.profileImageBase64}
        onChange={(v) => set({ profileImageBase64: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Full Name</Label>
        <Input
          value={intro.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="John Doe"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <Input
          value={intro.headline}
          onChange={(e) => set({ headline: e.target.value })}
          placeholder="Crafting digital futures."
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={intro.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="A brief description about yourself..."
          className="text-xs min-h-[60px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Availability Tag</Label>
        <Input
          value={intro.availabilityTag}
          onChange={(e) => set({ availabilityTag: e.target.value })}
          placeholder="Available for freelance"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Resume Link (PDF URL)</Label>
        <Input
          value={intro.resumeLink}
          onChange={(e) => set({ resumeLink: e.target.value })}
          placeholder="https://example.com/resume.pdf"
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Replaces &quot;About Me&quot; button with a Resume download link in the hero section.
        </p>
      </div>

      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Social Links</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={addSocialLink}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {intro.socialLinks.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={link.platform}
            onChange={(e) =>
              updateSocialLink(i, {
                platform: e.target.value as SocialLink["platform"],
              })
            }
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="github">GitHub</option>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">Twitter</option>
            <option value="leetcode">LeetCode</option>
            <option value="email">Email</option>
            <option value="website">Website</option>
          </select>
          <Input
            value={link.url}
            onChange={(e) => updateSocialLink(i, { url: e.target.value })}
            placeholder="URL"
            className="h-8 text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive"
            onClick={() => removeSocialLink(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <Separator />
      <GitHubInlineForm data={data} update={update} />

      <Separator />
      <LeetCodeInlineForm data={data} update={update} />
    </>
  );
}

function GitHubInlineForm({ data, update }: FormProps) {
  const gh = data.github;
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const setGh = (patch: Partial<typeof gh>) =>
    update("github", { ...gh, ...patch });

  const fetchGhStats = async () => {
    if (!gh.username.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/portfolio/github?username=${encodeURIComponent(gh.username)}`);
      if (!res.ok) {
        const err = await res.json();
        setFetchError(err.error || "Failed to fetch");
        return;
      }
      const stats = await res.json();
      update("github", { ...gh, ...stats });
    } catch {
      setFetchError("Network error");
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <SectionHeader title="GitHub Stats" />
      <div className="space-y-1.5">
        <Label className="text-xs">GitHub Username</Label>
        <div className="flex items-center gap-2">
          <Input
            value={gh.username}
            onChange={(e) => setGh({ username: e.target.value })}
            placeholder="octocat"
            className="h-8 text-xs flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            onClick={fetchGhStats}
            disabled={fetching || !gh.username.trim()}
          >
            {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Fetch
          </Button>
        </div>
        {fetchError && <p className="text-[10px] text-destructive">{fetchError}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Contributions</Label>
          <Input type="number" value={gh.contributions} onChange={(e) => setGh({ contributions: +e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Repos</Label>
          <Input type="number" value={gh.repos} onChange={(e) => setGh({ repos: +e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Stars</Label>
          <Input value={gh.stars} onChange={(e) => setGh({ stars: e.target.value })} placeholder="1.2k" className="h-8 text-xs" />
        </div>
      </div>
    </>
  );
}

function LeetCodeInlineForm({ data, update }: FormProps) {
  const lc = data.leetcode;
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const setLc = (patch: Partial<typeof lc>) =>
    update("leetcode", { ...lc, ...patch });

  const fetchLcStats = async () => {
    if (!lc.username.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/portfolio/leetcode?username=${encodeURIComponent(lc.username)}`);
      if (!res.ok) {
        const err = await res.json();
        setFetchError(err.error || "Failed to fetch");
        return;
      }
      const stats = await res.json();
      update("leetcode", { ...lc, ...stats });
    } catch {
      setFetchError("Network error");
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <SectionHeader title="LeetCode Stats" />
      <div className="space-y-1.5">
        <Label className="text-xs">LeetCode Username</Label>
        <div className="flex items-center gap-2">
          <Input
            value={lc.username}
            onChange={(e) => setLc({ username: e.target.value })}
            placeholder="leetcoder123"
            className="h-8 text-xs flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            onClick={fetchLcStats}
            disabled={fetching || !lc.username.trim()}
          >
            {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Fetch
          </Button>
        </div>
        {fetchError && <p className="text-[10px] text-destructive">{fetchError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Total Solved</Label>
        <Input type="number" value={lc.totalSolved} onChange={(e) => setLc({ totalSolved: +e.target.value })} className="h-8 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Easy Solved</Label>
          <Input type="number" value={lc.easy.solved} onChange={(e) => setLc({ easy: { ...lc.easy, solved: +e.target.value } })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Easy Total</Label>
          <Input type="number" value={lc.easy.total} onChange={(e) => setLc({ easy: { ...lc.easy, total: +e.target.value } })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Medium Solved</Label>
          <Input type="number" value={lc.medium.solved} onChange={(e) => setLc({ medium: { ...lc.medium, solved: +e.target.value } })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Medium Total</Label>
          <Input type="number" value={lc.medium.total} onChange={(e) => setLc({ medium: { ...lc.medium, total: +e.target.value } })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hard Solved</Label>
          <Input type="number" value={lc.hard.solved} onChange={(e) => setLc({ hard: { ...lc.hard, solved: +e.target.value } })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hard Total</Label>
          <Input type="number" value={lc.hard.total} onChange={(e) => setLc({ hard: { ...lc.hard, total: +e.target.value } })} className="h-8 text-xs" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Ranking</Label>
          <Input type="number" value={lc.ranking} onChange={(e) => setLc({ ranking: +e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Streak</Label>
          <Input type="number" value={lc.streak} onChange={(e) => setLc({ streak: +e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Percentile</Label>
          <Input value={lc.globalPercentile} onChange={(e) => setLc({ globalPercentile: e.target.value })} placeholder="Top 5%" className="h-8 text-xs" />
        </div>
      </div>
    </>
  );
}

/* ─── EDUCATION TAB ─────────────────────────────────────────── */
function EducationForm({ data, update }: FormProps) {
  const edu = data.education;
  const set = (patch: Partial<typeof edu>) =>
    update("education", { ...edu, ...patch });

  const addEntry = () =>
    set({
      entries: [
        ...edu.entries,
        { degree: "", institution: "", period: "", description: "" },
      ],
    });
  const removeEntry = (i: number) =>
    set({ entries: edu.entries.filter((_, idx) => idx !== i) });
  const updateEntry = (i: number, patch: Partial<EducationEntry>) =>
    set({
      entries: edu.entries.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    });

  const addSkillCat = () =>
    set({ skills: [...edu.skills, { name: "", skills: [] }] });
  const removeSkillCat = (i: number) =>
    set({ skills: edu.skills.filter((_, idx) => idx !== i) });
  const updateSkillCat = (i: number, patch: Partial<SkillCategory>) =>
    set({
      skills: edu.skills.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    });

  const addCert = () =>
    set({
      certificates: [
        ...edu.certificates,
        { title: "", provider: "", year: "" },
      ],
    });
  const removeCert = (i: number) =>
    set({ certificates: edu.certificates.filter((_, idx) => idx !== i) });
  const updateCert = (i: number, patch: Partial<CertificateEntry>) =>
    set({
      certificates: edu.certificates.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    });

  return (
    <>
      <SectionHeader title="Education" />
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Degrees</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={addEntry}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {edu.entries.map((entry, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-3 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
            onClick={() => removeEntry(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Input
            value={entry.degree}
            onChange={(e) => updateEntry(i, { degree: e.target.value })}
            placeholder="Degree"
            className="h-8 text-xs"
          />
          <Input
            value={entry.institution}
            onChange={(e) =>
              updateEntry(i, { institution: e.target.value })
            }
            placeholder="Institution"
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={entry.period}
              onChange={(e) => updateEntry(i, { period: e.target.value })}
              placeholder="2018 - 2022"
              className="h-8 text-xs"
            />
          </div>
          <Input
            value={entry.description}
            onChange={(e) =>
              updateEntry(i, { description: e.target.value })
            }
            placeholder="Description"
            className="h-8 text-xs"
          />
        </div>
      ))}

      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Skill Categories</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={addSkillCat}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {edu.skills.map((cat, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-3 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
            onClick={() => removeSkillCat(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Input
            value={cat.name}
            onChange={(e) => updateSkillCat(i, { name: e.target.value })}
            placeholder="Category name (e.g. Frontend)"
            className="h-8 text-xs"
          />
          <Input
            value={cat.skills.join(", ")}
            onChange={(e) =>
              updateSkillCat(i, {
                skills: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Skills (comma separated)"
            className="h-8 text-xs"
          />
        </div>
      ))}

      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Certificates</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={addCert}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {edu.certificates.map((cert, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-3 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
            onClick={() => removeCert(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Input
            value={cert.title}
            onChange={(e) => updateCert(i, { title: e.target.value })}
            placeholder="Certificate title"
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={cert.provider}
              onChange={(e) =>
                updateCert(i, { provider: e.target.value })
              }
              placeholder="Provider"
              className="h-8 text-xs"
            />
            <Input
              value={cert.year}
              onChange={(e) => updateCert(i, { year: e.target.value })}
              placeholder="Year"
              className="h-8 text-xs"
            />
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── EXPERIENCE TAB ────────────────────────────────────────── */
function ExperienceForm({ data, update }: FormProps) {
  const exp = data.experience;
  const set = (patch: Partial<typeof exp>) =>
    update("experience", { ...exp, ...patch });

  const addEntry = () =>
    set({
      entries: [
        ...exp.entries,
        {
          role: "",
          company: "",
          period: "",
          techStack: [],
          achievements: [],
          companyLogoBase64: null,
        },
      ],
    });
  const removeEntry = (i: number) =>
    set({ entries: exp.entries.filter((_, idx) => idx !== i) });
  const updateEntry = (i: number, patch: Partial<ExperienceEntry>) =>
    set({
      entries: exp.entries.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    });

  return (
    <>
      <SectionHeader title="Experience" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addEntry}
      >
        <Plus className="h-3 w-3" /> Add Experience
      </Button>
      {exp.entries.map((entry, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-3 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
            onClick={() => removeEntry(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <ImageUpload
            label="Company Logo"
            value={entry.companyLogoBase64}
            onChange={(v) => updateEntry(i, { companyLogoBase64: v })}
          />
          <Input
            value={entry.role}
            onChange={(e) => updateEntry(i, { role: e.target.value })}
            placeholder="Role / Title"
            className="h-8 text-xs"
          />
          <Input
            value={entry.company}
            onChange={(e) => updateEntry(i, { company: e.target.value })}
            placeholder="Company"
            className="h-8 text-xs"
          />
          <Input
            value={entry.period}
            onChange={(e) => updateEntry(i, { period: e.target.value })}
            placeholder="Jan 2022 - Present"
            className="h-8 text-xs"
          />
          <Input
            value={entry.techStack.join(", ")}
            onChange={(e) =>
              updateEntry(i, {
                techStack: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Tech stack (comma separated)"
            className="h-8 text-xs"
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Achievements</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() =>
                  updateEntry(i, {
                    achievements: [...entry.achievements, ""],
                  })
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {entry.achievements.map((ach, j) => (
              <div key={j} className="flex items-center gap-1">
                <Input
                  value={ach}
                  onChange={(e) => {
                    const updated = [...entry.achievements];
                    updated[j] = e.target.value;
                    updateEntry(i, { achievements: updated });
                  }}
                  placeholder="Achievement"
                  className="h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive shrink-0"
                  onClick={() =>
                    updateEntry(i, {
                      achievements: entry.achievements.filter(
                        (_, idx) => idx !== j,
                      ),
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── PROJECTS TAB ──────────────────────────────────────────── */
function ProjectsForm({ data, update }: FormProps) {
  const proj = data.projects;
  const set = (patch: Partial<typeof proj>) =>
    update("projects", { ...proj, ...patch });

  const [projectInputMode, setProjectInputMode] = useState<"form" | "json">("form");
  const [projectsJson, setProjectsJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const addEntry = () =>
    set({
      entries: [
        ...proj.entries,
        {
          name: "",
          description: "",
          period: "",
          techStack: [],
          emoji: "💻",
          demoUrl: "",
          codeUrl: "",
          imageBase64: null,
        },
      ],
    });
  const removeEntry = (i: number) =>
    set({ entries: proj.entries.filter((_, idx) => idx !== i) });
  const updateEntry = (i: number, patch: Partial<ProjectEntry>) =>
    set({
      entries: proj.entries.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    });

  function applyProjectsJson() {
    const result = parsePortfolioProjectJson(projectsJson);
    if (!result.ok) {
      setJsonError(result.error);
      return;
    }
    set({ entries: result.entries });
    setProjectInputMode("form");
    setJsonError(null);
    setProjectsJson("");
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionHeader title="Projects" />
        <div
          className="grid grid-cols-2 rounded-lg border border-input bg-muted/30 p-0.5"
          role="tablist"
          aria-label="Project input method"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-6 px-3 text-[10px] font-bold transition-all rounded ${
              projectInputMode === "form"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => setProjectInputMode("form")}
          >
            FORM
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-6 px-3 text-[10px] font-bold transition-all rounded ${
              projectInputMode === "json"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => setProjectInputMode("json")}
          >
            JSON
          </Button>
        </div>
      </div>

      {projectInputMode === "form" ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={addEntry}
          >
            <Plus className="h-3 w-3" /> Add Project
          </Button>
          {proj.entries.map((entry, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border p-3 relative"
            >
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
                onClick={() => removeEntry(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <ImageUpload
                label="Project Image"
                value={entry.imageBase64}
                onChange={(v) => updateEntry(i, { imageBase64: v })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Project Name</Label>
                <Input
                  value={entry.name}
                  onChange={(e) => updateEntry(i, { name: e.target.value })}
                  placeholder="Project name"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={entry.description}
                  onChange={(e) =>
                    updateEntry(i, { description: e.target.value })
                  }
                  placeholder="Description"
                  className="text-xs min-h-[50px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Period</Label>
                <Input
                  value={entry.period}
                  onChange={(e) => updateEntry(i, { period: e.target.value })}
                  placeholder="Jan 2023 - Jun 2023"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tech Stack</Label>
                <Input
                  value={entry.techStack.join(", ")}
                  onChange={(e) =>
                    updateEntry(i, {
                      techStack: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Tech stack (comma separated)"
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Emoji</Label>
                  <Input
                    value={entry.emoji}
                    onChange={(e) =>
                      updateEntry(i, { emoji: e.target.value })
                    }
                    placeholder="Emoji"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Demo URL</Label>
                  <Input
                    value={entry.demoUrl}
                    onChange={(e) =>
                      updateEntry(i, { demoUrl: e.target.value })
                    }
                    placeholder="Demo URL"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Code URL</Label>
                <Input
                  value={entry.codeUrl}
                  onChange={(e) =>
                    updateEntry(i, { codeUrl: e.target.value })
                  }
                  placeholder="Code URL (GitHub)"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground">
            Paste project data as JSON array or {"{"}&quot;projects&quot;: [...]{"}"} object
          </Label>
          <Textarea
            value={projectsJson}
            onChange={(e) => { setProjectsJson(e.target.value); setJsonError(null); }}
            placeholder={`[\n  {\n    "name": "My Project",\n    "description": "Built with React and Node.js",\n    "tech_stack": ["React", "Node.js"],\n    "period": "Jan 2024 - Mar 2024",\n    "demo_url": "https://demo.example.com",\n    "code_url": "https://github.com/user/repo",\n    "emoji": "🚀"\n  }\n]`}
            className="min-h-[200px] font-mono text-xs"
          />
          {jsonError && (
            <p className="text-xs text-destructive font-medium">{jsonError}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={applyProjectsJson}
              disabled={!projectsJson.trim()}
            >
              <Check className="h-3 w-3" />
              Apply JSON
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── ACHIEVEMENTS TAB ──────────────────────────────────────── */
function AchievementsForm({ data, update }: FormProps) {
  const ach = data.achievements;
  const set = (patch: Partial<typeof ach>) =>
    update("achievements", { ...ach, ...patch });

  const addEntry = () =>
    set({
      entries: [
        ...ach.entries,
        { title: "", metric: "", emoji: "🏆", imageBase64: null },
      ],
    });
  const removeEntry = (i: number) =>
    set({ entries: ach.entries.filter((_, idx) => idx !== i) });
  const updateEntry = (i: number, patch: Partial<AchievementEntry>) =>
    set({
      entries: ach.entries.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    });

  return (
    <>
      <SectionHeader title="Achievements" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addEntry}
      >
        <Plus className="h-3 w-3" /> Add Achievement
      </Button>
      {ach.entries.map((entry, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-3 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive"
            onClick={() => removeEntry(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <ImageUpload
            label="Achievement Image"
            value={entry.imageBase64}
            onChange={(v) => updateEntry(i, { imageBase64: v })}
          />
          <Input
            value={entry.title}
            onChange={(e) => updateEntry(i, { title: e.target.value })}
            placeholder="Achievement title"
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={entry.metric}
              onChange={(e) =>
                updateEntry(i, { metric: e.target.value })
              }
              placeholder="Metric (e.g. 2023)"
              className="h-8 text-xs"
            />
            <Input
              value={entry.emoji}
              onChange={(e) => updateEntry(i, { emoji: e.target.value })}
              placeholder="Emoji"
              className="h-8 text-xs"
            />
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── JSON Parser for Portfolio Projects ──────────────────────── */
function parsePortfolioProjectJson(value: string):
  | { ok: true; entries: ProjectEntry[] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: "Invalid JSON syntax." };
  }

  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === "object" && "projects" in (parsed as Record<string, unknown>))
      ? (parsed as Record<string, unknown>).projects as unknown[]
      : [parsed];

  if (!Array.isArray(items)) {
    return { ok: false, error: "Expected an array of projects or { \"projects\": [...] }." };
  }

  const entries: ProjectEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;

    const name = str(r.name ?? r.title ?? r.heading);
    const description = str(r.description ?? r.explanation ?? r.summary ?? r.role);
    const techStackRaw = r.techStack ?? r.tech_stack ?? r.stack ?? r.technologies;
    const techStack = Array.isArray(techStackRaw)
      ? techStackRaw.filter((s): s is string => typeof s === "string")
      : typeof techStackRaw === "string"
        ? techStackRaw.split(",").map(s => s.trim()).filter(Boolean)
        : [];
    const period = str(r.period ?? r.date ?? r.dates);
    const emoji = str(r.emoji) || "💻";
    const demoUrl = str(r.demoUrl ?? r.demo_url ?? r.demo ?? r.link ?? r.url);
    const codeUrl = str(r.codeUrl ?? r.code_url ?? r.github ?? r.repo ?? r.repository);
    const imageBase64 = typeof r.imageBase64 === "string" ? r.imageBase64 : null;

    if (name || description) {
      entries.push({ name, description, period, techStack, emoji, demoUrl, codeUrl, imageBase64 });
    }
  }

  if (entries.length === 0) {
    return { ok: false, error: "No valid projects found. Each needs at least a name or description." };
  }

  return { ok: true, entries };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
