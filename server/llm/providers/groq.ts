import Groq from "groq-sdk";

export async function generateWithGroq(
  apiKey: string,
  prompt: string,
  model?: string,
): Promise<string> {
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert technical resume tailoring assistant. Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.25,
  });

  return response.choices[0]?.message?.content ?? "";
}
