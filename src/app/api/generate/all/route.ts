import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAll } from "@/lib/ai/generate";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    console.log("[generate/all] Creating document...");
    const document = await db.document.create({
      data: {
        title: title || "Untitled Document",
        content,
        userId: session.user.id,
      },
    });
    console.log("[generate/all] Document created:", document.id);

    console.log("[generate/all] Starting AI generation...");
    const { mermaidCode, branchDescriptions, explanations, questions } =
      await generateAll(content);
    console.log("[generate/all] AI generation complete:", {
      diagramLength: mermaidCode.length,
      branchCount: branchDescriptions.length,
      explanationCount: explanations.length,
      questionCount: questions.length,
    });

    console.log("[generate/all] Saving to database...");
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
        title: title || "Untitled Quiz",
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
    console.log("[generate/all] Saved to database successfully");

    return NextResponse.json({
      documentId: document.id,
      diagramId: diagram.id,
      quizId: quiz.id,
      mermaidCode,
      explanations,
      questionCount: questions.length,
    });
  } catch (error) {
    console.error("[generate/all] ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate content", detail: message },
      { status: 500 }
    );
  }
}
