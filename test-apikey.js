import { GoogleGenAI } from "@google/genai";

async function testGemini() {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY, // set your key in env
    });

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Say hello in one line",
    });

    console.log("✅ API Key is working!");
    console.log("Response:", response.text);
  } catch (error) {
    console.error("❌ API Key failed!");
    console.error(error.message);
  }
}

testGemini();