import { GoogleGenAI } from "@google/genai";
import { SourcePage } from "@/lib/types";
import { KnowledgeChunk } from "@/lib/models/KnowledgeChunk";

const PRIMARY_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
const FALLBACK_EMBED_MODEL = "embedding-001";

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

export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150
): string[] {
  const chunks: string[] = [];
  if (!text || text.trim().length === 0) return chunks;

  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start + chunkSize / 2) {
        end = lastSpace;
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

let activeEmbedModel: string | null = PRIMARY_EMBED_MODEL;
let disableEmbeddings = false;

export async function getEmbedding(text: string): Promise<number[]> {
  if (disableEmbeddings || !text.trim()) return [];

  const ai = getClient();
  const modelsToTry = activeEmbedModel
    ? Array.from(new Set([activeEmbedModel, FALLBACK_EMBED_MODEL]))
    : [PRIMARY_EMBED_MODEL, FALLBACK_EMBED_MODEL];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.embedContent({
        model: modelName,
        contents: text,
      });
      const values = response.embeddings?.[0]?.values;
      if (values && values.length > 0) {
        activeEmbedModel = modelName;
        return values;
      }
    } catch (err: any) {
      const isNotFound =
        err?.status === 404 ||
        err?.message?.includes("404") ||
        err?.message?.includes("not found");

      if (isNotFound) {
        console.warn(
          `[RAG] Model '${modelName}' not found for embedContent. Trying fallback model...`
        );
        continue;
      }

      console.warn(
        `[RAG Warning]: Vector embedding API unavailable (${err?.message || "API error"}). Falling back to text RAG.`
      );
      disableEmbeddings = true;
      return [];
    }
  }

  console.warn(
    `[RAG Warning]: Neither '${PRIMARY_EMBED_MODEL}' nor '${FALLBACK_EMBED_MODEL}' is supported for embedContent. Falling back to direct text RAG.`
  );
  disableEmbeddings = true;
  return [];
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Builds vector embeddings for documentation pages and saves chunks to MongoDB knowledge base.
 */
export async function buildAndStoreKnowledgeBase(
  demoId: string,
  pages: SourcePage[]
) {
  const chunkDocs = [];

  for (const page of pages) {
    const textChunks = chunkText(page.content);
    for (let i = 0; i < textChunks.length; i++) {
      const chunkTextContent = textChunks[i];
      let embedding: number[] = [];
      try {
        embedding = await getEmbedding(chunkTextContent);
      } catch {}
      chunkDocs.push({
        demoId,
        docTitle: page.title,
        docUrl: page.url || "",
        chunkText: chunkTextContent,
        chunkIndex: i,
        embedding,
      });
    }
  }

  if (chunkDocs.length > 0) {
    try {
      await KnowledgeChunk.insertMany(chunkDocs);
    } catch (dbErr) {
      console.warn("[RAG] Knowledge base DB insertion warning:", dbErr);
    }
  }

  return chunkDocs;
}

/**
 * Retrieves the top-K relevant knowledge base chunks for a demo generation query.
 */
export async function retrieveRelevantContext(
  demoId: string,
  query: string,
  pages: SourcePage[],
  topK: number = 8
) {
  let chunks: any[] = [];
  try {
    chunks = await KnowledgeChunk.find({ demoId }).lean();
  } catch {
    chunks = [];
  }

  if (chunks.length === 0) {
    // If not saved to DB yet, compute temporary chunks for retrieval
    const tempChunks = [];
    for (const page of pages) {
      const textChunks = chunkText(page.content);
      for (let i = 0; i < textChunks.length; i++) {
        const text = textChunks[i];
        let embedding: number[] = [];
        try {
          embedding = await getEmbedding(text);
        } catch {}
        tempChunks.push({
          docTitle: page.title,
          docUrl: page.url || "",
          chunkText: text,
          embedding,
        });
      }
    }
    return scoreAndRankChunks(query, tempChunks, topK);
  }

  return scoreAndRankChunks(query, chunks, topK);
}

async function scoreAndRankChunks(
  query: string,
  chunks: any[],
  topK: number
) {
  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await getEmbedding(query);
  } catch {}

  if (queryEmbedding.length === 0) {
    return chunks.slice(0, topK);
  }

  const scored = chunks.map((chunk) => {
    const score = chunk.embedding?.length
      ? cosineSimilarity(queryEmbedding, chunk.embedding)
      : 0;
    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
