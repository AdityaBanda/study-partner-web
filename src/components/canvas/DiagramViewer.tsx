"use client";

import { useEffect, useRef, useState } from "react";

export function DiagramViewer({ mermaidCode }: { mermaidCode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !mermaidCode) return;

    let cancelled = false;

    async function renderDiagram() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#3b82f6",
          primaryTextColor: "#fff",
          primaryBorderColor: "#60a5fa",
          lineColor: "#6b7280",
          secondaryColor: "#1e1e1e",
          tertiaryColor: "#252525",
        },
      });

      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to render diagram");
          console.error("Mermaid render error:", err);
        }
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [mermaidCode]);

  if (error) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <p className="text-destructive mb-2">{error}</p>
        <pre className="text-xs text-muted overflow-auto p-4 bg-background rounded-lg">
          {mermaidCode}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border overflow-auto">
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}
