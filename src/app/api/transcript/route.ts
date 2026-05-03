import { NextResponse } from "next/server";

export const runtime = "edge";

const CONSENT_COOKIE =
  "CONSENT=PENDING+987; SOCS=CAESEwgDEgk2ODE3MTcyNjQaAmVuIAEaBgiA_LyaBg";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
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
  return tracks[0];
}

async function tryInnerTube(
  videoId: string,
  clientName: string,
  clientVersion: string,
  userAgent: string,
  extra?: Record<string, unknown>
): Promise<CaptionTrack[] | null> {
  try {
    const context: Record<string, unknown> = {
      client: { clientName, clientVersion, ...(extra?.clientExtra as Record<string, unknown> || {}) },
    };
    if (extra?.thirdParty) {
      context.thirdParty = extra.thirdParty;
    }

    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          Cookie: CONSENT_COOKIE,
        },
        body: JSON.stringify({ context, videoId }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (data?.playabilityStatus?.status !== "OK") return null;

    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("v");

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid video ID" },
      { status: 400 }
    );
  }

  // Try multiple InnerTube clients from edge runtime
  const clients = [
    {
      name: "ANDROID",
      version: "20.10.38",
      ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
      extra: { thirdParty: { embedUrl: "https://www.google.com" } },
    },
    {
      name: "IOS",
      version: "20.10.4",
      ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
      extra: {
        thirdParty: { embedUrl: "https://www.google.com" },
        clientExtra: {
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          osName: "iPhone",
          osVersion: "18.3.2",
        },
      },
    },
    {
      name: "WEB",
      version: "2.20250501.01.00",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      extra: {},
    },
  ];

  for (const client of clients) {
    const tracks = await tryInnerTube(
      videoId,
      client.name,
      client.version,
      client.ua,
      client.extra
    );

    if (tracks) {
      const track = selectTrack(tracks);
      let url = track.baseUrl;
      if (!url.includes("fmt=")) {
        url += (url.includes("?") ? "&" : "?") + "fmt=srv3";
      }

      try {
        const captionRes = await fetch(url);
        if (!captionRes.ok) continue;

        const xml = await captionRes.text();
        if (!xml || xml.length < 50) continue;

        const segments = parseTranscriptXml(xml);
        if (segments.length > 0) {
          return NextResponse.json({
            transcript: segments.join(" "),
            method: client.name,
          });
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback: direct timedtext API
  const langs = ["en", "en-US", "en-GB"];
  for (const lang of langs) {
    for (const kind of ["asr", ""]) {
      try {
        const params = new URLSearchParams({ v: videoId, lang, fmt: "srv3" });
        if (kind) params.set("kind", kind);
        const url = `https://www.youtube.com/api/timedtext?${params}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const xml = await res.text();
        if (!xml || xml.length < 50) continue;
        const segments = parseTranscriptXml(xml);
        if (segments.length > 0) {
          return NextResponse.json({
            transcript: segments.join(" "),
            method: "timedtext",
          });
        }
      } catch {
        continue;
      }
    }
  }

  return NextResponse.json(
    { error: "Could not extract transcript" },
    { status: 404 }
  );
}
