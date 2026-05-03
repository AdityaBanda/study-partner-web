interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

const CLIENT_VERSION = "20.10.38";

async function getCaptionTracks(
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

function selectTrack(tracks: CaptionTrack[]): CaptionTrack {
  const preferred = ["en", "en-US", "en-GB"];
  for (const lang of preferred) {
    const track = tracks.find((t) => t.languageCode === lang);
    if (track) return track;
  }
  const enTrack = tracks.find((t) => t.languageCode.startsWith("en"));
  if (enTrack) return enTrack;
  // Prefer ASR (auto-generated) tracks as they tend to be in the video's language
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

export async function fetchYouTubeTranscript(
  videoId: string
): Promise<string | null> {
  const tracks = await getCaptionTracks(videoId);
  if (!tracks) return null;

  const track = selectTrack(tracks);
  let url = track.baseUrl;

  if (!url.includes("fmt=")) {
    url += (url.includes("?") ? "&" : "?") + "fmt=srv3";
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)",
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
