import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { Player } from "@/components/Player";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectToDatabase();
  const demo = await Demo.findById(id).lean<any>().catch(() => null);
  if (!demo) notFound();

  return (
    <Player
      demo={JSON.parse(
        JSON.stringify({ ...demo, id: String(demo._id), _id: undefined })
      )}
    />
  );
}
