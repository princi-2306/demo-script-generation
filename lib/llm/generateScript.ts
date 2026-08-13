import { GoogleGenAI } from "@google/genai";
import { GeneratedScriptSchema, SourcePage } from "@/lib/types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { retrieveRelevantContext } from "./rag";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
      );
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * RAG-powered Script Generation:
 * 1. Performs vector search against knowledge base chunks matching the demo query/focus.
 * 2. Assembles retrieved context chunks into the prompt.
 * 3. Calls Gemini API to generate validated, structured JSON demo script steps.
 */
export async function generateScript(
  pages: SourcePage[],
  focus?: string,
  demoId?: string
) {
  const ai = getClient();
  const query = focus?.trim()
    ? focus
    : pages.map((p) => p.title).join(" ") || "Product Demo Setup and Workflow";

  // Vector Search Retrieval from RAG Knowledge Base
  let retrievedChunks = [];
  try {
    retrievedChunks = await retrieveRelevantContext(
      demoId || "temp",
      query,
      pages,
      10
    );
  } catch (err) {
    console.error("[RAG] Vector retrieval fallback to raw pages:", err);
  }

  const promptTarget =
    retrievedChunks.length > 0 ? retrievedChunks : pages;
  const userPrompt = buildUserPrompt(promptTarget, focus);

  let promptText = userPrompt;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: promptText,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text || "";

    try {
      const parsed = JSON.parse(extractJson(raw));
      const result = GeneratedScriptSchema.safeParse(parsed);
      if (result.success) {
        return { script: result.data, model: MODEL };
      }
      promptText = `${userPrompt}\n\nPrevious response didn't match required schema: ${result.error.message}. Return corrected JSON only, no commentary.`;
    } catch (e) {
      promptText = `${userPrompt}\n\nPrevious response wasn't valid JSON. Return ONLY the JSON object, no markdown fences, no commentary.`;
    }
  }

  throw new Error(
    "Model failed to produce a valid demo script after retrying. Try again or reduce the amount of source content."
  );
}


