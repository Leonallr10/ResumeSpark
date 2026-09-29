import fs from "fs";

async function testUploadParse() {
  const filePath = "C:/Users/thava/.gemini/antigravity-ide/brain/7c7e821c-f25f-4bde-ab21-564e38883cbf/.user_uploaded/media_1790678843171.pdf";
  const fileBuf = fs.readFileSync(filePath);
  const blob = new Blob([fileBuf], { type: "application/pdf" });

  const formData = new FormData();
  formData.append("file", blob, "leonal-robin-resume.pdf");

  console.log("Posting to http://localhost:3000/api/resume/upload-parse ...");
  const res = await fetch("http://localhost:3000/api/resume/upload-parse", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  console.log("Status:", res.status);
  if (!res.ok) {
    console.error("Error:", data);
    return;
  }

  console.log("Cached:", data.cached);
  console.log("Full Name:", data.model?.personalInfo?.fullName);
  console.log("Email:", data.model?.personalInfo?.email);
  console.log("Phone:", data.model?.personalInfo?.phone);
  console.log("LinkedIn:", data.model?.personalInfo?.linkedin);
  console.log("GitHub:", data.model?.personalInfo?.github);
  console.log("Portfolio:", data.model?.personalInfo?.portfolio);
  console.log("Summary:", data.model?.summary?.slice(0, 100));
  console.log("Experience count:", data.model?.experience?.length);
  data.model?.experience?.forEach((e, idx) => {
    console.log(`Exp ${idx + 1}: ${e.role} at ${e.company} (${e.startDate} - ${e.endDate}, ${e.location}) [${e.bullets?.length} bullets]`);
  });
  console.log("Education count:", data.model?.education?.length);
  data.model?.education?.forEach((ed, idx) => {
    console.log(`Edu ${idx + 1}: ${ed.degree} in ${ed.field} at ${ed.institution} (${ed.startDate} - ${ed.endDate}, ${ed.location})`);
  });
  console.log("Projects count:", data.model?.projects?.length);
  data.model?.projects?.forEach((p, idx) => {
    console.log(`Proj ${idx + 1}: ${p.title} - ${p.subtitle} (${p.startDate} - ${p.endDate}) [${p.bullets?.length} bullets]`);
  });
  console.log("Skills count:", data.model?.skills?.length);
  data.model?.skills?.forEach((s) => {
    console.log(`Skills [${s.category}]: ${s.skills.join(", ")}`);
  });
  console.log("Achievements count:", data.model?.achievements?.length);
  data.model?.achievements?.forEach((a) => {
    console.log(`Ach: ${a.title} - ${a.subtitle} (${a.date})`);
  });
}

testUploadParse().catch(console.error);
