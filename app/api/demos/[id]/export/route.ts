import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { isValidObjectId, jsonError } from "@/lib/serverUtils";
import { AgentRunnableScript } from "@/lib/types";
import { formatStepsToPlaywright, formatStepsToPuppeteer } from "@/lib/exportGenerators";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);
  const demo = await Demo.findById(id).lean<any>();
  if (!demo) return jsonError("Demo not found.", 404);

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  const steps = [...demo.steps].sort((a: any, b: any) => a.order - b.order);

  if (format === "playwright") {
    const code = formatStepsToPlaywright(steps, demo.title);
    return new Response(code, {
      headers: {
        "Content-Type": "text/typescript; charset=utf-8",
        "Content-Disposition": `attachment; filename="${demo.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.spec.ts"`,
      },
    });
  }

  if (format === "puppeteer") {
    const code = formatStepsToPuppeteer(steps, demo.title);
    return new Response(code, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Content-Disposition": `attachment; filename="${demo.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.js"`,
      },
    });
  }

  // Default JSON payload for agent runners
  const payloadSteps = steps.map((s: any) => ({
    order: s.order,
    title: s.title,
    narration: s.narration,
    action: s.action,
    expectedOutcome: s.expectedOutcome,
  }));

  const payload: AgentRunnableScript = {
    demoId: String(demo._id),
    title: demo.title,
    version: demo.version,
    steps: payloadSteps,
  };

  return Response.json(payload);
}
