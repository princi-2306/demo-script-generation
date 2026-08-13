import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { isValidObjectId, jsonError } from "@/lib/serverUtils";
import { z } from "zod";

const ReorderSchema = z.object({
  // Full ordered list of step ids, front-end computes this after a
  // drag-and-drop or up/down move and sends the whole new order.
  orderedStepIds: z.array(z.string()).min(1),
});

export async function PATCH(
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
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const demo = await Demo.findById(id);
  if (!demo) return jsonError("Demo not found.", 404);

  const byId = new Map((demo.steps as any[]).map((s) => [s.id, s]));
  if (
    parsed.data.orderedStepIds.length !== byId.size ||
    !parsed.data.orderedStepIds.every((sid) => byId.has(sid))
  ) {
    return jsonError("orderedStepIds must be a permutation of the demo's current step ids.");
  }

  const reordered = parsed.data.orderedStepIds.map((sid, i) => {
    const s = byId.get(sid);
    s.order = i;
    return s;
  });

  demo.steps = reordered as any;
  demo.version = (demo.version || 1) + 1;
  await demo.save();

  const obj = demo.toObject();
  return Response.json({ demo: { ...obj, id: String(demo._id) } });
}

