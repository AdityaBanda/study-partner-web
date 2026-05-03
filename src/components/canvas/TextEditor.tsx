"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchTranscriptClientSide } from "@/lib/youtube-transcript-client";

const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function getYouTubeId(text: string): string | null {
  const match = text.trim().match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

export function TextEditor() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const youtubeId = useMemo(() => getYouTubeId(content), [content]);
  const isYoutube = youtubeId !== null;

  const handleGenerate = async () => {
    if (!content.trim()) {
      setError("Please enter some content first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      let endpoint: string;
      let body: Record<string, string>;

      if (isYoutube && youtubeId) {
        setStatus("Extracting transcript from YouTube...");
        const result = await fetchTranscriptClientSide(youtubeId);

        if (!result) {
          throw new Error(
            "Could not extract transcript. The video may not have captions available. Try a video with subtitles, or copy the content manually."
          );
        }

        setStatus("Generating mindmap, explanations & quiz...");
        endpoint = "/api/generate/all";
        body = {
          title: title.trim() || "YouTube Video",
          content: `[YouTube Video Transcript]\n\n${result.text}`,
        };
      } else {
        setStatus("Generating mindmap, explanations & quiz...");
        endpoint = "/api/generate/all";
        body = {
          title: title.trim() || "Untitled Document",
          content: content.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setStatus(null);
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

      {isYoutube && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden bg-background">
            <img
              src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.56 9.38.56 9.38.56s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8z"/>
                <path d="M9.75 15.02l6.28-3.02-6.28-3.02v6.04z" fill="white"/>
              </svg>
              <span className="text-sm font-medium text-foreground">YouTube video detected</span>
            </div>
            <p className="text-xs text-muted">
              The transcript will be extracted automatically and used to generate a mind map, explanations, and quiz.
            </p>
          </div>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={"Paste a YouTube URL or type your study content here...\n\nExamples:\n- https://www.youtube.com/watch?v=...\n- Any technical content or notes\n\nThe AI will generate:\n- A visual mind map diagram\n- PM-friendly concept explanations\n- Quiz questions to test your understanding"}
        className="w-full min-h-[400px] bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted resize-y focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm leading-relaxed"
      />
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
      {status && loading && (
        <p className="text-accent text-sm">{status}</p>
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
            {isYoutube ? "Extracting & Generating..." : "Generating..."}
          </span>
        ) : isYoutube ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.56 9.38.56 9.38.56s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8z"/>
              <path d="M9.75 15.02l6.28-3.02-6.28-3.02v6.04z" fill="white"/>
            </svg>
            Generate from YouTube
          </span>
        ) : (
          "Generate Diagram & Quiz"
        )}
      </button>
    </div>
  );
}
