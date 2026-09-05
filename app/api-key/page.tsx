"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  Settings2,
  Zap,
} from "lucide-react";

type LlmProvider = "gemini" | "groq" | "claude";

type LlmSettings = {
  provider: LlmProvider;
  model: string;
  geminiApiKey: string;
  groqApiKey: string;
  claudeApiKey: string;
};

const MODEL_OPTIONS: { provider: LlmProvider; model: string; label: string }[] = [
  { provider: "gemini", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Recommended)" },
  { provider: "gemini", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { provider: "gemini", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { provider: "claude", model: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

function providerForModel(model: string): LlmProvider {
  return MODEL_OPTIONS.find((opt) => opt.model === model)?.provider ?? "gemini";
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function isValidModel(model: unknown): model is string {
  return typeof model === "string" && MODEL_OPTIONS.some((opt) => opt.model === model);
}

function readCachedLlmSettings(): LlmSettings | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const provider = getCookie("llm_provider");
    const model = getCookie("llm_model");
    const geminiKey = getCookie("gemini_api_key");
    const groqKey = getCookie("groq_api_key");
    const claudeKey = getCookie("claude_api_key");

    if (provider || model || geminiKey || groqKey || claudeKey) {
      return {
        provider: (["gemini", "groq", "claude"].includes(provider ?? "")
          ? provider
          : "gemini") as LlmProvider,
        model: isValidModel(model) ? model : "gemini-2.5-pro",
        geminiApiKey: geminiKey ?? "",
        groqApiKey: groqKey ?? "",
        claudeApiKey: claudeKey ?? "",
      };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function writeCachedLlmSettings(settings: LlmSettings) {
  setCookie("llm_provider", settings.provider);
  setCookie("llm_model", settings.model);
  setCookie("gemini_api_key", settings.geminiApiKey);
  setCookie("groq_api_key", settings.groqApiKey);
  setCookie("claude_api_key", settings.claudeApiKey);
}

const PROVIDER_META = {
  gemini: {
    name: "Google Gemini",
    placeholder: "AIza...",
    description: "Gemini 2.5 Pro / Flash — Google's latest multimodal models.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    borderColor: "border-blue-500/30",
    gradientFrom: "from-blue-500/10",
    ringColor: "ring-blue-400/60",
    badgeColor: "bg-blue-500/20 text-blue-300 ring-blue-500/30",
  },
  groq: {
    name: "Groq",
    placeholder: "gsk_...",
    description: "Llama 3.3 70B on Groq's ultra-fast inference engine.",
    docsUrl: "https://console.groq.com/keys",
    borderColor: "border-orange-500/30",
    gradientFrom: "from-orange-500/10",
    ringColor: "ring-orange-400/60",
    badgeColor: "bg-orange-500/20 text-orange-300 ring-orange-500/30",
  },
  claude: {
    name: "Anthropic Claude",
    placeholder: "sk-ant-...",
    description: "Claude Sonnet 4 — Anthropic's most capable model.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    borderColor: "border-purple-500/30",
    gradientFrom: "from-purple-500/10",
    ringColor: "ring-purple-400/60",
    badgeColor: "bg-purple-500/20 text-purple-300 ring-purple-500/30",
  },
} as const;

export default function ApiKeyPage() {
  const router = useRouter();
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("gemini");
  const [llmModel, setLlmModel] = useState("gemini-2.5-pro");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function handleBack() {
    if (typeof window !== "undefined") {
      if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
        router.push("/resume-generator");
        return;
      }
      if (window.history.length > 1) {
        router.back();
        return;
      }
    }
    router.push("/resume-generator");
  }

  useEffect(() => {
    const cached = readCachedLlmSettings();
    if (!cached) return;
    setLlmProvider(cached.provider);
    setLlmModel(cached.model);
    setGeminiApiKey(cached.geminiApiKey);
    setGroqApiKey(cached.groqApiKey);
    setClaudeApiKey(cached.claudeApiKey);
  }, []);

  function getActiveKey() {
    return (
      llmProvider === "groq" ? groqApiKey : llmProvider === "claude" ? claudeApiKey : geminiApiKey
    ).trim();
  }

  async function handleTestKey() {
    const key = getActiveKey();
    if (!key) {
      setTestResult({ ok: false, message: `No ${llmProvider} API key entered.` });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/resume/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: llmProvider, model: llmModel, apiKey: key }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; reply?: string };
      if (data.ok) {
        setTestResult({ ok: true, message: `Key works! Response: "${data.reply}"` });
      } else {
        setTestResult({ ok: false, message: data.error || "Test failed." });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error — check your connection." });
    } finally {
      setTestingKey(false);
    }
  }

  function handleSave() {
    const settings: LlmSettings = {
      provider: llmProvider,
      model: llmModel.trim() || "gemini-2.5-pro",
      geminiApiKey: geminiApiKey.trim(),
      groqApiKey: groqApiKey.trim(),
      claudeApiKey: claudeApiKey.trim(),
    };
    writeCachedLlmSettings(settings);
    setSaveSuccess(true);
    setTestResult(null);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  const providers: LlmProvider[] = ["gemini", "groq", "claude"];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-60 top-1/3 h-[600px] w-[600px] rounded-full bg-emerald-500/8 blur-[160px]" />
        <div className="absolute -right-40 bottom-1/4 h-[500px] w-[500px] rounded-full bg-emerald-400/6 blur-[140px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-emerald-500/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              AURABIO
            </span>
          </Link>
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-emerald-400 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </button>
        </div>
      </nav>

      <main className="relative mx-auto max-w-4xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
            <KeyRound className="h-3.5 w-3.5" />
            API Configuration
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            AI Model{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-gray-400">
            Configure your preferred AI provider and API keys. All settings are stored
            locally in your browser — nothing is sent to our servers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
              Active Model
            </h2>
          </div>
          <select
            id="llmModel"
            value={llmModel}
            onChange={(e) => {
              setLlmModel(e.target.value);
              setLlmProvider(providerForModel(e.target.value));
              setTestResult(null);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-colors hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          >
            <optgroup label="Gemini">
              {MODEL_OPTIONS.filter((o) => o.provider === "gemini").map((o) => (
                <option key={o.model} value={o.model} style={{ background: "#0f172a" }}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Groq">
              {MODEL_OPTIONS.filter((o) => o.provider === "groq").map((o) => (
                <option key={o.model} value={o.model} style={{ background: "#0f172a" }}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Claude">
              {MODEL_OPTIONS.filter((o) => o.provider === "claude").map((o) => (
                <option key={o.model} value={o.model} style={{ background: "#0f172a" }}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Selected provider:{" "}
            <span className="font-medium text-emerald-400">{PROVIDER_META[llmProvider].name}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6 space-y-4"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            API Keys
          </h2>

          {providers.map((provider) => {
            const meta = PROVIDER_META[provider];
            const isActive = llmProvider === provider;
            const value =
              provider === "gemini" ? geminiApiKey : provider === "groq" ? groqApiKey : claudeApiKey;
            const setter =
              provider === "gemini" ? setGeminiApiKey : provider === "groq" ? setGroqApiKey : setClaudeApiKey;

            return (
              <div
                key={provider}
                className={`rounded-2xl border bg-gradient-to-br ${meta.gradientFrom} to-transparent p-5 transition-all duration-200 ${meta.borderColor} ${isActive ? `ring-2 ${meta.ringColor}` : "opacity-75 hover:opacity-100"}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{meta.name}</span>
                    {isActive && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${meta.badgeColor}`}>
                        Active
                      </span>
                    )}
                  </div>
                  <a
                    href={meta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 underline-offset-2 transition-colors hover:text-emerald-400 hover:underline"
                  >
                    Get key ↗
                  </a>
                </div>
                <p className="mb-3 text-xs text-gray-400">{meta.description}</p>
                <input
                  id={`${provider}ApiKey`}
                  type="password"
                  value={value}
                  onChange={(e) => {
                    setter(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={meta.placeholder}
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-gray-600 transition-colors focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                />
              </div>
            );
          })}
        </motion.div>

        {testResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              testResult.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{testResult.message}</span>
          </motion.div>
        )}

        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Settings saved successfully! Your keys are stored locally in this browser.
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <button
            type="button"
            disabled={testingKey}
            onClick={handleTestKey}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testingKey ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-emerald-400" />
            )}
            {testingKey ? "Testing…" : "Test Key"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-6 py-3 text-sm font-semibold text-black transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-xs text-gray-600"
        >
          Your API keys are stored as browser cookies and never leave your device.{" "}
          <Link href="/resume-generator" className="text-emerald-500 hover:underline">
            Go to Resume Generator →
          </Link>
        </motion.p>
      </main>
    </div>
  );
}
