interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

// Consent cookie bypasses YouTube's GDPR/consent wall on datacenter IPs
const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Cookie: "CONSENT=PENDING+987; SOCS=CAESEwgDEgk2ODE3MTcyNjQaAmVuIAEaBgiA_LyaBg",
};

// ANDROID client with embedUrl — bypasses LOGIN_REQUIRED on datacenter IPs
async function getTracksViaAndroidEmbed(
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

    if (!res.ok) {
      console.log("[transcript] Android embed status:", res.status);
      return null;
    }

    const data = await res.json();
    console.log(
      "[transcript] Android embed playability:",
      data?.playabilityStatus?.status
    );
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (Array.isArray(tracks) && tracks.length > 0) {
      return tracks;
    }
    return null;
  } catch (e) {
    console.log("[transcript] Android embed error:", (e as Error).message);
    return null;
  }
}

// Method 2: Scrape the YouTube watch page HTML for embedded player data
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

    if (!res.ok) {
      console.log("[transcript] HTML scrape status:", res.status);
      return null;
    }

    const html = await res.text();
    console.log(
      "[transcript] HTML page length:",
      html.length,
      "has consent form:",
      html.includes("consent.youtube.com")
    );

    // Extract ytInitialPlayerResponse from the HTML
    // The JSON is huge with nested braces, so we find the start and parse forward
    const marker = "ytInitialPlayerResponse";
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) {
      console.log("[transcript] No ytInitialPlayerResponse in HTML");
      return null;
    }

    const jsonStart = html.indexOf("{", startIdx);
    if (jsonStart === -1) return null;

    // Find the matching closing brace by counting depth
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
      console.log("[transcript] Failed to parse ytInitialPlayerResponse");
      return null;
    }
    console.log(
      "[transcript] HTML playability:",
      playerResponse?.playabilityStatus?.status
    );
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;

    if (Array.isArray(tracks) && tracks.length > 0) {
      return tracks;
    }
    console.log("[transcript] HTML scrape: no caption tracks found");
    return null;
  } catch (e) {
    console.log("[transcript] HTML scrape error:", (e as Error).message);
    return null;
  }
}

// Method 3: Fetch the watch page, extract a timedtext URL, adapt it
async function getTranscriptViaEmbedPage(
  videoId: string
): Promise<string | null> {
  try {
    // Try the embed page which is less restricted
    const res = await fetch(
      `https://www.youtube.com/embed/${videoId}`,
      { headers: YT_HEADERS }
    );
    if (!res.ok) return null;

    const html = await res.text();

    // Extract caption tracks from embed page config
    const configMatch = html.match(
      /"captions":\s*(\{"playerCaptionsTracklistRenderer":\{[^}]+\}\})/
    );

    if (!configMatch) {
      // Try extracting any timedtext URL
      const urlMatch = html.match(
        /https:\/\/www\.youtube\.com\/api\/timedtext[^"\\]+/
      );
      if (urlMatch) {
        const captionUrl =
          urlMatch[0].replace(/\\u0026/g, "&") + "&fmt=srv3";
        console.log("[transcript] Found timedtext URL in embed");
        const captRes = await fetch(captionUrl, { headers: YT_HEADERS });
        if (captRes.ok) {
          const xml = await captRes.text();
          const segments = parseTranscriptXml(xml);
          if (segments.length > 0) return segments.join(" ");
        }
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

// Method 4: Direct timedtext API with various lang/kind combinations
async function getTranscriptViaTimedText(
  videoId: string
): Promise<string | null> {
  try {
    const langs = ["en", "en-US", "en-GB", ""];
    for (const lang of langs) {
      for (const kind of ["asr", ""]) {
        const params = new URLSearchParams({
          v: videoId,
          lang: lang,
          fmt: "srv3",
        });
        if (kind) params.set("kind", kind);

        const url = `https://www.youtube.com/api/timedtext?${params}`;
        const res = await fetch(url, { headers: YT_HEADERS });

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

  const srv3Regex =
    /<p[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = srv3Regex.exec(xml)) !== null) {
    const text = decodeEntities(match[3].replace(/<[^>]+>/g, "").trim());
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

    if (!res.ok) {
      console.log("[transcript] Caption fetch status:", res.status);
      return null;
    }

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
  // Method 1: ANDROID client with embedUrl (bypasses LOGIN_REQUIRED)
  console.log("[transcript] Trying Android embed...");
  const androidEmbedTracks = await getTracksViaAndroidEmbed(videoId);
  if (androidEmbedTracks) {
    const text = await fetchTranscriptFromTracks(androidEmbedTracks);
    if (text) {
      console.log("[transcript] Android embed succeeded");
      return text;
    }
  }

  // Method 2: HTML scrape
  console.log("[transcript] Trying HTML scrape...");
  const htmlTracks = await getTracksViaHtmlScrape(videoId);
  if (htmlTracks) {
    const text = await fetchTranscriptFromTracks(htmlTracks);
    if (text) {
      console.log("[transcript] HTML scrape succeeded");
      return text;
    }
  }

  // Method 4: Embed page HTML
  console.log("[transcript] Trying embed page...");
  const embedResult = await getTranscriptViaEmbedPage(videoId);
  if (embedResult) {
    console.log("[transcript] Embed page succeeded");
    return embedResult;
  }

  // Method 5: Direct timedtext API
  console.log("[transcript] Trying direct timedtext API...");
  const timedTextResult = await getTranscriptViaTimedText(videoId);
  if (timedTextResult) {
    console.log("[transcript] Timedtext API succeeded");
    return timedTextResult;
  }

  console.log("[transcript] All methods failed for:", videoId);
  return null;
}
