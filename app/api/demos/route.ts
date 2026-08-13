import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { KnowledgeChunk } from "@/lib/models/KnowledgeChunk";
import { generateScript } from "@/lib/llm/generateScript";
import { buildAndStoreKnowledgeBase } from "@/lib/llm/rag";
import { toSteps, jsonError } from "@/lib/serverUtils";
import { SourcePageSchema } from "@/lib/types";
import { z } from "zod";

export async function GET() {
  await connectToDatabase();
  const demos = await Demo.find({}, "title customerName status createdAt updatedAt steps")
    .sort({ updatedAt: -1 })
    .lean();
  const summary = demos.map((d: any) => ({
    id: String(d._id),
    title: d.title,
    customerName: d.customerName,
    status: d.status,
    stepCount: d.steps?.length ?? 0,
    updatedAt: d.updatedAt,
  }));
  return Response.json({ demos: summary });
}

const CreateDemoSchema = z.object({
  title: z.string().min(1),
  customerName: z.string().optional().default(""),
  focus: z.string().optional(),
  pages: z.array(SourcePageSchema).min(1),
});

export async function POST(req: Request) {
  await connectToDatabase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const parsed = CreateDemoSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { title, customerName, focus, pages } = parsed.data;

  // 1. Create draft demo record to obtain demoId
  const demo = await Demo.create({
    title,
    customerName,
    status: "draft",
    version: 1,
    sourcePages: pages,
    steps: [],
    generationModel: "",
  });

  const demoId = String(demo._id);

  // 2. Build Knowledge Base: Chunk documentation pages, compute Gemini embeddings, store in DB
  try {
    await buildAndStoreKnowledgeBase(demoId, pages);
  } catch (e: any) {
    console.error("[RAG] Knowledge Base building error:", e);
  }

  // 3. Perform RAG vector retrieval & generate structured script
  let generation;
  try {
    generation = await generateScript(pages, focus, demoId);
  } catch (e: any) {
    return jsonError(e.message || "Script generation failed.", 502);
  }

  // 4. Update demo record with steps and generation model
  demo.steps = toSteps(generation.script.steps);
  demo.generationModel = generation.model;
  await demo.save();

  return Response.json({ id: demoId }, { status: 201 });
}

export async function DELETE() {
  await connectToDatabase();
  await Demo.deleteMany({});
  await KnowledgeChunk.deleteMany({});
  return Response.json({ ok: true, message: "All demo scripts deleted successfully." });
}
