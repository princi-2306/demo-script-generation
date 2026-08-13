import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Demo } from "@/lib/models/Demo";
import { TopBar } from "@/components/TopBar";
import { DashboardList } from "@/components/DashboardList";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await connectToDatabase();
  const rawDemos = await Demo.find({}, "title customerName status createdAt updatedAt steps")
    .sort({ updatedAt: -1 })
    .lean<any[]>();

  const demos = JSON.parse(JSON.stringify(rawDemos));

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-ink text-zinc-100">
      <TopBar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {/* Header Title Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-text flex items-center gap-2.5">
              <span>Call Sheet & Demo Scripts</span>
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">
              Every demo script generated from source documentation, ready to review, edit, or execute.
            </p>
          </div>

          <Button asChild variant="default" size="default" className="gap-2 shrink-0 md:self-start font-mono text-xs">
            <Link href="/new">
              <Sparkles className="h-4 w-4" />
              <span>Generate Script with AI</span>
            </Link>
          </Button>
        </div>

        {/* Dashboard Client Component with Batch & Single Delete capabilities */}
        <DashboardList initialDemos={demos} />
      </main>
    </div>
  );
}
