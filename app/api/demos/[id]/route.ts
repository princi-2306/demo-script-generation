import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { KnowledgeChunk } from "@/lib/models/KnowledgeChunk";
import { isValidObjectId, jsonError } from "@/lib/serverUtils";
import { DemoStatusEnum } from "@/lib/types";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);
  const demo = await Demo.findById(id).lean();
  if (!demo) return jsonError("Demo not found.", 404);
  return Response.json({ demo: { ...demo, id: String((demo as any)._id) } });
}

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  customerName: z.string().optional(),
  status: DemoStatusEnum.optional(),
  steps: z.array(z.any()).optional(),
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
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const patchData: any = { ...parsed.data };
  if (patchData.steps) {
    patchData.$inc = { version: 1 };
  }

  const demo = await Demo.findByIdAndUpdate(id, patchData, { returnDocument: "after" }).lean();
  if (!demo) return jsonError("Demo not found.", 404);
  return Response.json({ demo: { ...demo, id: String((demo as any)._id) } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Demo not found.", 404);
  const res = await Demo.findByIdAndDelete(id);
  if (!res) return jsonError("Demo not found.", 404);
  await KnowledgeChunk.deleteMany({ demoId: id }).catch(() => null);
  return Response.json({ ok: true });
}
