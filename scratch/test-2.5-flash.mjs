const apiKey = process.env.GEMINI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Hello, respond with JSON {\"status\": \"ok\"}" }] }],
    generationConfig: { responseMimeType: "application/json" },
  }),
})
  .then((r) => r.json())
  .then((d) => console.log("Response:", d.candidates?.[0]?.content?.parts?.[0]?.text))
  .catch(console.error);
