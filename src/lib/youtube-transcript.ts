interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Cookie:
    "CONSENT=PENDING+987; SOCS=CAESEwgDEgk2ODE3MTcyNjQaAmVuIAEaBgiA_LyaBg",
};

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

  const srv3Regex =
    /<p[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = srv3Regex.exec(xml)) !== null) {
    let text = match[3];
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    let sText = "";
    while ((sMatch = sRegex.exec(text)) !== null) {
      sText += sMatch[1];
    }
    if (sText) text = sText;
    text = decodeEntities(text.replace(/<[^>]+>/g, "").trim());
    if (text) segments.push(text);
  }

  if (segments.length > 0) return segments;

  const stdRegex =
    /<text[^>]*\bstart="[\d.]+"[^>]*\bdur="[\d.]+"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = stdRegex.exec(xml)) !== null) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, "").trim());
    if (text) segments.push(text);
  }

  return segments;
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

// Method 1: ANDROID client — works from residential IPs
async function getTracksViaAndroidClient(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
          Cookie: YT_HEADERS.Cookie,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
            },
            thirdParty: {
              embedUrl: "https://www.google.com",
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    console.log("[transcript] ANDROID playability:", status);

    if (status !== "OK") return null;

    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null;
  } catch (e) {
    console.log("[transcript] ANDROID error:", (e as Error).message);
    return null;
  }
}

// Method 2: IOS client — different IP reputation
async function getTracksViaIosClient(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
          Cookie: YT_HEADERS.Cookie,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "IOS",
              clientVersion: "20.10.4",
              deviceMake: "Apple",
              deviceModel: "iPhone16,2",
              osName: "iPhone",
              osVersion: "18.3.2",
            },
            thirdParty: {
              embedUrl: "https://www.google.com",
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    console.log("[transcript] IOS playability:", status);

    if (status !== "OK") return null;

    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null;
  } catch (e) {
    console.log("[transcript] IOS error:", (e as Error).message);
    return null;
  }
}

// Method 3: HTML scrape — extract caption URLs from page HTML
async function getTracksViaHtmlScrape(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      {
        headers: {
          ...YT_HEADERS,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }
    );

    if (!res.ok) return null;

    const html = await res.text();
    console.log("[transcript] HTML length:", html.length);

    const marker = "ytInitialPlayerResponse";
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return null;

    const jsonStart = html.indexOf("{", startIdx);
    if (jsonStart === -1) return null;

    let depth = 0;
    let jsonEnd = jsonStart;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    let playerResponse;
    try {
      playerResponse = JSON.parse(html.slice(jsonStart, jsonEnd));
    } catch {
      return null;
    }

    console.log(
      "[transcript] HTML playability:",
      playerResponse?.playabilityStatus?.status
    );

    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null;
  } catch (e) {
    console.log("[transcript] HTML error:", (e as Error).message);
    return null;
  }
}

// Method 4: Direct timedtext API with various lang/kind combinations
async function getTranscriptViaTimedText(
  videoId: string
): Promise<string | null> {
  const langs = ["en", "en-US", "en-GB", ""];
  for (const lang of langs) {
    for (const kind of ["asr", ""]) {
      try {
        const params = new URLSearchParams({ v: videoId, lang, fmt: "srv3" });
        if (kind) params.set("kind", kind);

        const url = `https://www.youtube.com/api/timedtext?${params}`;
        const res = await fetch(url, { headers: YT_HEADERS });

        if (!res.ok) continue;
        const xml = await res.text();
        if (!xml || xml.length < 50) continue;

        const segments = parseTranscriptXml(xml);
        if (segments.length > 0) return segments.join(" ");
      } catch {
        continue;
      }
    }
  }
  return null;
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
    const res = await fetch(url, { headers: YT_HEADERS });
    if (!res.ok) return null;

    const xml = await res.text();
    if (!xml || xml.length < 50) return null;

    const segments = parseTranscriptXml(xml);
    return segments.length > 0 ? segments.join(" ") : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeTranscript(
  videoId: string
): Promise<string | null> {
  console.log("[transcript] Trying ANDROID client...");
  const androidTracks = await getTracksViaAndroidClient(videoId);
  if (androidTracks) {
    const text = await fetchTranscriptFromTracks(androidTracks);
    if (text) {
      console.log("[transcript] ANDROID client succeeded");
      return text;
    }
  }

  console.log("[transcript] Trying IOS client...");
  const iosTracks = await getTracksViaIosClient(videoId);
  if (iosTracks) {
    const text = await fetchTranscriptFromTracks(iosTracks);
    if (text) {
      console.log("[transcript] IOS client succeeded");
      return text;
    }
  }

  console.log("[transcript] Trying HTML scrape...");
  const htmlTracks = await getTracksViaHtmlScrape(videoId);
  if (htmlTracks) {
    const text = await fetchTranscriptFromTracks(htmlTracks);
    if (text) {
      console.log("[transcript] HTML scrape succeeded");
      return text;
    }
  }

  console.log("[transcript] Trying direct timedtext API...");
  const timedText = await getTranscriptViaTimedText(videoId);
  if (timedText) {
    console.log("[transcript] Timedtext API succeeded");
    return timedText;
  }

  console.log("[transcript] All server methods failed for:", videoId);
  return null;
}
