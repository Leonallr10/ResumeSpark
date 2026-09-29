const apiKey = process.env.GEMINI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then((r) => r.json())
  .then((d) => {
    if (d.error) {
      console.error(d.error);
      return;
    }
    const flashModels = (d.models || [])
      .map((m) => m.name)
      .filter((n) => n.includes("flash") || n.includes("gemini"));
    console.log("Flash/Gemini models:", flashModels);
  })
  .catch(console.error);
