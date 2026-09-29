const sampleText = `Leonal Robin
Full-Stack & AI Engineer
Bengaluru, Karnataka, India | +91 8248731433 | leonal2003lr10@gmail.com
in/leonal-robin-47b681284 | Leonallr10 | leonalrobin.vercel.app
PROFESSIONAL PROFILE
Full-Stack and AI Engineer with 1.5+ years designing and deploying agent systems and interactive web applications. Expertise in Python, TypeScript, React/Next.js, LLM integration (OpenAI API, LangChain), and vector search (FAISS, Pinecone) to build multi-step reasoning workflows and production-ready, scalable solutions.
TECHNICAL SKILLS
Languages & Frameworks Python, JavaScript, TypeScript, SQL, React.js, Next.js, Node.js, Flask, Three.js
AI / ML LLMs, LangChain, RAG, FAISS, Pinecone, OpenAI API, Agent Architectures
Tools & Platforms REST APIs, JWT, Prisma, Tailwind CSS, Zustand, Playwright, PostgreSQL, MySQL, Redis, MongoDB, Firebase, Supabase, AWS, GCP, Docker, Git, Jira
PROFESSIONAL EXPERIENCE
Aug 2025 – Mar 2026
Bangalore, India
Frontend & R&D Engineer Intern, Flam
Interactive media and AR
• Led R&D and frontend engineering for a browser-based video editor, building timeline keyframing, GLB gizmo controls, and text transition animations that became the production core of Flam’s interactive media pipeline.
• Optimized GLB overlay performance by eliminating redundant mesh-level animations, and developed custom 3D gizmo controls integrated with Remotion and Three.js.
• Implemented a Mastra + OpenAI function-calling pipeline enabling NLP-driven control over canvas state, overlay sequencing, and image-to-video generation.
• Built a grouped QR scanning platform and AR experience management dashboard to manage, publish, and monitor interactive AR campaigns.
Feb 2025 – Jul 2025
Chennai, India
Software Development Engineer Intern, MANNIT
LLM applications and vector search
• Identified Pinecone API quotas as a bottleneck; architected a hybrid FAISS indexing layer, cutting cloud vector search costs to near-zero and reducing query latency 3–5x.
• Designed an admin-driven vector database pipeline with automatic category generation and dynamic user-specific data isolation.
• Built PostgreSQL-backed authentication with chat history persistence and an admin dashboard for embedding management.
• Engineered a codebase analysis system for 10,000+ file repositories via AST parsing, smart filtering, and batched async processing.
Oct 2023 – May 2024
Coimbatore, India
Software Development Engineer Intern, Telesto Energy
Energy data platforms
• Built FastAPI and Django backends for real-time energy data ingestion; normalized MySQL schemas to improve query performance.
• Developed a landing page with a CSV-upload analysis tool that generates seismic data visualizations using Plotly.js on a Django backend.
SELECTED PROJECTS
Feb 2026 – Jun 2026 Chess Insight
AI Chess Coaching Platform
• Integrated the Stockfish engine via webhooks for real-time move-by-move game analysis across synced Lichess and Chess.com histories for 100+ active players.
• Engineered the interactive frontend and backend, shipping a live SaaS product with tiered paid subscription plans for chess coaches and academies.
Mar 2026 – Jun 2026 Hive
YC-Backed AI Agent Runtime
• Contributed to core agent orchestration features; added drag-and-drop file upload to the agent chat interface for live multi-agent workflows.
Mar 2026 – May 2026 ResumeTailor AI
AI-powered resume editor
• Built an AI-powered resume editor using Python and TypeScript, integrating OpenAI GPT APIs for streaming text polishing, ATS audits, and tool-based function calling.
• Deployed a full-stack system on Vercel and AWS with automated one-click portfolio site generation from resume content.
Nov 2024 – Jan 2025 TruthGuard
Fake News Detection
• Architected a real-time fact-checking AI agent using multimodal models (CLIP, GPT-2, Whisper), OCR pipelines, and FAISS vector retrieval.
• Designed evaluation metrics and monitoring dashboards on AWS, achieving 85% detection accuracy across media uploads, text inputs, and live URLs.
EDUCATION
Sep 2021 – May 2025
Coimbatore, India
Amrita Vishwa Vidyapeetham
Bachelor of Technology, Computer Science and Engineering
HONORS & ACTIVITIES
Oct 2024 NASA Space App Challenge
Seismic Data from Apollo and Mars InSight Missions
Jan 2024 ANSAN – GDSC Project
Google Solutions Challenge India Regional Bootcamp
Mar 2023 Pragyan ’23 – National Winner
National Level Hackathon at NIT Trichy`;

fetch("http://localhost:3000/api/resume/parse", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sourceText: sampleText }),
})
  .then((r) => r.json())
  .then((d) => {
    console.log("Model personalInfo:", d.model?.personalInfo);
    console.log("Model education:", d.model?.education);
    console.log("Model skills categories:", d.model?.skills?.map((s) => s.category));
    console.log("Model projects count:", d.model?.projects?.length);
    console.log("Model projects titles:", d.model?.projects?.map((p) => p.title));
    console.log("Model achievements count:", d.model?.achievements?.length);
    console.log("Model experience count:", d.model?.experience?.length);
    console.log("Model experience bullets for Flam:", d.model?.experience?.[0]?.bullets?.length);
  })
  .catch(console.error);
