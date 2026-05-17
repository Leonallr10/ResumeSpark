export interface SocialLink {
  platform: "github" | "linkedin" | "twitter" | "email" | "website" | "leetcode";
  url: string;
}

export interface IntroSection {
  name: string;
  headline: string;
  description: string;
  availabilityTag: string;
  profileImageBase64: string | null;
  socialLinks: SocialLink[];
  resumeLink: string;
}

export interface GitHubContributionDay {
  date: string;
  count: number;
}

export interface GitHubSection {
  username: string;
  contributions: number;
  repos: number;
  stars: string;
  contributionCalendar?: GitHubContributionDay[];
}

export interface LeetCodeSection {
  username: string;
  totalSolved: number;
  easy: { solved: number; total: number };
  medium: { solved: number; total: number };
  hard: { solved: number; total: number };
  ranking: number;
  streak: number;
  globalPercentile: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  description: string;
}

export interface SkillCategory {
  name: string;
  skills: string[];
}

export interface CertificateEntry {
  title: string;
  provider: string;
  year: string;
}

export interface EducationSection {
  entries: EducationEntry[];
  skills: SkillCategory[];
  certificates: CertificateEntry[];
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  techStack: string[];
  achievements: string[];
  companyLogoBase64: string | null;
}

export interface ExperienceSection {
  entries: ExperienceEntry[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  period: string;
  techStack: string[];
  emoji: string;
  demoUrl: string;
  codeUrl: string;
  imageBase64: string | null;
}

export interface ProjectsSection {
  entries: ProjectEntry[];
}

export interface AchievementEntry {
  title: string;
  metric: string;
  emoji: string;
  imageBase64: string | null;
}

export interface AchievementsSection {
  entries: AchievementEntry[];
}

export interface PortfolioData {
  intro: IntroSection;
  github: GitHubSection;
  leetcode: LeetCodeSection;
  education: EducationSection;
  experience: ExperienceSection;
  projects: ProjectsSection;
  achievements: AchievementsSection;
}
