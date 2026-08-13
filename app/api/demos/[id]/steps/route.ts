import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { isValidObjectId, jsonError } from "@/lib/serverUtils";
import { ActionSchema } from "@/lib/types";
import { nanoid } from "nanoid";
import { z } from "zod";

const NewStepSchema = z.object({
  title: z.string().min(1),
  narration: z.string().optional().default(""),
  action: ActionSchema.optional().default({ type: "say", target: "", value: "" }),
  expectedOutcome: z.string().optional().default(""),
  // Optional: insert after this step id. Omitted = append to end.
  afterStepId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }
  const parsed = NewStepSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const demo = await Demo.findById(id);
  if (!demo) return jsonError("Demo not found.", 404);

  const newStep = {
    id: nanoid(8),
    title: parsed.data.title,
    narration: parsed.data.narration,
    action: parsed.data.action,
    expectedOutcome: parsed.data.expectedOutcome,
    status: "edited" as const,
    notes: "",
    order: 0, // reassigned below
  };

  const steps = (demo.steps as any[]).slice();
  const insertAt = parsed.data.afterStepId
    ? steps.findIndex((s) => s.id === parsed.data.afterStepId) + 1
    : steps.length;
  steps.splice(insertAt, 0, newStep);
  steps.forEach((s, i) => (s.order = i));

  demo.steps = steps as any;
  demo.version = (demo.version || 1) + 1;
  await demo.save();

  const obj = demo.toObject();
  return Response.json({ demo: { ...obj, id: String(demo._id) } }, { status: 201 });
}

