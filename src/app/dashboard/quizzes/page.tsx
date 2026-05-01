import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function QuizzesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quizzes = await db.quiz.findMany({
    where: { userId: session.user.id },
    include: {
      questions: { select: { id: true } },
      document: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Quizzes</h1>

      {quizzes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted mb-4">No quizzes yet.</p>
          <Link
            href="/dashboard/canvas"
            className="text-accent hover:underline"
          >
            Go to Canvas to generate your first quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/dashboard/quizzes/${quiz.id}`}
              className="block bg-card border border-border rounded-xl p-5 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{quiz.title}</h3>
                  <p className="text-sm text-muted mt-1">
                    {quiz.questions.length} questions &middot; From:{" "}
                    {quiz.document.title}
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-muted"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
