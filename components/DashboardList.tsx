"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Play,
  Clock,
  Layers,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface DemoItem {
  _id: string;
  title: string;
  customerName?: string;
  status: string;
  updatedAt: string;
  steps?: any[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
};

export function DashboardList({ initialDemos }: { initialDemos: DemoItem[] }) {
  const [demos, setDemos] = useState<DemoItem[]>(initialDemos);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const router = useRouter();

  const totalDemos = demos.length;
  const draftCount = demos.filter((d) => d.status === "draft").length;
  const reviewCount = demos.filter((d) => d.status === "in_review").length;
  const approvedCount = demos.filter((d) => d.status === "approved").length;

  const handleDeleteSingle = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/demos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete script");
      setDemos((prev) => prev.filter((d) => String(d._id) !== id));
      toast.success(`Deleted script "${title}"`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete script");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (demos.length === 0) return;

    if (
      !confirm(
        `WARNING: Are you sure you want to DELETE ALL ${demos.length} DEMO SCRIPTS?\n\nThis will permanently erase all scripts and knowledge base chunks. This action CANNOT be undone!`
      )
    ) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/demos", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all scripts");
      setDemos([]);
      toast.success("Successfully deleted all demo scripts");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete scripts");
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <>
      {/* Metrics Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-surface/50 border-hairline backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">Total Demos</p>
              <p className="font-display text-2xl font-bold text-text mt-1">{totalDemos}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cue/10 border border-cue/30 flex items-center justify-center text-cue">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/50 border-hairline backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">Drafts</p>
              <p className="font-display text-2xl font-bold text-slate-300 mt-1">{draftCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-500/10 border border-slate-500/30 flex items-center justify-center text-slate-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/50 border-hairline backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">In Review</p>
              <p className="font-display text-2xl font-bold text-indigo-400 mt-1">{reviewCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/50 border-hairline backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">Approved</p>
              <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{approvedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Scripts Table Container */}
      {demos.length === 0 ? (
        <Card className="border-dashed border-hairline bg-surface/30 p-12 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-16 w-16 rounded-2xl bg-cue/10 border border-cue/30 flex items-center justify-center text-cue mb-4">
              <Sparkles className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">No demo scripts yet</CardTitle>
            <CardDescription className="max-w-md mt-2">
              Paste in customer scraped documentation, upload files, or provide URLs to generate your first interactive script.
            </CardDescription>
            <Button asChild className="mt-6 gap-2" variant="default">
              <Link href="/new">
                <Plus className="h-4 w-4" />
                <span>Create First Demo</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-hairline bg-surface/60 backdrop-blur-sm shadow-xl">
          <CardHeader className="border-b border-hairline bg-surface-raised/40 py-4 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Active Demo Scripts</CardTitle>
                <CardDescription className="text-xs">
                  Showing {demos.length} script{demos.length === 1 ? "" : "s"} ordered by latest activity
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                  className="gap-1.5 font-mono text-xs shadow-md bg-red-950/80 hover:bg-red-900 border border-red-800/50 text-red-200"
                >
                  {isDeletingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Delete All Scripts</span>
                </Button>

                <Button asChild variant="default" size="sm" className="gap-1.5 font-mono text-xs shadow-md">
                  <Link href="/new">
                    <Plus className="h-4 w-4" />
                    <span>New Demo</span>
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>

          <Table>
            <TableHeader className="bg-surface-raised/80">
              <TableRow>
                <TableHead className="w-[35%]">Demo Script</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demos.map((d) => {
                const isItemDeleting = deletingId === String(d._id);
                return (
                  <TableRow key={String(d._id)} className="group hover:bg-surface-raised/30 transition-colors">
                    <TableCell className="font-medium">
                      <Link
                        href={`/demos/${d._id}`}
                        className="flex items-center gap-2.5 text-text hover:text-cue transition font-semibold"
                      >
                        <FileText className="h-4 w-4 text-cue/80 group-hover:text-cue shrink-0" />
                        <span className="line-clamp-1">{d.title}</span>
                      </Link>
                    </TableCell>

                    <TableCell className="text-text-muted">
                      <span className="flex items-center gap-1.5 text-xs font-mono">
                        <User className="h-3.5 w-3.5 opacity-60 shrink-0" />
                        {d.customerName || "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="gap-1 font-mono text-xs">
                        <Layers className="h-3 w-3 text-cue" />
                        {d.steps?.length ?? 0}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={(d.status as any) || "draft"}>
                        <span
                          className="cue-dot"
                          style={{
                            background:
                              d.status === "approved"
                                ? "#10b981"
                                : d.status === "in_review"
                                ? "#6366f1"
                                : "#94a3b8",
                          }}
                        />
                        {STATUS_LABEL[d.status] || d.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-text-muted text-xs font-mono">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 opacity-50 shrink-0" />
                        {new Date(d.updatedAt).toLocaleString()}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1 font-mono text-xs">
                          <Link href={`/demos/${d._id}`}>Edit</Link>
                        </Button>
                        <Button asChild size="sm" variant="default" className="h-8 gap-1 font-mono text-xs">
                          <Link href={`/demos/${d._id}/play`}>
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Play</span>
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSingle(String(d._id), d.title)}
                          disabled={isItemDeleting}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
                          title="Delete script"
                        >
                          {isItemDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
