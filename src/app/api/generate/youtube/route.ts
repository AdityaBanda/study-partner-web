import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAll } from "@/lib/ai/generate";
import { YoutubeTranscript } from "youtube-transcript";
import { NextResponse } from "next/server";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, title } = await request.json();

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    console.log("[generate/youtube] Fetching transcript for:", videoId);
    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch {
      return NextResponse.json(
        { error: "Could not fetch transcript. The video may not have captions available." },
        { status: 400 }
      );
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "No transcript found for this video." },
        { status: 400 }
      );
    }

    const transcript = segments.map((s) => s.text).join(" ");
    const content = `[YouTube Video Transcript]\n\n${transcript}`;
    console.log("[generate/youtube] Transcript length:", transcript.length);

    const document = await db.document.create({
      data: {
        title: title || "YouTube Video",
        content,
        userId: session.user.id,
      },
    });

    console.log("[generate/youtube] Starting AI generation...");
    const { mermaidCode, branchDescriptions, explanations, questions } =
      await generateAll(content);

    const diagram = await db.diagram.create({
      data: {
        documentId: document.id,
        mermaidCode,
        branchDescriptions: JSON.stringify(branchDescriptions),
      },
    });

    for (let i = 0; i < explanations.length; i++) {
      const exp = explanations[i];
      await db.explanation.create({
        data: {
          documentId: document.id,
          title: exp.title,
          whatItIs: exp.whatItIs,
          whyItMatters: exp.whyItMatters,
          analogy: exp.analogy,
          businessValue: exp.businessValue,
          order: i,
        },
      });
    }

    const quiz = await db.quiz.create({
      data: {
        documentId: document.id,
        userId: session.user.id,
        title: title || "YouTube Video Quiz",
        questions: {
          create: questions.map((q, i) => ({
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            order: i,
          })),
        },
      },
      include: { questions: true },
    });

    return NextResponse.json({
      documentId: document.id,
      diagramId: diagram.id,
      quizId: quiz.id,
      mermaidCode,
      explanations,
      questionCount: questions.length,
    });
  } catch (error) {
    console.error("[generate/youtube] ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate content", detail: message },
      { status: 500 }
    );
  }
}
