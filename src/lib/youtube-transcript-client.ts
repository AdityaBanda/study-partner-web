interface TranscriptResult {
  text: string;
  videoId: string;
}

export async function fetchTranscriptClientSide(
  videoId: string
): Promise<TranscriptResult | null> {
  // Primary: use our edge API route (runs on CDN edge nodes, different IPs)
  try {
    const res = await fetch(`/api/transcript?v=${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.transcript) {
        return { text: data.transcript, videoId };
      }
    }
  } catch {
    // Fall through to next method
  }

  return null;
}
