"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  UploadCloud,
  Globe,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
  Cpu,
  Layers,
} from "lucide-react";

interface PageInput {
  title: string;
  url: string;
  content: string;
}

interface ProgressStep {
  id: number;
  label: string;
  detail: string;
}

const STEPS_LIST: ProgressStep[] = [
  { id: 1, label: "Parsing & Validating Document Content", detail: "Reading source pages and preparing text buffers..." },
  { id: 2, label: "Chunking Content & Generating Vector Embeddings", detail: "Creating dense vectors using Gemini text-embedding-004..." },
  { id: 3, label: "Indexing Knowledge Base in MongoDB", detail: "Persisting vector chunks into database knowledge base..." },
  { id: 4, label: "Querying Vector Knowledge Base (RAG Retrieval)", detail: "Retrieving top relevant context matching demo focus..." },
  { id: 5, label: "Synthesizing Structured Demo Script", detail: "Drafting step narration, UI targets, and expected outcomes..." },
  { id: 6, label: "Script Complete!", detail: "Redirecting to interactive script editor..." },
];

const EMPTY_PAGE: PageInput = { title: "", url: "", content: "" };

export default function NewDemoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [focus, setFocus] = useState("");
  const [pages, setPages] = useState<PageInput[]>([{ ...EMPTY_PAGE }]);

  // Upload & Scraping states
  const [scrapingUrl, setScrapingUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Stepped progress loading state
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepDetail, setStepDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function updatePage(i: number, patch: Partial<PageInput>) {
    setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addPage() {
    setPages((prev) => [...prev, { ...EMPTY_PAGE }]);
  }

  function removePage(i: number) {
    setPages((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Handle Document Upload (.pdf, .txt, .md, .json)
  async function handleFileUpload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/scrape", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process uploaded file.");

      setPages((prev) => {
        if (prev.length === 1 && !prev[0].title && !prev[0].content) {
          return [{ title: data.title, url: data.url, content: data.content }];
        }
        return [...prev, { title: data.title, url: data.url, content: data.content }];
      });

      if (!title) {
        setTitle(`${data.title} Demo Script`);
      }
      toast.success(`Uploaded and extracted: ${data.title}`);
    } catch (err: any) {
      const msg = err.message || "File upload failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  // Handle URL Scraping
  async function handleUrlScrape() {
    if (!scrapingUrl.trim()) return;
    setIsScraping(true);
    setError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapingUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scrape URL.");

      setPages((prev) => {
        if (prev.length === 1 && !prev[0].title && !prev[0].content) {
          return [{ title: data.title, url: data.url, content: data.content }];
        }
        return [...prev, { title: data.title, url: data.url, content: data.content }];
      });

      if (!title) {
        setTitle(`${data.title} Demo`);
      }
      setScrapingUrl("");
      toast.success(`Scraped documentation page: ${data.title}`);
    } catch (err: any) {
      const msg = err.message || "URL scraping failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsScraping(false);
    }
  }

  // Handle Submission with Real-Time Stepped Loading SSE Stream
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanPages = pages
      .map((p) => ({ ...p, title: p.title.trim(), content: p.content.trim() }))
      .filter((p) => p.title && p.content);

    if (!title.trim()) {
      toast.error("Please give the demo a name.");
      return setError("Give the demo a name.");
    }
    if (cleanPages.length === 0) {
      toast.error("Add at least one documentation page or upload a document.");
      return setError("Add at least one documentation page or upload a document.");
    }

    setSubmitting(true);
    setActiveStep(1);
    setStepDetail("Initiating RAG pipeline...");

    try {
      const res = await fetch("/api/demos/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          customerName: customerName.trim(),
          focus: focus.trim() || undefined,
          pages: cleanPages,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to start streaming script generation.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.type === "progress") {
                setActiveStep(data.stepId);
                setStepDetail(data.detail);
              } else if (data.type === "complete") {
                setActiveStep(6);
                setStepDetail("Redirecting to editor...");
                toast.success("Demo script synthesized successfully!");
                setTimeout(() => {
                  router.push(`/demos/${data.demoId}`);
                }, 600);
                return;
              } else if (data.type === "error") {
                throw new Error(data.error || "Generation error.");
              }
            } catch (err: any) {
              if (err.message && err.message !== "Unexpected end of JSON input") {
                throw err;
              }
            }
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || "Something went wrong.";
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-ink text-zinc-100">
      <TopBar crumb="New Demo Generator" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-text">
            Generate a Demo Script with RAG
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Upload document files (.pdf, .txt, .md), auto-scrape web documentation URLs, or input source pages manually.
          </p>
        </div>

        {/* --- DOCUMENT UPLOADER & URL SCRAPER PANEL --- */}
        <Card className="mb-8 border-hairline bg-surface/70 backdrop-blur-sm shadow-lg overflow-hidden">
          <CardHeader className="border-b border-hairline bg-surface-raised/40 py-3.5 px-6">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cue" />
              <CardTitle className="text-sm font-mono uppercase tracking-wide text-cue">
                Import Documentation & Auto-Scrape
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-hairline bg-zinc-950/40 p-6 text-center transition-all hover:border-cue hover:bg-cue/5 cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.json,.html"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />
              <div className="h-12 w-12 rounded-xl bg-cue/10 border border-cue/30 flex items-center justify-center text-cue mb-3 group-hover:scale-110 transition-transform">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <p className="text-sm font-semibold text-text">
                {isUploading ? "Uploading & Extracting Text..." : "Click or Drag File to Upload"}
              </p>
              <span className="text-xs text-text-muted mt-1 font-mono">
                Supports PDF, TXT, Markdown (.md), JSON
              </span>
            </div>

            {/* URL Auto-Scraper */}
            <div className="flex flex-col justify-between rounded-xl border border-hairline bg-zinc-950/40 p-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-cue" />
                  <span className="font-mono text-xs text-text-muted uppercase">
                    Documentation URL Scraper
                  </span>
                </div>
                <Input
                  type="url"
                  value={scrapingUrl}
                  onChange={(e) => setScrapingUrl(e.target.value)}
                  placeholder="https://docs.example.com/getting-started"
                  className="text-sm"
                />
              </div>

              <Button
                type="button"
                onClick={handleUrlScrape}
                disabled={isScraping || !scrapingUrl.trim()}
                variant="outline"
                className="mt-4 border-cue/40 text-cue hover:bg-cue hover:text-ink gap-2 font-mono text-xs"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Scraping Web Page...</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    <span>Auto-Scrape Web Page</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --- FORM SECTION --- */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-hairline bg-surface/70 backdrop-blur-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
                  Demo Name *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Acme Corp — Q3 Renewal Demo"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
                  Customer (optional)
                </label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wide text-text-muted">
                Emphasize Focus / Objectives (optional)
              </label>
              <Input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="They care most about permissions, role-based access control, and audit logs"
              />
            </div>
          </Card>

          {/* Source Pages Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cue" />
                <span className="font-mono text-xs uppercase tracking-wide text-text-muted">
                  Source Pages ({pages.length})
                </span>
              </div>
              <Button
                type="button"
                onClick={addPage}
                variant="ghost"
                size="sm"
                className="text-cue hover:text-cue gap-1.5 font-mono text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Page Manually</span>
              </Button>
            </div>

            <div className="space-y-4">
              {pages.map((p, i) => (
                <Card key={i} className="border-hairline bg-surface/80 p-5 space-y-4 relative">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-cue bg-cue/10 border border-cue/30 h-6 w-6 rounded-full flex items-center justify-center font-bold shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Input
                      value={p.title}
                      onChange={(e) => updatePage(i, { title: e.target.value })}
                      placeholder="Page title, e.g. 'Setting up user permissions'"
                      className="flex-1"
                    />
                    {pages.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removePage(i)}
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:text-danger hover:bg-danger/10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <Input
                    value={p.url}
                    onChange={(e) => updatePage(i, { url: e.target.value })}
                    placeholder="Source URL or File Name"
                  />

                  <Textarea
                    value={p.content}
                    onChange={(e) => updatePage(i, { content: e.target.value })}
                    placeholder="Document text content will appear here..."
                    rows={5}
                    className="font-mono text-xs leading-relaxed"
                  />
                </Card>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="w-full gap-2 text-base font-semibold shadow-lg shadow-cue/15"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing RAG Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 fill-current" />
                  <span>Build Demo Script</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* --- STEPPED PROGRESS LOADING OVERLAY DIALOG --- */}
        {submitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <Card className="w-full max-w-lg border-hairline bg-surface p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cue opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cue"></span>
                  </span>
                  <h3 className="font-display font-semibold text-lg text-text">
                    Building Demo Script
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {STEPS_LIST.map((step) => {
                  const isDone = activeStep > step.id;
                  const isCurrent = activeStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3.5 rounded-xl p-3.5 transition-all ${
                        isCurrent
                          ? "bg-cue/10 border border-cue/40 shadow-sm"
                          : isDone
                          ? "bg-surface-raised/40 opacity-80"
                          : "opacity-40"
                      }`}
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-cue" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cue" />
                        ) : (
                          <span className="text-text-muted">{step.id}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm font-medium ${
                            isCurrent
                              ? "text-cue"
                              : isDone
                              ? "text-text"
                              : "text-text-muted"
                          }`}
                        >
                          {step.label}
                        </span>
                        {isCurrent && (
                          <span className="text-xs text-text-muted mt-1 animate-pulse">
                            {stepDetail || step.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Progress value={(activeStep / STEPS_LIST.length) * 100} className="h-2" />
                <p className="text-right font-mono text-[11px] text-text-muted">
                  Step {activeStep} of {STEPS_LIST.length}
                </p>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
