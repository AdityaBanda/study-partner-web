"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TextEditor() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!content.trim()) {
      setError("Please enter some content first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate/all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Document",
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await response.json();
      router.push(`/dashboard/canvas?doc=${data.documentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title..."
        className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste or type your study content here...&#10;&#10;The AI will analyze it and generate:&#10;- A visual flowchart diagram&#10;- PM-friendly concept explanations&#10;- Quiz questions to test your understanding"
        className="w-full min-h-[400px] bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted resize-y focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm leading-relaxed"
      />
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading || !content.trim()}
        className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </span>
        ) : (
          "Generate Diagram & Quiz"
        )}
      </button>
    </div>
  );
}
