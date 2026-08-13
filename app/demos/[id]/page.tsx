import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { Editor } from "@/components/Editor";

export const dynamic = "force-dynamic";

export default async function DemoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();
  const demo = await Demo.findById(id).lean<any>().catch(() => null);
  if (!demo) notFound();

  return (
    <Editor
      demo={JSON.parse(
        JSON.stringify({ ...demo, id: String(demo._id), _id: undefined })
      )}
    />
  );
}
