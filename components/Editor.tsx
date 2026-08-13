"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as yaml from "js-yaml";
import { toast } from "sonner";

import { TopBar } from "@/components/TopBar";
import { StatusDot, StatusPill } from "@/components/StatusDot";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Code2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle2,
  Save,
  FileText,
  Sparkles,
  ExternalLink,
  Layers,
  AlertCircle,
  Download,
  CheckCheck,
  ShieldCheck,
  Clock,
} from "lucide-react";
import type { Action, ActionType, Step, StepStatus } from "@/lib/types";
import { formatStepsToPlaywright, formatStepsToPuppeteer } from "@/lib/exportGenerators";

interface DemoData {
  id: string;
  title: string;
  customerName?: string;
  status: "draft" | "in_review" | "approved";
  steps: Step[];
  sourcePages: { title: string; url?: string; content: string }[];
  version: number;
}

type FormatType = "json" | "yaml" | "markdown" | "text" | "playwright" | "puppeteer";
type ViewMode = "visual" | "raw";

const ACTION_TYPES: ActionType[] = [
  "navigate",
  "click",
  "input",
  "highlight",
  "wait",
  "say",
  "scroll",
];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function Editor({ demo: initial }: { demo: DemoData }) {
  const router = useRouter();
  const [demo, setDemo] = useState(initial);
  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [selectedId, setSelectedId] = useState(initial.steps[0]?.id ?? null);
  const [format, setFormat] = useState<FormatType>("json");
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteScript() {
    if (!confirm(`Are you sure you want to delete "${demo.title}"? This cannot be undone.`)) {
      return;
    }
    const data = await run(() => api(`/api/demos/${demo.id}`, { method: "DELETE" }));
    if (data) {
      toast.success("Script deleted successfully!");
      router.push("/");
    }
  }

  const sortedSteps = useMemo(
    () => [...demo.steps].sort((a, b) => a.order - b.order),
    [demo.steps]
  );
  const selected = sortedSteps.find((s) => s.id === selectedId) ?? sortedSteps[0] ?? null;

  const verifiedCount = useMemo(
    () => sortedSteps.filter((s) => s.status === "verified").length,
    [sortedSteps]
  );
  const percentVerified = sortedSteps.length > 0 ? Math.round((verifiedCount / sortedSteps.length) * 100) : 0;

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      const msg = e.message || "Something went wrong.";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function updateDemoState(incoming: any) {
    if (!incoming) return;
    setDemo((prev) => ({
      ...prev,
      ...incoming,
      id: String(incoming.id || incoming._id || prev.id),
    }));
  }

  // --- Step CRUD methods ---
  async function patchStep(stepId: string, patch: Partial<Step>) {
    const data = await run(() =>
      api(`/api/demos/${demo.id}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    );
    if (data) {
      updateDemoState(data.demo);
      if (patch.status === "verified") {
        toast.success("Step marked as verified!");
      } else {
        toast.success("Step changes saved!");
      }
    }
  }

  async function handleBatchMarkVerified() {
    const updatedSteps = sortedSteps.map((s) => ({ ...s, status: "verified" as const }));
    const data = await run(() =>
      api(`/api/demos/${demo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ steps: updatedSteps }),
      })
    );
    if (data) {
      updateDemoState(data.demo);
      toast.success(`All ${updatedSteps.length} steps marked as verified!`);
    }
  }

  async function handleApproveForProduction() {
    const updatedSteps = sortedSteps.map((s) => ({ ...s, status: "verified" as const }));
    const data = await run(() =>
      api(`/api/demos/${demo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", steps: updatedSteps }),
      })
    );
    if (data) {
      updateDemoState(data.demo);
      toast.success("Demo script approved for production deployment!");
    }
  }

  async function addStep(afterStepId?: string) {
    const data = await run(() =>
      api(`/api/demos/${demo.id}/steps`, {
        method: "POST",
        body: JSON.stringify({
          title: "New step",
          narration: "",
          action: { type: "say", target: "", value: "" },
          expectedOutcome: "",
          afterStepId,
        }),
      })
    );
    if (data) {
      updateDemoState(data.demo);
      const inserted = data.demo.steps.find(
        (s: Step) => !demo.steps.some((existing) => existing.id === s.id)
      );
      if (inserted) setSelectedId(inserted.id);
      toast.success("New step added!");
    }
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Delete this step?")) return;
    const data = await run(() =>
      api(`/api/demos/${demo.id}/steps/${stepId}`, { method: "DELETE" })
    );
    if (data) {
      updateDemoState(data.demo);
      if (selectedId === stepId) {
        const next = data.demo.steps.sort((a: Step, b: Step) => a.order - b.order)[0];
        setSelectedId(next?.id ?? null);
      }
      toast.info("Step deleted");
    }
  }

  async function move(stepId: string, dir: -1 | 1) {
    const ids = sortedSteps.map((s) => s.id);
    const idx = ids.indexOf(stepId);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    const data = await run(() =>
      api(`/api/demos/${demo.id}/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ orderedStepIds: ids }),
      })
    );
    if (data) {
      updateDemoState(data.demo);
      toast.success("Steps reordered!");
    }
  }

  async function updateMeta(patch: Partial<DemoData>) {
    const data = await run(() =>
      api(`/api/demos/${demo.id}`, { method: "PATCH", body: JSON.stringify(patch) })
    );
    if (data) {
      updateDemoState(data.demo);
      if (patch.status) {
        toast.success(`Demo status updated to ${patch.status.replace("_", " ")}`);
      }
    }
  }

  // --- Raw format converters ---
  function formatStepsToString(steps: Step[], targetFormat: FormatType): string {
    if (targetFormat === "playwright") {
      return formatStepsToPlaywright(steps, demo.title);
    }
    if (targetFormat === "puppeteer") {
      return formatStepsToPuppeteer(steps, demo.title);
    }

    const cleanSteps = steps.map((s, idx) => ({
      id: s.id || `step-${idx + 1}`,
      order: idx + 1,
      title: s.title || `Step ${idx + 1}`,
      narration: s.narration || "",
      action: {
        type: s.action?.type || "say",
        target: s.action?.target || "",
        value: s.action?.value || "",
      },
      expectedOutcome: s.expectedOutcome || "",
      status: s.status || "generated",
      notes: s.notes || "",
    }));

    if (targetFormat === "json") return JSON.stringify(cleanSteps, null, 2);
    if (targetFormat === "yaml") return yaml.dump(cleanSteps, { indent: 2 });
    if (targetFormat === "markdown") {
      return `# ${demo.title}\n\n` + cleanSteps.map((s, idx) =>
        `## Step ${idx + 1}: ${s.title}\n- **Action**: ${s.action.type}\n- **Target**: ${s.action.target || "N/A"}\n- **Value**: ${s.action.value || "N/A"}\n- **Narration**: ${s.narration || "N/A"}\n- **Expected Outcome**: ${s.expectedOutcome || "N/A"}\n- **Status**: ${s.status}\n`
      ).join("\n");
    }
    return cleanSteps.map((s, idx) =>
      `==================================================\nSTEP ${idx + 1}: ${s.title.toUpperCase()}\n==================================================\nAction: ${s.action.type}\nTarget: ${s.action.target}\nValue: ${s.action.value}\nNarration: ${s.narration}\nExpected Outcome: ${s.expectedOutcome}\nStatus: ${s.status}\n`
    ).join("\n");
  }

  function parseTextToSteps(text: string, currentFormat: FormatType): Step[] {
    if (currentFormat === "playwright" || currentFormat === "puppeteer") {
      throw new Error("Playwright and Puppeteer code exports are read-only output formats.");
    }
    if (currentFormat === "json") {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.steps;
      if (!Array.isArray(arr)) throw new Error("Expected JSON array of steps.");
      return sanitizeSteps(arr);
    }
    if (currentFormat === "yaml") {
      const parsed = yaml.load(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed as any)?.steps;
      if (!Array.isArray(arr)) throw new Error("Expected YAML list of steps.");
      return sanitizeSteps(arr);
    }
    if (currentFormat === "markdown") {
      const sections = text.split(/^## Step /m).slice(1);
      if (sections.length === 0) throw new Error("No Markdown step headers found.");
      return sections.map((sec, idx) => {
        const lines = sec.split("\n");
        const titleLine = lines[0].replace(/^\d+:\s*/, "").trim();
        const getVal = (key: string) => {
          const l = lines.find((line) => line.trim().toLowerCase().startsWith(`- **${key.toLowerCase()}**:`));
          return l ? l.split(":").slice(1).join(":").trim() : "";
        };
        const actionType = getVal("Action") || "say";
        return {
          id: `step-${idx + 1}`,
          order: idx + 1,
          title: titleLine || `Step ${idx + 1}`,
          narration: getVal("Narration"),
          action: {
            type: (ACTION_TYPES.includes(actionType as any) ? actionType : "say") as any,
            target: getVal("Target") === "N/A" ? "" : getVal("Target"),
            value: getVal("Value") === "N/A" ? "" : getVal("Value"),
          },
          expectedOutcome: getVal("Expected Outcome") === "N/A" ? "" : getVal("Expected Outcome"),
          status: (getVal("Status") as any) || "generated",
          notes: "",
        };
      });
    }

    // Plain text parser
    const blocks = text.split(/={3,}/).filter((b) => b.trim().length > 0);
    const result: Step[] = [];
    let cur: Partial<Step> | null = null;
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const l of lines) {
        if (l.toUpperCase().startsWith("STEP ")) {
          if (cur && cur.title) result.push(completeStep(cur, result.length + 1));
          cur = { title: l.split(":").slice(1).join(":").trim() };
        } else if (l.toLowerCase().startsWith("action:")) {
          const act = l.split(":")[1]?.trim() || "say";
          if (!cur) cur = {};
          cur.action = { type: (ACTION_TYPES.includes(act as any) ? act : "say") as any, target: "", value: "" };
        } else if (l.toLowerCase().startsWith("target:")) {
          if (!cur) cur = {};
          if (!cur.action) cur.action = { type: "say", target: "", value: "" };
          cur.action.target = l.split(":").slice(1).join(":").trim();
        } else if (l.toLowerCase().startsWith("value:")) {
          if (!cur) cur = {};
          if (!cur.action) cur.action = { type: "say", target: "", value: "" };
          cur.action.value = l.split(":").slice(1).join(":").trim();
        } else if (l.toLowerCase().startsWith("narration:")) {
          if (!cur) cur = {};
          cur.narration = l.split(":").slice(1).join(":").trim();
        } else if (l.toLowerCase().startsWith("expected outcome:")) {
          if (!cur) cur = {};
          cur.expectedOutcome = l.split(":").slice(1).join(":").trim();
        }
      }
    }
    if (cur && cur.title) result.push(completeStep(cur, result.length + 1));
    if (result.length === 0) throw new Error("Could not parse steps from Plain Text.");
    return result;
  }

  function completeStep(p: Partial<Step>, idx: number): Step {
    return {
      id: p.id || `step-${idx}`,
      order: idx,
      title: p.title || `Step ${idx}`,
      narration: p.narration || "",
      action: { type: p.action?.type || "say", target: p.action?.target || "", value: p.action?.value || "" },
      expectedOutcome: p.expectedOutcome || "",
      status: p.status || "generated",
      notes: p.notes || "",
    };
  }

  function sanitizeSteps(arr: any[]): Step[] {
    return arr.map((s, idx) => ({
      id: String(s.id || `step-${idx + 1}`),
      order: idx + 1,
      title: String(s.title || `Step ${idx + 1}`),
      narration: String(s.narration || ""),
      action: {
        type: (ACTION_TYPES.includes(s.action?.type) ? s.action.type : "say") as any,
        target: String(s.action?.target || ""),
        value: String(s.action?.value || ""),
      },
      expectedOutcome: String(s.expectedOutcome || ""),
      status: (["generated", "edited", "verified"].includes(s.status) ? s.status : "generated") as any,
      notes: String(s.notes || ""),
    }));
  }

  useEffect(() => {
    setRawText(formatStepsToString(demo.steps, format));
  }, [format, demo.steps]);

  async function handleRawSave() {
    setBusy(true);
    setError(null);
    try {
      const parsedSteps = parseTextToSteps(rawText, format);
      const res = await api(`/api/demos/${demo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ steps: parsedSteps }),
      });
      updateDemoState(res.demo);

      setRawText(formatStepsToString(res.demo.steps, format));
      toast.success("Raw script format parsed and saved successfully!");
    } catch (err: any) {
      const msg = `Failed to save: ${err.message}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadFile() {
    const extMap: Record<FormatType, string> = {
      json: "json",
      yaml: "yaml",
      markdown: "md",
      text: "txt",
      playwright: "spec.ts",
      puppeteer: "js",
    };
    const ext = extMap[format] || "txt";
    const filename = `${demo.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.${ext}`;
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded script file as ${filename}`);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-ink text-zinc-100">
      <TopBar
        crumb={demo.title}
        right={
          <>
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-hairline bg-surface p-1">
              <Button
                variant={viewMode === "visual" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("visual")}
                className="gap-1.5 h-7 text-xs font-mono"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Visual Editor</span>
              </Button>
              <Button
                variant={viewMode === "raw" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("raw")}
                className="gap-1.5 h-7 text-xs font-mono"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Code / Raw</span>
              </Button>
            </div>

            <Select
              value={demo.status}
              onValueChange={(val) => updateMeta({ status: val as any })}
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            <Button asChild variant="default" size="sm" className="gap-1.5 h-8 font-mono text-xs">
              <Link href={`/demos/${demo.id}/play`}>
                <span>Play Demo</span>
                <Play className="h-3.5 w-3.5 fill-current" />
              </Link>
            </Button>
          </>
        }
      />

      {error && (
        <div className="border-b border-danger/40 bg-danger/10 px-6 py-2.5 font-mono text-xs text-danger text-center flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* --- REVIEWER VERIFICATION PROGRESS & BATCH ACTIONS HEADER BAR --- */}
      <div className="border-b border-hairline bg-surface/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-[280px] max-w-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${percentVerified === 100 ? 'text-verified' : 'text-cue'}`} />
              <span className="font-mono text-xs font-semibold text-text">
                Verification Progress:
              </span>
              <span className="font-mono text-xs font-bold text-cue">
                {verifiedCount} / {sortedSteps.length} steps verified ({percentVerified}%)
              </span>
            </div>
            <Progress value={percentVerified} className="h-2 flex-1 min-w-[100px]" />
          </div>

          <div className="flex items-center gap-2">
            {percentVerified === 100 ? (
              <Badge variant="verified" className="gap-1 font-mono text-xs py-1 px-3">
                <CheckCheck className="h-3.5 w-3.5 text-verified" />
                <span>100% Ready for Production</span>
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchMarkVerified}
                disabled={busy || verifiedCount === sortedSteps.length}
                className="gap-1.5 font-mono text-xs h-8 border-verified/50 text-verified hover:bg-verified/10"
              >
                <CheckCheck className="h-3.5 w-3.5 text-verified" />
                <span>Mark All Verified</span>
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handleApproveForProduction}
              disabled={busy || demo.status === "approved"}
              className="gap-1.5 font-mono text-xs h-8 shadow-md"
            >
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span>{demo.status === "approved" ? "Approved for Production" : "Approve Script for Production"}</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteScript}
              disabled={busy}
              className="gap-1.5 font-mono text-xs h-8 bg-red-950/80 hover:bg-red-900 border border-red-800/50 text-red-200"
              title="Delete this demo script"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Script</span>
            </Button>
          </div>
        </div>
      </div>

      {/* --- MODE 1: VISUAL STRUCTURED STEP EDITOR --- */}
      {viewMode === "visual" ? (
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-8">
          {/* Steps Rail */}
          <aside className="w-80 shrink-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs uppercase tracking-wide text-text-muted flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-cue" />
                <span>Demo Steps ({sortedSteps.length})</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addStep()}
                disabled={busy}
                className="text-cue hover:text-cue gap-1 h-7 font-mono text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Step</span>
              </Button>
            </div>

            <div className="space-y-2">
              {sortedSteps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                    s.id === selected?.id
                      ? "border-cue bg-surface-raised/90 shadow-md ring-1 ring-cue/30"
                      : "border-hairline bg-surface/50 hover:bg-surface-raised/50"
                  }`}
                >
                  <span className="mt-0.5 font-mono text-xs text-cue bg-cue/10 border border-cue/30 h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-text truncate">
                      {s.title}
                    </span>
                    <Badge variant="secondary" className="mt-1 font-mono text-[10px] uppercase py-0 px-1.5">
                      {s.action.type}
                    </Badge>
                  </div>

                  <StatusDot status={s.status as StepStatus} />
                </button>
              ))}
            </div>
          </aside>

          {/* Step Detail Card */}
          <main className="flex-1">
            {selected ? (
              <StepPanel
                key={selected.id}
                step={selected}
                index={sortedSteps.findIndex((s) => s.id === selected.id)}
                total={sortedSteps.length}
                onChange={(patch) => patchStep(selected.id, patch)}
                onDelete={() => deleteStep(selected.id)}
                onMove={(dir) => move(selected.id, dir)}
                onAddAfter={() => addStep(selected.id)}
              />
            ) : (
              <Card className="border-dashed border-hairline bg-surface/30 p-12 text-center text-text-muted">
                <CardContent className="flex flex-col items-center justify-center">
                  <FileText className="h-10 w-10 text-text-muted mb-3" />
                  <p>No steps available. Click &quot;+ Add Step&quot; to create one.</p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      ) : (
        /* --- MODE 2: RAW CODE / FORMAT VIEW (JSON, YAML, MD, TEXT, PLAYWRIGHT, PUPPETEER) --- */
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Card className="border-hairline bg-surface shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-hairline bg-surface-raised/40 py-4 px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-cue" />
                    <span>{demo.title}</span>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-text-muted mt-0.5">
                    Raw Script & Automated Test Spec Generator • Version {demo.version}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center rounded-lg border border-hairline bg-zinc-950 p-1 gap-1">
                  {(["json", "yaml", "markdown", "text", "playwright", "puppeteer"] as FormatType[]).map((f) => (
                    <Button
                      key={f}
                      variant={format === f ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setFormat(f);
                        setRawText(formatStepsToString(demo.steps, f));
                      }}
                      className="h-7 px-2.5 font-mono text-xs uppercase"
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <div className="flex flex-wrap items-center justify-between border-b border-hairline bg-zinc-950/60 px-6 py-3 gap-3">
              <span className="font-mono text-xs text-text-muted">
                Viewing <span className="text-cue font-bold uppercase">{format}</span> {["playwright", "puppeteer"].includes(format) ? "Automated E2E Test Script" : "Data Format"}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownloadFile}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 font-mono text-xs h-8 border-cue/40 text-cue hover:bg-cue hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Script File</span>
                </Button>

                {!["playwright", "puppeteer"].includes(format) && (
                  <Button
                    onClick={handleRawSave}
                    disabled={busy}
                    size="sm"
                    className="gap-1.5 font-mono text-xs h-8"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{busy ? "Saving..." : "Save Raw Script"}</span>
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="p-4 bg-zinc-950/90">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                readOnly={["playwright", "puppeteer"].includes(format)}
                rows={22}
                spellCheck={false}
                className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed text-text border-0 focus-visible:ring-0 p-2"
              />
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  );
}

function StepPanel({
  step,
  index,
  total,
  onChange,
  onDelete,
  onMove,
  onAddAfter,
}: {
  step: Step;
  index: number;
  total: number;
  onChange: (patch: Partial<Step>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddAfter: () => void;
}) {
  const [local, setLocal] = useState(step);
  const dirty = JSON.stringify(local) !== JSON.stringify(step);

  useEffect(() => {
    setLocal(step);
  }, [step]);

  function setAction(patch: Partial<Action>) {
    setLocal((l) => ({ ...l, action: { ...l.action, ...patch } }));
  }

  function handleSaveNotes(noteText: string) {
    if (!noteText.trim()) {
      setLocal((l) => ({ ...l, notes: "" }));
      return;
    }
    // Append timestamp if it's a new or modified note not already timestamped
    const dateStr = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const formattedNote = noteText.startsWith("[Reviewer") ? noteText : `[Reviewer - ${dateStr}]: ${noteText}`;
    setLocal((l) => ({ ...l, notes: formattedNote }));
  }

  return (
    <Card className="border-hairline bg-surface/70 backdrop-blur-sm p-6 shadow-xl space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-text-muted bg-zinc-950/60 border border-hairline px-2.5 py-1 rounded-md">
            Step {index + 1} of {total}
          </span>
          <StatusPill status={local.status as StepStatus} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="h-8 gap-1 font-mono text-xs"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Up</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="h-8 gap-1 font-mono text-xs"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>Down</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 text-danger hover:text-danger hover:bg-danger/10 gap-1 font-mono text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Fields Form */}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
            Step Title
          </label>
          <Input
            value={local.title}
            onChange={(e) => setLocal((l) => ({ ...l, title: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wide text-text-muted flex items-center gap-1.5">
            <span>🗣️ Spoken Narration — said aloud during this step</span>
          </label>
          <Textarea
            rows={3}
            value={local.narration}
            onChange={(e) => setLocal((l) => ({ ...l, narration: e.target.value }))}
            className="font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
              Action Type
            </label>
            <Select
              value={local.action.type}
              onValueChange={(val) => setAction({ type: val as ActionType })}
            >
              <SelectTrigger className="h-9 font-mono text-xs">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
              Target Element
            </label>
            <Input
              placeholder="e.g. 'Create Project' button"
              value={local.action.target}
              onChange={(e) => setAction({ target: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
              Value / Input
            </label>
            <Input
              placeholder="text to type / URL"
              value={local.action.value}
              onChange={(e) => setAction({ value: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
            Expected Outcome — how to verify this step worked
          </label>
          <Input
            value={local.expectedOutcome}
            onChange={(e) =>
              setLocal((l) => ({ ...l, expectedOutcome: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wide text-text-muted flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cue" />
            <span>Timestamped Reviewer Audit Notes</span>
          </label>
          <Textarea
            rows={2}
            value={local.notes}
            onChange={(e) => handleSaveNotes(e.target.value)}
            placeholder="Add timestamped reviewer comments or audit notes..."
            className="font-mono text-xs leading-relaxed"
          />
        </div>

        {step.sourceRef && (
          <Card className="border-hairline bg-zinc-950/60 p-4 space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted block">
              Source Documentation Reference
            </span>
            <p className="text-sm font-semibold text-cue flex items-center gap-1.5">
              <FileText className="h-4 w-4 shrink-0" />
              {step.sourceRef.docUrl ? (
                <a
                  href={step.sourceRef.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  <span>{step.sourceRef.docTitle}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>{step.sourceRef.docTitle}</span>
              )}
            </p>
            {step.sourceRef.excerpt && (
              <p className="border-l-2 border-cue pl-3 text-xs italic text-text-muted mt-1.5">
                &ldquo;{step.sourceRef.excerpt}&rdquo;
              </p>
            )}
          </Card>
        )}

        <Separator />

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => onChange(local)}
            disabled={!dirty}
            size="sm"
            className="gap-1.5 font-mono text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Step Changes</span>
          </Button>

          {local.status !== "verified" && (
            <Button
              onClick={() => onChange({ ...local, status: "verified" })}
              variant="verified"
              size="sm"
              className="gap-1.5 font-mono text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-verified" />
              <span>Mark Verified</span>
            </Button>
          )}

          <Button
            onClick={onAddAfter}
            variant="ghost"
            size="sm"
            className="ml-auto text-text-muted hover:text-cue gap-1 font-mono text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Step After</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
