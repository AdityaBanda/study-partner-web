"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface DiagramViewerProps {
  mermaidCode: string;
  onNodeClick?: (nodeText: string) => void;
}

export function DiagramViewer({ mermaidCode, onNodeClick }: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNodeClick = useCallback(
    (e: MouseEvent) => {
      if (!onNodeClick) return;

      const target = e.target as SVGElement;
      const node = target.closest<SVGElement>(".mindmap-node, .node, [class*='node']");
      if (!node) return;

      const textEl = node.querySelector("text, foreignObject span, foreignObject div");
      if (!textEl) return;

      const text = (textEl.textContent || "").trim();
      if (text) onNodeClick(text);
    },
    [onNodeClick]
  );

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

          // Make nodes interactive
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl && onNodeClick) {
            const nodes = svgEl.querySelectorAll<SVGElement>(
              ".mindmap-node, .node, [class*='node']"
            );
            nodes.forEach((node) => {
              node.style.cursor = "pointer";
              node.addEventListener("mouseenter", () => {
                node.style.filter = "brightness(1.3)";
              });
              node.addEventListener("mouseleave", () => {
                node.style.filter = "";
              });
            });
            svgEl.addEventListener("click", handleNodeClick);
          }
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
      const svgEl = containerRef.current?.querySelector("svg");
      if (svgEl) svgEl.removeEventListener("click", handleNodeClick);
    };
  }, [mermaidCode, onNodeClick, handleNodeClick]);

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
