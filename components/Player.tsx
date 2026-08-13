"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Step } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Zap,
  CheckCircle2,
  Volume2,
  Target,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Layers,
  Play,
} from "lucide-react";

interface DemoData {
  id: string;
  title: string;
  steps: Step[];
}

const ACTION_LABEL: Record<string, string> = {
  navigate: "Navigate to URL",
  click: "Click Element",
  input: "Type Text Input",
  highlight: "Highlight / Point Out",
  wait: "Wait / Pause",
  say: "Speak Narration",
  scroll: "Scroll Viewport",
};

export function Player({ demo }: { demo: DemoData }) {
  const steps = useMemo(() => [...demo.steps].sort((a, b) => a.order - b.order), [demo]);
  const [index, setIndex] = useState(0);
  const [executedSteps, setExecutedSteps] = useState<Set<string>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const step = steps[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  if (!step) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-ink text-text-muted p-8 text-center">
        <Card className="max-w-md border-hairline bg-surface p-8 space-y-4">
          <Layers className="h-12 w-12 text-cue mx-auto" />
          <h2 className="text-xl font-bold text-text">No Steps Available</h2>
          <p className="text-sm text-text-muted">This demo script has no steps yet.</p>
          <Button asChild variant="default" className="gap-2">
            <Link href={`/demos/${demo.id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Review Editor</span>
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isCurrentExecuted = executedSteps.has(step.id);

  // Execute Step simulator
  async function handleExecuteStep() {
    if (isExecuting) return;
    setIsExecuting(true);
    const toastId = toast.loading(`Executing ${step.action.type.toUpperCase()} action...`);

    // Simulate agent action execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setExecutedSteps((prev) => new Set(prev).add(step.id));
    setIsExecuting(false);
    toast.success(`Action executed successfully on target "${step.action.target || 'element'}"!`, {
      id: toastId,
    });
  }

  function handleSpeakNarration() {
    if (!step.narration || typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(step.narration);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
    toast.info("Speaking narration...");
  }

  return (
    <div className="flex flex-1 flex-col bg-ink min-h-screen text-zinc-100">
      {/* Top Navigation Header */}
      <header className="flex items-center justify-between border-b border-hairline bg-surface/80 backdrop-blur-md px-6 py-3.5 shrink-0">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-cue hover:text-cue font-mono text-xs">
          <Link href={`/demos/${demo.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Editor</span>
          </Link>
        </Button>

        <div className="text-center">
          <h2 className="font-display text-sm font-bold text-text">
            {demo.title}
          </h2>
          <span className="font-mono text-[11px] text-text-muted flex items-center justify-center gap-1.5 mt-0.5">
            <span className="h-2 w-2 rounded-full bg-cue animate-pulse" />
            <span>Interactive Playback Mode</span>
          </span>
        </div>

        <Badge variant="default" className="font-mono text-xs py-1 px-3">
          Step {index + 1} of {steps.length}
        </Badge>
      </header>

      {/* Main Container: Left Stack Rail + Complete Right Execution View */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-[calc(100vh-57px)]">
        {/* LEFT STACK RAIL OF STEPS */}
        <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-hairline bg-surface/40 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-mono text-xs uppercase tracking-wide text-text-muted flex items-center gap-1.5 font-semibold">
              <Layers className="h-4 w-4 text-cue" />
              <span>Demo Steps Stack ({steps.length})</span>
            </span>
            <span className="font-mono text-[11px] text-cue font-bold">
              {executedSteps.size} / {steps.length} Done
            </span>
          </div>

          <div className="space-y-2">
            {steps.map((s, idx) => {
              const isDone = executedSteps.has(s.id);
              const isCurrent = idx === index;

              return (
                <button
                  key={s.id}
                  onClick={() => setIndex(idx)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isCurrent
                      ? "border-cue bg-surface-raised shadow-lg ring-1 ring-cue/40"
                      : isDone
                      ? "border-verified/40 bg-zinc-950/60 hover:bg-surface-raised/40"
                      : "border-hairline bg-surface/30 hover:bg-surface-raised/40 opacity-80"
                  }`}
                >
                  <span
                    className={`mt-0.5 font-mono text-xs h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      isDone
                        ? "bg-verified/20 text-verified border border-verified/50"
                        : isCurrent
                        ? "bg-cue text-ink font-extrabold"
                        : "bg-surface-raised text-text-muted border border-hairline"
                    }`}
                  >
                    {isDone ? "✓" : String(idx + 1).padStart(2, "0")}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={`block text-xs font-semibold leading-tight truncate ${isCurrent ? 'text-text' : 'text-text-muted'}`}>
                      {s.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="font-mono text-[9px] uppercase py-0 px-1.5">
                        {s.action.type}
                      </Badge>
                      {isDone && (
                        <span className="font-mono text-[10px] text-verified font-medium">Executed</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT EXECUTION FULL VIEW */}
        <main className="flex-1 flex flex-col justify-between overflow-y-auto p-6 md:p-8 bg-ink">
          <Card className="border-hairline bg-surface/80 backdrop-blur-md p-8 shadow-2xl space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Action Badge Header */}
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    {isExecuting ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cue opacity-75"></span>
                    ) : null}
                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isCurrentExecuted ? 'bg-verified' : 'bg-cue'}`}></span>
                  </span>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-cue flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    <span>{ACTION_LABEL[step.action.type] ?? step.action.type}</span>
                  </span>
                </div>

                {isCurrentExecuted ? (
                  <Badge variant="verified" className="gap-1 font-mono text-xs py-1 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-verified" />
                    <span>Executed & Verified</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-mono text-xs py-1 px-3">
                    Step {index + 1} of {steps.length}
                  </Badge>
                )}
              </div>

              {/* Step Title */}
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-text">
                {step.title}
              </h1>

              {/* Action Target & Value */}
              {(step.action.target || step.action.value) && (
                <div className="flex flex-wrap gap-4 rounded-xl border border-hairline bg-zinc-950/70 p-4 font-mono text-xs">
                  {step.action.target && (
                    <div>
                      <span className="text-text-muted block uppercase text-[10px] mb-1 font-semibold flex items-center gap-1">
                        <Target className="h-3 w-3 text-cue" />
                        <span>Target Element:</span>
                      </span>
                      <Badge variant="default" className="font-mono text-xs py-1 px-2.5 font-semibold">
                        [{step.action.target}]
                      </Badge>
                    </div>
                  )}
                  {step.action.value && (
                    <div>
                      <span className="text-text-muted block uppercase text-[10px] mb-1 font-semibold">Value / Input:</span>
                      <Badge variant="secondary" className="font-mono text-xs py-1 px-2.5">
                        {step.action.value}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Spoken Narration Card */}
              {step.narration && (
                <Card className="border-hairline bg-surface-raised/60 p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted flex items-center gap-1.5 font-semibold">
                      <Volume2 className="h-3.5 w-3.5 text-cue" />
                      <span>Spoken Narration</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSpeakNarration}
                      className="h-7 gap-1 font-mono text-[11px] border-cue/30 text-cue hover:bg-cue hover:text-ink"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>{isSpeaking ? "Stop Speaking" : "Play Narration Voice"}</span>
                    </Button>
                  </div>
                  <p className="text-base md:text-lg leading-relaxed text-text italic">
                    &ldquo;{step.narration}&rdquo;
                  </p>
                </Card>
              )}

              {/* Expected Outcome */}
              {step.expectedOutcome && (
                <Card className="border-hairline bg-zinc-950/50 p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted block mb-1 font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-cue" />
                    <span>Expected Outcome & Verification</span>
                  </span>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {step.expectedOutcome}
                  </p>
                </Card>
              )}
            </div>

            {/* Execute Step Button */}
            <div className="pt-6 border-t border-hairline flex justify-center">
              <Button
                onClick={handleExecuteStep}
                disabled={isExecuting}
                size="lg"
                variant={isCurrentExecuted ? "outline" : "default"}
                className={`w-full max-w-lg gap-2 font-mono text-sm font-semibold shadow-xl py-6 ${
                  isCurrentExecuted ? "border-verified text-verified hover:bg-verified/10" : "shadow-cue/20"
                }`}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Executing Action...</span>
                  </>
                ) : isCurrentExecuted ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-verified" />
                    <span>Re-Execute Step</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 fill-current text-ink" />
                    <span>Execute Step Action</span>
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Navigation Controls Footer */}
          <footer className="pt-6 flex items-center justify-between">
            <Button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              variant="outline"
              size="sm"
              className="gap-1.5 font-mono text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous Step</span>
            </Button>

            <span className="font-mono text-xs text-text-muted hidden sm:inline">
              Use <kbd className="px-1.5 py-0.5 rounded bg-surface-raised border border-hairline text-text">←</kbd> and <kbd className="px-1.5 py-0.5 rounded bg-surface-raised border border-hairline text-text">→</kbd> arrow keys to navigate
            </span>

            <Button
              onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
              disabled={index === steps.length - 1}
              variant="default"
              size="sm"
              className="gap-1.5 font-mono text-xs"
            >
              <span>Next Step</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}
