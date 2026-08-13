import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { generateScript } from "@/lib/llm/generateScript";
import { buildAndStoreKnowledgeBase } from "@/lib/llm/rag";
import { toSteps } from "@/lib/serverUtils";
import { SourcePageSchema } from "@/lib/types";
import { z } from "zod";

const CreateDemoSchema = z.object({
  title: z.string().min(1),
  customerName: z.string().optional().default(""),
  focus: z.string().optional(),
  pages: z.array(SourcePageSchema).min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = CreateDemoSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const { title, customerName, focus, pages } = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendProgress(stepId: number, status: string, detail: string) {
        const payload = `data: ${JSON.stringify({
          type: "progress",
          stepId,
          status,
          detail,
        })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      function sendError(errorMsg: string) {
        const payload = `data: ${JSON.stringify({
          type: "error",
          error: errorMsg,
        })}\n\n`;
        controller.enqueue(encoder.encode(payload));
        controller.close();
      }

      try {
        // Step 1: Connecting DB & Creating Draft Demo
        sendProgress(
          1,
          "Parsing & validating document content",
          `Processing ${pages.length} source documentation page(s)...`
        );
        await connectToDatabase();

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

        // Step 2: Document Chunking & Embeddings
        sendProgress(
          2,
          "Chunking content & computing vector embeddings",
          "Generating dense vector representations with Gemini text-embedding-004..."
        );

        // Step 3: Indexing Knowledge Base
        sendProgress(
          3,
          "Indexing Knowledge Base in MongoDB",
          "Storing vector chunks in MongoDB knowledge base collection..."
        );
        await buildAndStoreKnowledgeBase(demoId, pages);

        // Step 4: Vector Context Retrieval (RAG)
        sendProgress(
          4,
          "Querying Vector Knowledge Base (RAG retrieval)",
          `Finding top relevant knowledge context matching focus query...`
        );

        // Step 5: LLM Script Synthesis
        sendProgress(
          5,
          "Synthesizing structured demo script via Gemini AI",
          "Generating step-by-step narration, UI actions, targets, and expected outcomes..."
        );
        const generation = await generateScript(pages, focus, demoId);

        // Step 6: Complete & Save
        demo.steps = toSteps(generation.script.steps);
        demo.generationModel = generation.model;
        await demo.save();

        sendProgress(
          6,
          "Demo script successfully generated!",
          "Finalizing script structure and preparing interactive player..."
        );

        const donePayload = `data: ${JSON.stringify({
          type: "complete",
          demoId,
        })}\n\n`;
        controller.enqueue(encoder.encode(donePayload));
        controller.close();
      } catch (err: any) {
        console.error("[Stream Generation Error]:", err);
        sendError(err.message || "Script generation failed.");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
