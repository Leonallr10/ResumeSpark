import { z } from "zod";

export const contactInfoSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  portfolio: z.string().default(""),
  website: z.string().default(""),
});

export type ContactInfo = z.infer<typeof contactInfoSchema>;

export const experienceEntrySchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  bullets: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
});

export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;

export const educationEntrySchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export type EducationEntry = z.infer<typeof educationEntrySchema>;

export const projectEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  link: z.string().default(""),
  technologies: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
});

export type ProjectEntry = z.infer<typeof projectEntrySchema>;

export const skillCategorySchema = z.object({
  id: z.string(),
  category: z.string(),
  skills: z.array(z.string()).default([]),
});

export type SkillCategory = z.infer<typeof skillCategorySchema>;

export const achievementEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().default(""),
  date: z.string().default(""),
  description: z.string().default(""),
});

export type AchievementEntry = z.infer<typeof achievementEntrySchema>;

export const customSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export type CustomSectionItem = z.infer<typeof customSectionItemSchema>;

export const customSectionSchema = z.object({
  id: z.string(),
  title: z.string().default("Custom Section"),
  items: z.array(customSectionItemSchema).default([]),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

export type CustomSection = z.infer<typeof customSectionSchema>;

export const sectionTitlesSchema = z.object({
  summary: z.string().default("Professional Summary"),
  experience: z.string().default("Work Experience"),
  education: z.string().default("Education"),
  skills: z.string().default("Skills"),
  projects: z.string().default("Projects"),
  achievements: z.string().default("Achievements and Activities"),
});

export type SectionTitles = z.infer<typeof sectionTitlesSchema>;

export const resumeDocumentModelSchema = z.object({
  version: z.string().default("1.0.0"),
  templateId: z.string().default("template-1"),
  personalInfo: contactInfoSchema,
  sectionTitles: sectionTitlesSchema.default({
    summary: "Professional Summary",
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    achievements: "Achievements and Activities",
  }),
  summary: z.string().default(""),
  experience: z.array(experienceEntrySchema).default([]),
  education: z.array(educationEntrySchema).default([]),
  projects: z.array(projectEntrySchema).default([]),
  skills: z.array(skillCategorySchema).default([]),
  achievements: z.array(achievementEntrySchema).default([]),
  customSections: z.array(customSectionSchema).default([]),
  metadata: z
    .object({
      targetRole: z.string().default(""),
      targetCompany: z.string().default(""),
      lastModified: z.string().default(() => new Date().toISOString()),
      lastFlow: z.enum(["latex", "pdf"]).default("pdf"),
    })
    .default({
      targetRole: "",
      targetCompany: "",
      lastModified: new Date().toISOString(),
      lastFlow: "pdf",
    }),
});

export type ResumeDocumentModel = z.infer<typeof resumeDocumentModelSchema>;

export function createEmptyResumeDocument(): ResumeDocumentModel {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    templateId: "template-1",
    personalInfo: {
      fullName: "Your Name",
      email: "your.email@example.com",
      phone: "+1 234 567 8900",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/yourname",
      github: "github.com/yourname",
      portfolio: "yourportfolio.dev",
      website: "",
    },
    sectionTitles: {
      summary: "Professional Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Skills",
      projects: "Projects",
      achievements: "Achievements and Activities",
    },
    summary: "Full-Stack and AI Engineer with expertise in building scalable, production-ready web applications, agentic workflows, and distributed backend systems.",
    experience: [
      {
        id: "exp-1",
        company: "Tech Innovations Inc.",
        role: "Software Engineer",
        location: "San Francisco, CA",
        startDate: "Aug 2024",
        endDate: "Present",
        bullets: [
          "Architected high-throughput REST and GraphQL APIs using Next.js and Node.js, reducing average query latency by 45%.",
          "Engineered an automated CI/CD deployment pipeline with Docker and AWS, cutting deploy times from 25 minutes to under 4 minutes.",
          "Integrated vector search indexing with FAISS and Pinecone for real-time document search across 100k+ customer records."
        ],
        technologies: ["TypeScript", "Next.js", "AWS", "Docker", "PostgreSQL"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of Technology",
        degree: "Bachelor of Science in Computer Science",
        field: "Computer Science",
        location: "California, USA",
        startDate: "2020",
        endDate: "2024",
        gpa: "3.85 / 4.0",
        bullets: ["Dean's Honor List", "President of Open Source Club"],
      },
    ],
    projects: [
      {
        id: "proj-1",
        title: "ResumeTailor AI",
        subtitle: "AI-Powered LaTeX & PDF Resume Builder",
        startDate: "Jan 2026",
        endDate: "Mar 2026",
        link: "https://github.com/yourname/resume-tailor",
        technologies: ["Next.js 15", "TypeScript", "Tailwind CSS", "Gemini API"],
        bullets: [
          "Built a modern resume editor featuring real-time ATS auditing, line-level AI tailoring, and bi-directional LaTeX sync.",
          "Deployed to Vercel with automated continuous delivery and sub-100ms client-side preview rendering."
        ],
      },
    ],
    skills: [
      {
        id: "skill-1",
        category: "Languages & Frameworks",
        skills: ["Python", "TypeScript", "JavaScript", "SQL", "React", "Next.js", "Node.js", "Tailwind CSS"],
      },
      {
        id: "skill-2",
        category: "AI / ML & Cloud",
        skills: ["LLMs", "LangChain", "RAG", "FAISS", "Pinecone", "AWS", "Docker", "Supabase", "PostgreSQL"],
      },
      {
        id: "skill-3",
        category: "Tools & DevOps",
        skills: ["Git", "GitHub Actions", "REST APIs", "GraphQL", "Jest", "Playwright", "Linux"],
      },
    ],
    achievements: [
      {
        id: "ach-1",
        title: "National Hackathon Winner",
        subtitle: "First Place amongst 250+ teams",
        date: "2024",
        description: "Built an AI-driven disaster response dispatch portal in 36 hours.",
      },
    ],
    customSections: [],
    metadata: {
      targetRole: "Full Stack Engineer",
      targetCompany: "Top Tech Corp",
      lastModified: now,
      lastFlow: "pdf",
    },
  };
}

export function createSampleResumeTemplate1(): ResumeDocumentModel {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    templateId: "template-1",
    personalInfo: {
      fullName: "LEONAL ROBIN",
      email: "leonalrobinlr10@gmail.com",
      phone: "+91 8248731433",
      location: "Bengaluru, Karnataka, India",
      linkedin: "linkedin.com/in/leonal-robin-47b681284",
      github: "github.com/Leonallr10",
      portfolio: "leonalrobin.vercel.app",
      website: "",
    },
    sectionTitles: {
      summary: "Professional Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Skills",
      projects: "Projects",
      achievements: "Achievements and Activities",
    },
    summary: "Full-Stack and AI Engineer with 1.5+ years designing and deploying agent systems and interactive web applications. Expertise in Python, TypeScript, React/Next.js, LLM integration, and vector search to build multi-step reasoning workflows and production-ready scalable solutions.",
    experience: [
      {
        id: "exp-1",
        company: "Flam",
        role: "Software R&D Developer Intern",
        location: "Bangalore, Karnataka, India",
        startDate: "Aug 2025",
        endDate: "Mar 2026",
        bullets: [
          "Built a browser-based video editor. Optimized GLB overlay animations by removing redundant mesh-level animations, making timeline playback and canvas rendering significantly smoother with Remotion and Three.js.",
          "Engineered AI function-calling workflows using Mastra and OpenAI, allowing users to trigger complex media operations via natural language commands and eliminating repetitive manual workflows.",
          "Simplified client AR campaign management by building a grouped QR system letting clients organize and access multiple AR experiences from a single QR workflow.",
        ],
        technologies: ["React", "Three.js", "Remotion", "Mastra", "OpenAI API"],
      },
      {
        id: "exp-2",
        company: "MANNIT",
        role: "Software Development Engineer Intern",
        location: "Chennai, Tamil Nadu, India",
        startDate: "Feb 2025",
        endDate: "Jul 2025",
        bullets: [
          "Identified Pinecone API quotas as a bottleneck; architected a hybrid FAISS indexing layer on high-GPU/CPU cloud platforms, cutting cloud vector search costs to near-zero and reducing query latency 3-5x for production LLM apps.",
          "Designed an admin-driven vector database pipeline with automatic category generation and dynamic user-specific data isolation, enabling real-time category updates scaling with data growth.",
          "Engineered a scalable codebase analysis system for 10,000+ file repositories via AST parsing, smart filtering, and batched async processing, eliminating sequential blocking calls.",
        ],
        technologies: ["Python", "FAISS", "Pinecone", "FastAPI", "AST Parsing"],
      },
      {
        id: "exp-3",
        company: "Telesto Energy",
        role: "Software Development Engineer Intern",
        location: "Coimbatore, Tamil Nadu, India",
        startDate: "Oct 2023",
        endDate: "May 2024",
        bullets: [
          "Built FastAPI and Django backends for real-time energy data ingestion; normalized MySQL schemas improving query performance across energy monitoring pipelines.",
          "Developed a landing page with a CSV-upload analysis tool that generates seismic data visualizations using Plotly.js on a Django backend.",
        ],
        technologies: ["FastAPI", "Django", "MySQL", "Plotly.js", "Python"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "Amrita Vishwa Vidyapeetham",
        degree: "Bachelor of Technology, Computer Science and Engineering",
        field: "Computer Science",
        location: "Coimbatore, India",
        startDate: "Sep 2021",
        endDate: "May 2025",
        gpa: "",
        bullets: [],
      },
    ],
    skills: [
      {
        id: "skill-1",
        category: "Languages & Frameworks",
        skills: ["Python", "JavaScript", "TypeScript", "SQL", "React.js", "Next.js", "Node.js", "Flask", "Three.js"],
      },
      {
        id: "skill-2",
        category: "AI / ML & Technologies",
        skills: ["LLMs", "LangChain", "RAG", "FAISS", "Pinecone", "OpenAI API", "Groq", "Agent Architectures", "Fine-tuning"],
      },
      {
        id: "skill-3",
        category: "Tools & Platforms",
        skills: ["REST APIs", "FastAPI", "BullMQ", "GraphQL", "JWT", "Prisma", "Tailwind CSS", "Zustand", "Playwright", "PostgreSQL", "MySQL", "Redis", "Supabase", "AWS", "Docker", "Git"],
      },
    ],
    projects: [
      {
        id: "proj-1",
        title: "Chess Insight -- AI Chess Coaching Platform",
        subtitle: "Production SaaS",
        startDate: "Feb 2026",
        endDate: "Sep 2026",
        link: "https://github.com/Leonallr10/chess-insight",
        technologies: ["Next.js", "TypeScript", "Stockfish", "Webhooks", "PostgreSQL"],
        bullets: [
          "Integrated Stockfish engine via webhooks for real-time move-by-move game analysis, providing coaches actionable visibility into tactical patterns and accuracy scores across Lichess and Chess.com game histories.",
          "Engineered interactive frontend and backend including game boards, puzzle game, analysis panels, and subscription billing, shipping a live SaaS product for coaches and academies.",
        ],
      },
      {
        id: "proj-2",
        title: "Hive -- YC-Backed AI Agent Runtime",
        subtitle: "Open Source Contributor",
        startDate: "Mar 2026",
        endDate: "Jun 2026",
        link: "https://github.com/aden-hive/hive",
        technologies: ["Python", "React", "LiteLLM", "Agent Architecture"],
        bullets: [
          "Contributed core agent orchestration features in Hive; added drag-and-drop file upload to the agent chat interface so LLMs can ingest structured and unstructured documents directly within live multi-agent workflows.",
        ],
      },
      {
        id: "proj-3",
        title: "ResumeTailor AI",
        subtitle: "AI LaTeX & PDF Resume Tailoring Platform",
        startDate: "Mar 2026",
        endDate: "May 2026",
        link: "https://resume-spark-lake.vercel.app/",
        technologies: ["Next.js", "CodeMirror 6", "PDF.js", "Gemini API", "Tailwind CSS"],
        bullets: [
          "Built an AI-powered resume editor integrating streaming text polishing, ATS audits, and tool-based function calling within a React/Next.js + CodeMirror 6 PDF.js canvas workflow.",
          "Deployed a production-ready full-stack system on Vercel with observability and automated one-click portfolio site generation from resume content.",
        ],
      },
    ],
    achievements: [
      {
        id: "ach-1",
        title: "NASA Space App Challenge",
        subtitle: "Seismic Data from Apollo and Mars InSight Missions",
        date: "Oct 2024",
        description: "",
      },
      {
        id: "ach-2",
        title: "Pragyan '23 -- National Winner",
        subtitle: "National Level Hackathon at NIT Trichy",
        date: "Mar 2023",
        description: "",
      },
      {
        id: "ach-3",
        title: "Crio.Do Certificate",
        subtitle: "Full Stack Development Program",
        date: "Sep 2026",
        description: "",
      },
    ],
    customSections: [],
    metadata: {
      targetRole: "Full Stack & AI Engineer",
      targetCompany: "Top Tech Corp",
      lastModified: now,
      lastFlow: "pdf",
    },
  };
}
