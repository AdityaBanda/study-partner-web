import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const quiz = await db.quiz.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      document: { select: { title: true } },
    },
  });

  if (!quiz) notFound();

  return (
    <div>
      <QuizPlayer
        quiz={{
          id: quiz.id,
          title: quiz.title,
          document: quiz.document,
        }}
        questions={quiz.questions}
      />
    </div>
  );
}
