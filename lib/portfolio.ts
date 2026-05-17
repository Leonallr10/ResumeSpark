import type { ResumeSection } from "@/types/resume";
import type { ProjectDraft } from "@/lib/latex-resume";
import type {
  PortfolioData,
  IntroSection,
  GitHubSection,
  LeetCodeSection,
  EducationSection,
  EducationEntry,
  SkillCategory,
  CertificateEntry,
  ExperienceSection,
  ExperienceEntry,
  ProjectsSection,
  ProjectEntry,
  AchievementsSection,
  AchievementEntry,
} from "@/types/portfolio";

const STORAGE_KEY = "resume-tailor-portfolio-v1";

export function createDefaultPortfolioData(): PortfolioData {
  return {
    intro: {
      name: "",
      headline: "Crafting digital futures.",
      description: "",
      availabilityTag: "Available for opportunities",
      profileImageBase64: null,
      socialLinks: [],
      resumeLink: "",
    },
    github: { username: "", contributions: 0, repos: 0, stars: "0" },
    leetcode: {
      username: "",
      totalSolved: 0,
      easy: { solved: 0, total: 800 },
      medium: { solved: 0, total: 1600 },
      hard: { solved: 0, total: 680 },
      ranking: 0,
      streak: 0,
      globalPercentile: "Top 50%",
    },
    education: { entries: [], skills: [], certificates: [] },
    experience: { entries: [] },
    projects: { entries: [] },
    achievements: { entries: [] },
  };
}

export function extractPortfolioFromResume(
  resumeSections: ResumeSection[],
  projectDrafts: ProjectDraft[],
): PortfolioData {
  const data = createDefaultPortfolioData();

  for (const section of resumeSections) {
    const title = section.title.toLowerCase();

    if (!section.title || title === "header" || section.id === "header") {
      extractHeader(section, data.intro);
    } else if (title.includes("education")) {
      extractEducation(section, data.education);
    } else if (title.includes("skill") || title.includes("technical")) {
      extractSkills(section, data.education);
    } else if (title.includes("experience") || title.includes("employment") || title.includes("work")) {
      extractExperience(section, data.experience);
    } else if (title.includes("project")) {
      extractProjects(section, data.projects);
    } else if (title.includes("achievement") || title.includes("award") || title.includes("certification")) {
      extractAchievements(section, data.achievements);
    }
  }

  for (const draft of projectDrafts) {
    if (!draft.heading.trim()) continue;
    const exists = data.projects.entries.some(
      (p) => p.name.toLowerCase() === draft.heading.toLowerCase(),
    );
    if (!exists) {
      data.projects.entries.push({
        name: draft.heading,
        description: draft.explanation.replace(/;;/g, ". "),
        period: [draft.fromDate, draft.toDate].filter(Boolean).join(" - "),
        techStack: draft.techStack.split(",").map((s) => s.trim()).filter(Boolean),
        emoji: "💻",
        demoUrl: draft.link || "",
        codeUrl: "",
        imageBase64: null,
      });
    }
  }

  return data;
}

function extractHeader(section: ResumeSection, intro: IntroSection) {
  const headerLine = section.lines.find((l) => l.kind === "header");
  if (headerLine) {
    intro.name = headerLine.text || "";
  }
  for (const line of section.lines) {
    if (line.kind === "header") continue;
    const text = line.text || "";
    if (text.includes("@") && text.includes(".")) {
      intro.socialLinks.push({ platform: "email", url: `mailto:${text.trim()}` });
    } else if (text.includes("github.com")) {
      intro.socialLinks.push({ platform: "github", url: text.trim() });
    } else if (text.includes("linkedin.com")) {
      intro.socialLinks.push({ platform: "linkedin", url: text.trim() });
    }
    if (!intro.description && text.length > 30) {
      intro.description = text;
    }
  }
}

function extractEducation(section: ResumeSection, edu: EducationSection) {
  let current: Partial<EducationEntry> | null = null;
  for (const line of section.lines) {
    if (line.kind === "subheading") {
      if (current?.degree) edu.entries.push(current as EducationEntry);
      current = {
        degree: line.text || "",
        institution: line.secondaryText || "",
        period: line.rightText || "",
        description: "",
      };
    } else if (current && line.kind === "bullet") {
      current.description = (current.description || "") + (line.text || "") + " ";
    }
  }
  if (current?.degree) edu.entries.push(current as EducationEntry);
}

function extractSkills(section: ResumeSection, edu: EducationSection) {
  for (const line of section.lines) {
    const text = line.text || "";
    const colonIdx = text.indexOf(":");
    if (colonIdx > 0) {
      const name = text.slice(0, colonIdx).trim();
      const skills = text.slice(colonIdx + 1).split(",").map((s) => s.trim()).filter(Boolean);
      if (skills.length > 0) {
        edu.skills.push({ name, skills });
      }
    }
  }
}

function extractExperience(section: ResumeSection, exp: ExperienceSection) {
  let current: Partial<ExperienceEntry> | null = null;
  for (const line of section.lines) {
    if (line.kind === "subheading") {
      if (current?.role) exp.entries.push(current as ExperienceEntry);
      current = {
        role: line.text || "",
        company: line.secondaryText || "",
        period: line.rightText || "",
        techStack: [],
        achievements: [],
        companyLogoBase64: null,
      };
    } else if (current && line.kind === "bullet") {
      current.achievements = current.achievements || [];
      current.achievements.push(line.text || "");
    }
  }
  if (current?.role) exp.entries.push(current as ExperienceEntry);
}

function extractProjects(section: ResumeSection, proj: ProjectsSection) {
  let current: Partial<ProjectEntry> | null = null;
  for (const line of section.lines) {
    if (line.kind === "projectHeading" || line.kind === "subheading") {
      if (current?.name) proj.entries.push(current as ProjectEntry);
      current = {
        name: line.text || "",
        description: "",
        period: line.rightText || "",
        techStack: [],
        emoji: "💻",
        demoUrl: "",
        codeUrl: "",
        imageBase64: null,
      };
    } else if (current && line.kind === "bullet") {
      current.description = (current.description || "") + (line.text || "") + " ";
    } else if (current && line.text) {
      const text = line.text;
      if (text.includes(",") && text.split(",").length >= 2 && !text.includes(".")) {
        current.techStack = text.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (!current.description) {
        current.description = text + " ";
      }
    } else if (!current && line.text && line.text.trim().length > 0) {
      current = {
        name: line.text,
        description: "",
        period: line.rightText || "",
        techStack: [],
        emoji: "💻",
        demoUrl: "",
        codeUrl: "",
        imageBase64: null,
      };
    }
  }
  if (current?.name) proj.entries.push(current as ProjectEntry);
}

function extractAchievements(section: ResumeSection, ach: AchievementsSection) {
  for (const line of section.lines) {
    if (line.kind === "bullet" || line.kind === "subheading") {
      ach.entries.push({
        title: line.text || "",
        metric: line.rightText || "",
        emoji: "🏆",
        imageBase64: null,
      });
    }
  }
}

export function portfolioToStorage(data: PortfolioData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function portfolioFromStorage(): PortfolioData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioData;
    const defaults = createDefaultPortfolioData();
    parsed.intro = { ...defaults.intro, ...parsed.intro };
    parsed.github = { ...defaults.github, ...parsed.github };
    parsed.leetcode = { ...defaults.leetcode, ...parsed.leetcode };
    parsed.education = { ...defaults.education, ...parsed.education };
    parsed.experience = { ...defaults.experience, ...parsed.experience };
    parsed.projects = { ...defaults.projects, ...parsed.projects };
    parsed.achievements = { ...defaults.achievements, ...parsed.achievements };
    return parsed;
  } catch {
    return null;
  }
}

export function generatePortfolioHtml(data: PortfolioData, templateHtml: string): string {
  if (!templateHtml) return "";
  const headEnd = templateHtml.indexOf("</head>");
  if (headEnd === -1) return templateHtml;
  const headSection = templateHtml.slice(0, headEnd + 7);

  return `${headSection}
<body class="min-h-screen">
${buildNavHtml()}
${buildIntroStyleHtml()}
${buildIntroHtml(data)}
${buildGithubLeetcodeScript(data)}
${buildEducationHtml(data.education)}
${buildExperienceHtml(data.experience)}
${buildProjectsHtml(data.projects)}
${buildAchievementsHtml(data.achievements)}
${buildFooterScripts()}
</body>
</html>`;
}

function buildNavHtml(): string {
  return `<nav id="navbar" class="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto z-50">
<div class="bg-surface border-t md:border-t-0 md:border-b border-border flex items-center justify-center md:justify-start px-4 md:px-10 h-16 md:h-16 gap-1 md:gap-2">
<a href="#intro" class="hidden md:flex items-center gap-2 mr-auto font-body font-bold text-accent text-lg tracking-tight">
<span class="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-bg text-xs font-black">P</span>Portfolio</a>
<button onclick="scrollToSection('intro')" class="nav-btn active rounded-lg px-3 py-2 text-xs md:text-sm font-semibold flex flex-col md:flex-row items-center gap-1 md:gap-2 text-bg" data-section="intro">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
<span class="hidden md:inline">Home</span></button>
<button onclick="scrollToSection('education')" class="nav-btn rounded-lg px-3 py-2 text-xs md:text-sm font-semibold flex flex-col md:flex-row items-center gap-1 md:gap-2 text-muted" data-section="education">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6-3.5l6 3.5 6-3.5"/></svg>
<span class="hidden md:inline">Education</span></button>
<button onclick="scrollToSection('experience')" class="nav-btn rounded-lg px-3 py-2 text-xs md:text-sm font-semibold flex flex-col md:flex-row items-center gap-1 md:gap-2 text-muted" data-section="experience">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
<span class="hidden md:inline">Experience</span></button>
<button onclick="scrollToSection('projects')" class="nav-btn rounded-lg px-3 py-2 text-xs md:text-sm font-semibold flex flex-col md:flex-row items-center gap-1 md:gap-2 text-muted" data-section="projects">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
<span class="hidden md:inline">Projects</span></button>
<button onclick="scrollToSection('achievements')" class="nav-btn rounded-lg px-3 py-2 text-xs md:text-sm font-semibold flex flex-col md:flex-row items-center gap-1 md:gap-2 text-muted" data-section="achievements">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
<span class="hidden md:inline">Achievements</span></button>
</div></nav>`;
}

function buildIntroStyleHtml(): string {
  return `<style>
.gh-cell{width:11px;height:11px;border-radius:2px;display:inline-block;flex-shrink:0;transition:transform .15s,opacity .15s;cursor:default}
.gh-cell:hover{transform:scale(1.4);opacity:.9}
.gh-0{background:#0f2818}.gh-1{background:#0e4429}.gh-2{background:#006d32}.gh-3{background:#26a641}.gh-4{background:#39d353}
.lc-ring-track{stroke:#1e3c32}.lc-ring-fill{stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)}
.stat-pill{display:flex;align-items:center;gap:6px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.18);border-radius:999px;padding:4px 12px 4px 8px;font-size:12px;color:#7db89a}
.stat-pill strong{color:#f5faf5;font-size:13px}
.badge-easy{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.25)}
.badge-medium{background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.25)}
.badge-hard{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.25)}
.diff-bar-track{background:#1a3428;border-radius:4px;overflow:hidden;height:5px;flex:1}
.diff-bar-fill{height:100%;border-radius:4px;transition:width 1.2s cubic-bezier(.4,0,.2,1);width:0}
</style>`;
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildIntroHtml(data: PortfolioData): string {
  const { intro, github } = data;
  const profileImg = intro.profileImageBase64
    ? intro.profileImageBase64
    : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop";

  const socialLinksHtml = intro.socialLinks.map((link) => {
    const icons: Record<string, string> = {
      github: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,
      linkedin: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
      twitter: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      email: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
      leetcode: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13.483 0a1.374 1.374 0 00-.961.438L7.116 6.226l-3.854 4.126a1.381 1.381 0 00.1 1.95l3.854 3.593 5.406 5.788a1.374 1.374 0 001.945-.085l.085-.1-.085.1a1.374 1.374 0 00-.085-1.86l-5.32-5.694-3.16-2.944 3.16-3.384 5.32-5.694a1.374 1.374 0 00-.999-2.022zM20.798 14.182H8.728a1.374 1.374 0 000 2.748h12.07a1.374 1.374 0 000-2.748z"/></svg>`,
      website: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>`,
    };
    const icon = icons[link.platform] || icons.website;
    return `<a href="${esc(link.url)}" target="_blank" rel="noopener" class="tooltip p-3 rounded-full border border-border hover:border-accent hover:bg-accent/10 hover:text-accent transition-all duration-300 text-muted">${icon}<span>${esc(link.platform)}</span></a>`;
  }).join("\n");

  const headlineParts = intro.headline.split(/\s+/);
  const lastWord = headlineParts.pop() || "";
  const firstWords = headlineParts.join(" ");

  return `<section id="intro" class="min-h-screen flex items-start justify-center px-4 sm:px-8 lg:px-16 pt-20 md:pt-24 pb-24 md:pb-10 relative overflow-hidden">
<div class="glow-blob w-96 h-96 top-10 -left-20 opacity-60"></div>
<div class="glow-blob w-64 h-64 bottom-20 right-10 opacity-40"></div>
<div class="max-w-7xl w-full">
<div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-10 lg:mb-12">
<div class="flex flex-col space-y-6 order-2 lg:order-1">
<div class="flex items-center gap-2.5 w-fit bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5">
<span class="w-2 h-2 bg-accent rounded-full animate-pulse-slow"></span>
<span class="text-xs font-semibold text-accent tracking-wide">${esc(intro.availabilityTag || "Available for opportunities")}</span>
</div>
<h1 class="text-5xl sm:text-6xl lg:text-7xl font-body font-extrabold leading-[1.05] text-fg">
${esc(firstWords)} <span class="block text-accent mt-1">${esc(lastWord)}</span></h1>
<p class="text-muted text-base lg:text-lg leading-relaxed max-w-md">${esc(intro.description)}</p>
<div class="flex flex-wrap gap-2 pt-1">
<div class="stat-pill"><svg class="w-3.5 h-3.5 text-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg><strong>${esc(String(github.contributions))}</strong> contributions</div>
<div class="stat-pill"><svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg><strong>${esc(String(github.repos))}</strong> repos</div>
<div class="stat-pill"><svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg><strong>${esc(String(github.stars))}</strong> stars</div>
</div>
<div class="flex flex-col sm:flex-row gap-3">
<a href="#projects" onclick="scrollToSection('projects'); return false;" class="inline-flex items-center justify-center gap-2 px-8 py-3 bg-accent text-bg font-bold font-body rounded-full hover:bg-accent-dim transition-all duration-300 text-sm">View Projects <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></a>
${intro.resumeLink ? `<a href="${esc(intro.resumeLink)}" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-accent text-accent font-bold font-body rounded-full hover:bg-accent/10 transition-all duration-300 text-sm"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Resume</a>` : `<a href="#education" onclick="scrollToSection('education'); return false;" class="inline-flex items-center justify-center px-8 py-3 border-2 border-accent text-accent font-bold font-body rounded-full hover:bg-accent/10 transition-all duration-300 text-sm">About Me</a>`}
</div>
</div>
<div class="flex flex-col items-center order-1 lg:order-2">
<div class="relative w-full max-w-xs sm:max-w-sm">
<div class="absolute inset-0 bg-gradient-to-br from-accent/30 to-accent/5 rounded-3xl blur-3xl opacity-50 animate-float"></div>
<div class="relative rounded-2xl overflow-hidden border-2 border-accent/30 aspect-square shadow-2xl shadow-accent/10">
<img src="${esc(profileImg)}" alt="Profile" class="w-full h-full object-cover" loading="eager"/>
<div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg/60 to-transparent"></div>
</div>
<div class="flex justify-center gap-3 mt-5 flex-wrap">${socialLinksHtml}</div>
</div>
</div>
</div>
${buildGithubLeetcodeCards(data)}
</div>
</section>`;
}

function buildGithubLeetcodeCards(data: PortfolioData): string {
  const { github, leetcode } = data;
  const easyPct = leetcode.easy.total > 0 ? ((leetcode.easy.solved / leetcode.easy.total) * 100).toFixed(1) : "0";
  const medPct = leetcode.medium.total > 0 ? ((leetcode.medium.solved / leetcode.medium.total) * 100).toFixed(1) : "0";
  const hardPct = leetcode.hard.total > 0 ? ((leetcode.hard.solved / leetcode.hard.total) * 100).toFixed(1) : "0";

  return `<div class="grid grid-cols-1 lg:grid-cols-5 gap-5 pb-2">
<div class="lg:col-span-3 bg-surface border border-border rounded-2xl p-5 sm:p-6">
<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
<div class="flex items-center gap-2.5">
<div class="p-2 bg-accent/10 rounded-lg border border-accent/15"><svg class="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg></div>
<div><p class="text-sm font-body font-bold text-fg">GitHub Activity</p>
<p class="text-xs text-muted">${esc(String(github.contributions))} contributions in the last year</p></div>
</div>
<div class="flex items-center gap-1.5 text-xs text-muted"><span>Less</span><span class="gh-cell gh-0" style="width:9px;height:9px"></span><span class="gh-cell gh-1" style="width:9px;height:9px"></span><span class="gh-cell gh-2" style="width:9px;height:9px"></span><span class="gh-cell gh-3" style="width:9px;height:9px"></span><span class="gh-cell gh-4" style="width:9px;height:9px"></span><span>More</span></div>
</div>
<div class="flex gap-1 mb-1 pl-0 overflow-x-auto pb-1" id="gh-months" style="font-size:10px;color:#7db89a;"></div>
<div class="overflow-x-auto"><div id="gh-graph" class="flex gap-1" style="min-width:max-content;"></div></div>
</div>
<div class="lg:col-span-2 bg-surface border border-border rounded-2xl p-5 sm:p-6 flex flex-col">
<div class="flex items-center gap-2.5 mb-5">
<div class="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M13.5 3L7 10.5H13L10.5 21L17 13.5H11L13.5 3Z" fill="#facc15"/></svg></div>
<div><p class="text-sm font-body font-bold text-fg">LeetCode</p><p class="text-xs text-muted">Problem solving stats</p></div>
</div>
<div class="flex items-center gap-6 mb-5">
<div class="relative flex-shrink-0" style="width:90px;height:90px;">
<svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg)">
<circle cx="45" cy="45" r="38" fill="none" stroke-width="7" class="lc-ring-track"/>
<circle cx="45" cy="45" r="38" fill="none" stroke-width="7" stroke="#4ade80" style="stroke-dasharray:238.76;stroke-dashoffset:0;stroke-linecap:round;" class="lc-ring-fill" id="lc-easy-arc"/>
<circle cx="45" cy="45" r="38" fill="none" stroke-width="7" stroke="#facc15" style="stroke-dasharray:238.76;stroke-dashoffset:0;stroke-linecap:round;" class="lc-ring-fill" id="lc-medium-arc"/>
<circle cx="45" cy="45" r="38" fill="none" stroke-width="7" stroke="#f87171" style="stroke-dasharray:238.76;stroke-dashoffset:0;stroke-linecap:round;" class="lc-ring-fill" id="lc-hard-arc"/>
</svg>
<div class="absolute inset-0 flex flex-col items-center justify-center">
<span class="text-xl font-body font-extrabold text-fg">${leetcode.totalSolved}</span>
<span class="text-xs text-muted" style="margin-top:-2px">solved</span>
</div>
</div>
<div class="flex flex-col gap-2 flex-1">
<div><div class="flex items-center justify-between mb-1"><span class="badge-easy text-xs font-semibold px-2 py-0.5 rounded-full">Easy</span><span class="text-xs font-bold text-fg">${leetcode.easy.solved} <span class="text-muted font-normal">/ ${leetcode.easy.total}</span></span></div><div class="diff-bar-track"><div class="diff-bar-fill" style="background:#4ade80;" data-width="${easyPct}" id="bar-easy"></div></div></div>
<div><div class="flex items-center justify-between mb-1"><span class="badge-medium text-xs font-semibold px-2 py-0.5 rounded-full">Medium</span><span class="text-xs font-bold text-fg">${leetcode.medium.solved} <span class="text-muted font-normal">/ ${leetcode.medium.total}</span></span></div><div class="diff-bar-track"><div class="diff-bar-fill" style="background:#facc15;" data-width="${medPct}" id="bar-medium"></div></div></div>
<div><div class="flex items-center justify-between mb-1"><span class="badge-hard text-xs font-semibold px-2 py-0.5 rounded-full">Hard</span><span class="text-xs font-bold text-fg">${leetcode.hard.solved} <span class="text-muted font-normal">/ ${leetcode.hard.total}</span></span></div><div class="diff-bar-track"><div class="diff-bar-fill" style="background:#f87171;" data-width="${hardPct}" id="bar-hard"></div></div></div>
</div>
</div>
<div class="grid grid-cols-3 gap-2 mt-auto">
<div class="bg-card border border-border rounded-xl p-3 text-center"><p class="text-lg font-body font-extrabold text-fg">${leetcode.ranking > 0 ? leetcode.ranking.toLocaleString() : "-"}</p><p class="text-xs text-muted mt-0.5">Ranking</p></div>
<div class="bg-card border border-border rounded-xl p-3 text-center"><p class="text-lg font-body font-extrabold text-accent">${leetcode.streak || 0}</p><p class="text-xs text-muted mt-0.5">Streak</p></div>
<div class="bg-card border border-border rounded-xl p-3 text-center"><p class="text-lg font-body font-extrabold text-fg">${esc(leetcode.globalPercentile)}</p><p class="text-xs text-muted mt-0.5">Global</p></div>
</div>
</div>
</div>`;
}

function buildGithubLeetcodeScript(data: PortfolioData): string {
  const { leetcode, github } = data;
  const calendarJson = JSON.stringify(github.contributionCalendar || []);
  return `<script>
(function buildGithubGraph(){var WEEKS=52,DAYS=7,months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];var calendarData=${calendarJson};var calendarMap={};calendarData.forEach(function(d){calendarMap[d.date]=d.count});function getLevel(count){if(count<=0)return 0;if(count<=3)return 1;if(count<=6)return 2;if(count<=9)return 3;return 4}function seededRand(s){s=Math.sin(s)*10000;return s-Math.floor(s)}var useReal=calendarData.length>0;var graphEl=document.getElementById('gh-graph'),monthsEl=document.getElementById('gh-months');if(!graphEl)return;var today=new Date(),startDate=new Date(today);startDate.setDate(today.getDate()-WEEKS*7+1);var lastMonth=-1,monthSpans=[];for(var w=0;w<WEEKS;w++){var col=document.createElement('div');col.style.cssText='display:flex;flex-direction:column;gap:3px;';var monthLabel='';for(var d=0;d<DAYS;d++){var cellDate=new Date(startDate);cellDate.setDate(startDate.getDate()+w*7+d);var isFuture=cellDate>today;var cell=document.createElement('span');cell.className='gh-cell';if(isFuture){cell.classList.add('gh-0')}else if(useReal){var key=cellDate.toISOString().slice(0,10);var cnt=calendarMap[key]||0;cell.classList.add('gh-'+getLevel(cnt));cell.title=cellDate.toDateString()+': '+cnt+' contributions'}else{var r=seededRand(w*7+d+42);var level=r<0.45?0:r<0.65?1:r<0.80?2:r<0.92?3:4;cell.classList.add('gh-'+level);cell.title=cellDate.toDateString()}var mo=cellDate.getMonth();if(d===0&&mo!==lastMonth){monthLabel=months[mo];lastMonth=mo}col.appendChild(cell)}monthSpans.push(monthLabel);graphEl.appendChild(col)}monthSpans.forEach(function(m){var sp=document.createElement('span');sp.textContent=m;sp.style.cssText='min-width:11px;display:inline-block;text-align:left;';if(!m)sp.style.opacity='0';monthsEl.appendChild(sp)})})();
(function animateLeetcode(){var C=2*Math.PI*38;var easy={solved:${leetcode.easy.solved},total:${leetcode.easy.total}};var medium={solved:${leetcode.medium.solved},total:${leetcode.medium.total}};var hard={solved:${leetcode.hard.solved},total:${leetcode.hard.total}};var grand=easy.solved+medium.solved+hard.solved;if(grand===0)return;var eF=easy.solved/grand,mF=medium.solved/grand;var easyArc=document.getElementById('lc-easy-arc'),mediumArc=document.getElementById('lc-medium-arc'),hardArc=document.getElementById('lc-hard-arc');setTimeout(function(){if(easyArc)easyArc.style.strokeDashoffset=C*(1-eF);if(mediumArc){mediumArc.style.strokeDasharray=C;mediumArc.style.strokeDashoffset=C*(1-mF)+eF*C}if(hardArc){hardArc.style.strokeDasharray=C;hardArc.style.strokeDashoffset=C*(1-hard.solved/grand)+(eF+mF)*C}},400);setTimeout(function(){['easy','medium','hard'].forEach(function(d){var bar=document.getElementById('bar-'+d);if(bar)bar.style.width=bar.dataset.width+'%'})},500)})();
</script>`;
}

function buildEducationHtml(edu: EducationSection): string {
  const educationEntries = edu.entries.map((e) => `
<div class="pb-5 border-b border-border last:border-0 last:pb-0">
<h4 class="font-semibold text-fg text-sm mb-1">${esc(e.degree)}</h4>
<p class="text-accent text-xs font-semibold mb-1">${esc(e.institution)}</p>
<p class="text-muted text-xs mb-2">${esc(e.period)}</p>
<p class="text-muted text-xs leading-relaxed">${esc(e.description)}</p>
</div>`).join("");

  const skillsHtml = edu.skills.map((cat) => `
<div>
<h4 class="font-semibold text-fg text-xs uppercase tracking-wider mb-2.5">${esc(cat.name)}</h4>
<div class="flex flex-wrap gap-2">
${cat.skills.map((s) => `<span class="skill-badge px-3 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full border border-accent/20">${esc(s)}</span>`).join("")}
</div>
</div>`).join("");

  const certsHtml = edu.certificates.map((c) => `
<div class="card-hover p-4 bg-card border border-border rounded-xl flex items-start justify-between gap-2">
<div><h4 class="font-semibold text-fg text-sm leading-tight">${esc(c.title)}</h4><p class="text-muted text-xs mt-1">${esc(c.provider)}</p></div>
<span class="text-accent text-xs font-bold flex-shrink-0">${esc(c.year)}</span>
</div>`).join("");

  return `<section id="education" class="py-20 px-4 sm:px-8 lg:px-16">
<div class="max-w-7xl mx-auto">
<div class="text-center mb-14 reveal"><h2 class="text-4xl sm:text-5xl font-body font-extrabold text-fg mb-3">Education & Skills</h2><div class="w-16 h-1 bg-accent mx-auto rounded-full mb-4"></div><p class="text-muted text-sm sm:text-base max-w-xl mx-auto">My academic journey and professional expertise</p></div>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
<div class="reveal space-y-5">
<div class="flex items-center gap-3 mb-6"><div class="p-2.5 bg-accent/10 border border-accent/20 rounded-xl"><svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6-3.5l6 3.5 6-3.5"/></svg></div><h3 class="text-lg font-body font-bold text-fg">Education</h3></div>
<div class="space-y-0">${educationEntries}</div>
</div>
<div class="reveal space-y-5" style="animation-delay:0.1s">
<div class="flex items-center gap-3 mb-6"><div class="p-2.5 bg-accent/10 border border-accent/20 rounded-xl"><svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><h3 class="text-lg font-body font-bold text-fg">Skills</h3></div>
<div class="space-y-4">${skillsHtml}</div>
</div>
<div class="reveal space-y-4" style="animation-delay:0.2s">
<div class="flex items-center gap-3 mb-6"><div class="p-2.5 bg-accent/10 border border-accent/20 rounded-xl"><svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg></div><h3 class="text-lg font-body font-bold text-fg">Certificates & Courses</h3></div>
<div class="space-y-3">${certsHtml}</div>
</div>
</div>
</div>
</section>`;
}

function buildExperienceHtml(exp: ExperienceSection): string {
  const emojis = ["🚀", "🎨", "💻", "⚡", "🔥", "🎯"];
  const entries = exp.entries.map((e, i) => {
    const emoji = emojis[i % emojis.length];
    const side = i % 2 === 0
      ? "ml-14 md:ml-0 md:w-[47%] md:mr-auto md:pr-10"
      : "ml-14 md:ml-auto md:w-[47%] md:pl-10";
    const techHtml = e.techStack.map((t) => `<span class="skill-badge px-2.5 py-0.5 bg-accent/10 text-accent text-xs rounded-full border border-accent/20">${esc(t)}</span>`).join("");
    const achieveHtml = e.achievements.map((a) => `<li class="flex gap-2 text-muted text-xs"><span class="text-accent mt-0.5 flex-shrink-0">✓</span> ${esc(a)}</li>`).join("");
    const logoHtml = e.companyLogoBase64
      ? `<img src="${e.companyLogoBase64}" alt="${esc(e.company)}" class="w-10 h-10 rounded-lg object-cover"/>`
      : `<span class="text-3xl">${emoji}</span>`;

    return `<div class="relative reveal">
<div class="absolute left-0 md:left-1/2 top-7 -translate-x-[4px] md:-translate-x-1/2 w-9 h-9 bg-bg border-4 border-accent rounded-full flex items-center justify-center z-10"><div class="w-2.5 h-2.5 bg-accent rounded-full"></div></div>
<div class="${side}">
<div class="card-hover bg-card border border-border rounded-2xl p-5 sm:p-6">
<div class="flex items-center gap-3 mb-3">${logoHtml}<div><h3 class="text-base sm:text-lg font-body font-bold text-fg">${esc(e.role)}</h3><p class="text-accent text-xs font-semibold">${esc(e.company)}</p></div></div>
<p class="text-muted text-xs font-medium mb-3">${esc(e.period)}</p>
${e.techStack.length > 0 ? `<div class="mb-4"><p class="text-xs font-bold text-fg mb-2 uppercase tracking-wider">Tech Stack</p><div class="flex flex-wrap gap-1.5">${techHtml}</div></div>` : ""}
${e.achievements.length > 0 ? `<div><p class="text-xs font-bold text-fg mb-2 uppercase tracking-wider">Key Achievements</p><ul class="space-y-1.5">${achieveHtml}</ul></div>` : ""}
</div>
</div>
</div>`;
  }).join("");

  return `<section id="experience" class="py-20 px-4 sm:px-8 lg:px-16">
<div class="max-w-5xl mx-auto">
<div class="text-center mb-14 reveal"><h2 class="text-4xl sm:text-5xl font-body font-extrabold text-fg mb-3">Experience</h2><div class="w-16 h-1 bg-accent mx-auto rounded-full mb-4"></div><p class="text-muted text-sm sm:text-base">My professional journey and key achievements</p></div>
<div class="relative timeline-line" id="timelineWrap"><div id="timeline-progress"></div><div class="space-y-10 md:space-y-14">${entries}</div></div>
</div>
</section>`;
}

function buildProjectsHtml(proj: ProjectsSection): string {
  const gradients = [
    "linear-gradient(135deg,#22c55e 0%,#15803d 60%,#064e3b 100%)",
    "linear-gradient(135deg,#16a34a,#064e3b)",
    "linear-gradient(135deg,#0ea5e9,#0369a1)",
    "linear-gradient(135deg,#8b5cf6,#6d28d9)",
    "linear-gradient(135deg,#f59e0b,#d97706)",
    "linear-gradient(135deg,#ef4444,#b91c1c)",
  ];

  function renderProjectCard(p: ProjectEntry, i: number) {
    const grad = gradients[i % gradients.length];
    const imgHtml = p.imageBase64
      ? `<img src="${p.imageBase64}" alt="${esc(p.name)}" class="w-full h-full object-cover"/>`
      : p.emoji || "💻";
    const techHtml = p.techStack.map((t) => `<span class="px-2 py-0.5 bg-surface text-muted text-xs rounded hover:bg-accent hover:text-bg transition-colors cursor-default">${esc(t)}</span>`).join("");

    return `<div class="card-hover bg-card border border-border rounded-2xl overflow-hidden flex flex-col group">
<div class="h-36 flex items-center justify-center text-5xl group-hover:scale-105 transition-transform duration-500 relative overflow-hidden" style="background:${grad}">${p.imageBase64 ? imgHtml : esc(p.emoji || "💻")}<div class="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div></div>
<div class="p-6 flex flex-col flex-1">
<h3 class="text-lg font-body font-bold text-fg mb-1.5">${esc(p.name)}</h3>
<p class="text-muted text-sm leading-relaxed mb-3 line-clamp-3">${esc(p.description)}</p>
${p.period ? `<div class="flex items-center gap-1.5 text-muted text-xs mb-4"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${esc(p.period)}</div>` : ""}
<div class="flex flex-wrap gap-1.5 mb-6">${techHtml}</div>
<div class="flex gap-2 mt-auto">
${p.demoUrl ? `<a href="${esc(p.demoUrl)}" target="_blank" class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent hover:bg-accent-dim text-bg text-sm font-bold rounded-lg transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>Demo</a>` : ""}
${p.codeUrl ? `<a href="${esc(p.codeUrl)}" target="_blank" class="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-surface text-fg text-sm font-bold rounded-lg transition-colors"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>Code</a>` : ""}
</div>
</div>
</div>`;
  }

  const visibleEntries = proj.entries.slice(0, 6).map(renderProjectCard).join("");
  const hiddenEntries = proj.entries.slice(6).map((p, i) => renderProjectCard(p, i + 6)).join("");
  const hasMore = proj.entries.length > 6;

  const toggleBtn = hasMore ? `<div class="text-center mt-8">
<button id="toggle-projects-btn" onclick="toggleProjects()" class="inline-flex items-center gap-2 px-6 py-2.5 border border-accent text-accent font-bold rounded-full hover:bg-accent/10 transition-colors text-sm">
<span>View More Projects</span>
<svg class="w-4 h-4 transition-transform" id="toggle-projects-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
</button>
</div>` : "";

  const extraGrid = hasMore ? `<div id="extra-projects" class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6" style="display:none">${hiddenEntries}</div>` : "";

  return `<section id="projects" class="py-20 px-4 sm:px-8 lg:px-16">
<div class="max-w-6xl mx-auto">
<div class="mb-10 reveal"><h2 class="text-4xl sm:text-5xl font-body font-extrabold text-fg mb-3">Featured Projects</h2><div class="h-1 w-16 bg-accent rounded-full"></div></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 reveal" style="transition-delay:0.15s">${visibleEntries}</div>
${extraGrid}
${toggleBtn}
</div>
</section>`;
}

function buildAchievementsHtml(ach: AchievementsSection): string {
  const emojis = ["🏆", "⭐", "🎤", "⚡", "👨‍💼", "🎯", "📚", "🌱"];
  const entries = ach.entries.map((a, i) => {
    const emoji = a.emoji || emojis[i % emojis.length];
    return `<div class="card-hover bg-card border border-border rounded-2xl p-5 group">
<div class="flex items-start gap-4">
<div class="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">${emoji}</div>
<div class="flex-1 min-w-0">
<h3 class="text-base font-body font-bold text-fg mb-1.5 group-hover:text-accent transition-colors">${esc(a.title)}</h3>
<div class="flex items-center justify-between gap-2">
<p class="text-accent text-sm font-bold">${esc(a.metric)}</p>
</div>
</div>
</div>
</div>`;
  }).join("");

  return `<section id="achievements" class="py-20 px-4 sm:px-8 lg:px-16 pb-32 md:pb-20">
<div class="max-w-6xl mx-auto">
<div class="mb-10 reveal"><h2 class="text-4xl sm:text-5xl font-body font-extrabold text-fg mb-3">Achievements & Recognition</h2><div class="h-1 w-16 bg-accent rounded-full"></div></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-5 reveal" style="transition-delay:0.15s">${entries}</div>
</div>
</section>`;
}

function buildFooterScripts(): string {
  return `<script>
function scrollToSection(id){var el=document.getElementById(id);if(!el)return;el.scrollIntoView({behavior:'smooth'});setActive(id)}
function setActive(id){document.querySelectorAll('.nav-btn').forEach(function(btn){var isActive=btn.dataset.section===id;btn.classList.toggle('active',isActive);btn.classList.toggle('text-bg',isActive);btn.classList.toggle('text-muted',!isActive)})}
var sections=['intro','education','experience','projects','achievements'];
var observer=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)setActive(e.target.id)})},{threshold:0.3});
sections.forEach(function(id){var el=document.getElementById(id);if(el)observer.observe(el)});
var timelineWrap=document.getElementById('timelineWrap'),progressBar=document.getElementById('timeline-progress');
function updateTimeline(){if(!timelineWrap||!progressBar)return;var rect=timelineWrap.getBoundingClientRect(),winH=window.innerHeight,start=rect.top-winH,end=rect.bottom-winH*0.4,total=end-start,scrolled=-start,pct=Math.max(0,Math.min(100,(scrolled/total)*100));progressBar.style.height=pct+'%';requestAnimationFrame(updateTimeline)}
requestAnimationFrame(updateTimeline);
var revealObserver=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:0.12});
document.querySelectorAll('.reveal').forEach(function(el){revealObserver.observe(el)});
setTimeout(function(){document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('visible')})},800);
function toggleProjects(){var extra=document.getElementById('extra-projects'),btn=document.getElementById('toggle-projects-btn'),icon=document.getElementById('toggle-projects-icon');if(!extra||!btn)return;if(extra.style.display==='none'){extra.style.display='grid';btn.querySelector('span').textContent='Show Less';if(icon)icon.style.transform='rotate(180deg)'}else{extra.style.display='none';btn.querySelector('span').textContent='View More Projects';if(icon)icon.style.transform=''}}
</script>`;
}
