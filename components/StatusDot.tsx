import { StepStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Edit3, Sparkles } from "lucide-react";

const COLORS: Record<StepStatus, string> = {
  generated: "#94a3b8",
  edited: "#6366f1",
  verified: "#10b981",
};

const LABELS: Record<StepStatus, string> = {
  generated: "Generated — not yet reviewed",
  edited: "Edited by a reviewer",
  verified: "Verified",
};

export function StatusDot({
  status,
  live = false,
}: {
  status: StepStatus;
  live?: boolean;
}) {
  return (
    <span
      className={`cue-dot ${live ? "is-live" : ""}`}
      style={{ background: COLORS[status] || COLORS.generated }}
      title={LABELS[status]}
      aria-label={LABELS[status]}
    />
  );
}

export function StatusPill({ status }: { status: StepStatus }) {
  const Icon = status === "verified" ? CheckCircle2 : status === "edited" ? Edit3 : Sparkles;
  
  return (
    <Badge variant={status}>
      <Icon className="h-3 w-3" />
      <span>{status}</span>
    </Badge>
  );
}
