interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

const CLIENT_VERSION = "20.10.38";

// Method 1: InnerTube player API (ANDROID client)
async function getTracksViaInnerTube(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: CLIENT_VERSION,
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (Array.isArray(tracks) && tracks.length > 0) {
      return tracks;
    }
    return null;
  } catch {
    return null;
  }
}

// Method 2: Scrape the YouTube watch page HTML for embedded player data
async function getTracksViaHtmlScrape(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Extract ytInitialPlayerResponse from the HTML
    const match = html.match(
      /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|<\/script>)/
    );
    if (!match) return null;

    const playerResponse = JSON.parse(match[1]);
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;

    if (Array.isArray(tracks) && tracks.length > 0) {
      return tracks;
    }
    return null;
  } catch {
    return null;
  }
}

// Method 3: Use the /oembed + timedtext endpoint (no auth needed)
async function getTranscriptViaTimedText(
  videoId: string
): Promise<string | null> {
  try {
    // The timedtext API can be called directly with the video ID for auto-captions
    const langs = ["en", "en-US", "en-GB", ""];
    for (const lang of langs) {
      const params = new URLSearchParams({
        v: videoId,
        lang: lang,
        fmt: "srv3",
      });
      // Also try with kind=asr for auto-generated captions
      for (const kind of ["asr", ""]) {
        if (kind) params.set("kind", kind);
        else params.delete("kind");

        const url = `https://www.youtube.com/api/timedtext?${params}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        if (!res.ok) continue;
        const xml = await res.text();
        if (!xml || xml.length < 50) continue;

        const segments = parseTranscriptXml(xml);
        if (segments.length > 0) {
          return segments.join(" ");
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function selectTrack(tracks: CaptionTrack[]): CaptionTrack {
  const preferred = ["en", "en-US", "en-GB"];
  for (const lang of preferred) {
    const track = tracks.find((t) => t.languageCode === lang);
    if (track) return track;
  }
  const enTrack = tracks.find((t) => t.languageCode.startsWith("en"));
  if (enTrack) return enTrack;
  const asrTrack = tracks.find((t) => t.kind === "asr");
  if (asrTrack) return asrTrack;
  return tracks[0];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n/g, " ");
}

function parseTranscriptXml(xml: string): string[] {
  const segments: string[] = [];

  // Handle srv3 format: <p t="ms" d="ms">text</p>
  const srv3Regex =
    /<p[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = srv3Regex.exec(xml)) !== null) {
    const text = decodeEntities(match[3].replace(/<[^>]+>/g, "").trim());
    if (text) segments.push(text);
  }

  if (segments.length > 0) return segments;

  // Handle standard format: <text start="s" dur="s">text</text>
  const stdRegex =
    /<text[^>]*\bstart="[\d.]+"[^>]*\bdur="[\d.]+"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = stdRegex.exec(xml)) !== null) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, "").trim());
    if (text) segments.push(text);
  }

  return segments;
}

async function fetchTranscriptFromTracks(
  tracks: CaptionTrack[]
): Promise<string | null> {
  const track = selectTrack(tracks);
  let url = track.baseUrl;

  if (!url.includes("fmt=")) {
    url += (url.includes("?") ? "&" : "?") + "fmt=srv3";
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;

    const xml = await res.text();
    const segments = parseTranscriptXml(xml);

    if (segments.length === 0) return null;
    return segments.join(" ");
  } catch {
    return null;
  }
}

export async function fetchYouTubeTranscript(
  videoId: string
): Promise<string | null> {
  // Try Method 1: InnerTube API
  console.log("[transcript] Trying InnerTube API...");
  const innerTubeTracks = await getTracksViaInnerTube(videoId);
  if (innerTubeTracks) {
    const text = await fetchTranscriptFromTracks(innerTubeTracks);
    if (text) {
      console.log("[transcript] InnerTube succeeded");
      return text;
    }
  }

  // Try Method 2: HTML scrape
  console.log("[transcript] Trying HTML scrape...");
  const htmlTracks = await getTracksViaHtmlScrape(videoId);
  if (htmlTracks) {
    const text = await fetchTranscriptFromTracks(htmlTracks);
    if (text) {
      console.log("[transcript] HTML scrape succeeded");
      return text;
    }
  }

  // Try Method 3: Direct timedtext API
  console.log("[transcript] Trying direct timedtext API...");
  const timedTextResult = await getTranscriptViaTimedText(videoId);
  if (timedTextResult) {
    console.log("[transcript] Timedtext API succeeded");
    return timedTextResult;
  }

  console.log("[transcript] All methods failed for:", videoId);
  return null;
}
