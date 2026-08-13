import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { isValidObjectId, jsonError } from "@/lib/serverUtils";
import { ActionSchema, StepStatusEnum } from "@/lib/types";
import { z } from "zod";

const PatchStepSchema = z.object({
  title: z.string().min(1).optional(),
  narration: z.string().optional(),
  action: ActionSchema.optional(),
  expectedOutcome: z.string().optional(),
  status: StepStatusEnum.optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  await connectToDatabase();
  const { id, stepId } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }
  const parsed = PatchStepSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const demo = await Demo.findById(id);
  if (!demo) return jsonError("Demo not found.", 404);

  const step = (demo.steps as any[]).find((s) => s.id === stepId);
  if (!step) return jsonError("Step not found.", 404);

  Object.assign(step, parsed.data);
  // Any manual edit to a generated step marks it as human-edited, unless the
  // caller explicitly set a status (e.g. marking it "verified").
  if (!parsed.data.status && step.status === "generated") {
    step.status = "edited";
  }

  demo.version = (demo.version || 1) + 1;
  await demo.save();

  const obj = demo.toObject();
  return Response.json({ demo: { ...obj, id: String(demo._id) } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  await connectToDatabase();
  const { id, stepId } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);

  const demo = await Demo.findById(id);
  if (!demo) return jsonError("Demo not found.", 404);

  const steps = (demo.steps as any[]).filter((s) => s.id !== stepId);
  steps.forEach((s, i) => (s.order = i));
  demo.steps = steps as any;
  demo.version = (demo.version || 1) + 1;
  await demo.save();

  const obj = demo.toObject();
  return Response.json({ demo: { ...obj, id: String(demo._id) } });
}

