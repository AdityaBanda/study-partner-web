"use client";

import { useEffect, useRef, useState } from "react";

interface DiagramViewerProps {
  mermaidCode: string;
  onNodeClick?: (nodeText: string) => void;
}

function extractNodeText(node: Element): string {
  // Try foreignObject spans first (markdown labels)
  const spans = node.querySelectorAll(
    "foreignObject span, foreignObject div"
  );
  if (spans.length > 0) {
    const parts: string[] = [];
    spans.forEach((s) => {
      const t = (s.textContent || "").trim();
      if (t) parts.push(t);
    });
    const text = parts.join(" ").trim();
    if (text) return text;
  }

  // Try text elements
  const textEl = node.querySelector("text");
  if (textEl) {
    const t = (textEl.textContent || "").trim();
    if (t) return t;
  }

  // Last resort: all text content
  return (node.textContent || "").trim();
}

export function DiagramViewer({ mermaidCode, onNodeClick }: DiagramViewerProps) {
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
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        setError(null);

        if (!onNodeClick) return;

        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        // Find all mindmap nodes by class
        const nodes = svgEl.querySelectorAll<SVGGElement>(".mindmap-node");

        nodes.forEach((node) => {
          // Style as clickable
          node.style.cursor = "pointer";
          node.style.transition = "filter 0.15s ease";

          node.addEventListener("mouseenter", () => {
            node.style.filter = "brightness(1.4) drop-shadow(0 0 6px rgba(96,165,250,0.4))";
          });
          node.addEventListener("mouseleave", () => {
            node.style.filter = "";
          });
          node.addEventListener("click", (e) => {
            e.stopPropagation();
            const text = extractNodeText(node);
            if (text) onNodeClick(text);
          });
        });

        // If no mindmap-node classes, try generic node groups (for flowcharts)
        if (nodes.length === 0) {
          const genericNodes = svgEl.querySelectorAll<SVGGElement>(
            ".node, [class*='node default'], [id^='node_']"
          );
          genericNodes.forEach((node) => {
            node.style.cursor = "pointer";
            node.style.transition = "filter 0.15s ease";

            node.addEventListener("mouseenter", () => {
              node.style.filter = "brightness(1.4) drop-shadow(0 0 6px rgba(96,165,250,0.4))";
            });
            node.addEventListener("mouseleave", () => {
              node.style.filter = "";
            });
            node.addEventListener("click", (e) => {
              e.stopPropagation();
              const text = extractNodeText(node);
              if (text) onNodeClick(text);
            });
          });
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
  }, [mermaidCode, onNodeClick]);

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
