import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Demo Script Builder",
  description: "Turn scraped documentation into a reviewable, agent-runnable demo script.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.performance && window.performance.measure) {
                var _origMeasure = window.performance.measure;
                window.performance.measure = function(name, startMark, endMark) {
                  try {
                    return _origMeasure.call(this, name, startMark, endMark);
                  } catch(e) {}
                };
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-text">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
