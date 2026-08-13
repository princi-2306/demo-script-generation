import Link from "next/link";
import { Clapperboard, ChevronRight, Sparkles } from "lucide-react";

export function TopBar({
  crumb,
  right,
}: {
  crumb?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-[15px] font-bold tracking-tight text-text hover:text-cue transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cue/10 border border-cue/30 text-cue shadow-sm">
              <Clapperboard className="h-4 w-4" />
            </div>
            <span>Demo Script Builder</span>
          </Link>
          {crumb && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <ChevronRight className="h-3.5 w-3.5 text-hairline" />
              <span className="font-mono text-xs text-cue max-w-[200px] truncate sm:max-w-none">
                {crumb}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
