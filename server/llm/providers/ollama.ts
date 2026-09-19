export async function generateWithOllama(
  prompt: string,
  model = "llama3.2:latest",
  host = "http://127.0.0.1:11434",
): Promise<string> {
  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama generation failed with status: ${res.status}`);
  }

  const data = await res.json();
  return data.response ?? "";
}
