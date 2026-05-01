import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { TextEditor } from "@/components/canvas/TextEditor";
import { DocumentView } from "@/components/canvas/DocumentView";
import { DocumentSelector } from "@/components/canvas/DocumentSelector";

export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { doc: docId } = await searchParams;

  const documents = await db.document.findMany({
    where: { userId: session.user.id },
    include: {
      diagram: true,
      explanations: { orderBy: { order: "asc" } },
      quiz: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedDoc = docId
    ? documents.find((d) => d.id === docId)
    : documents[0];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Canvas</h1>
        {documents.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Document:</label>
            <DocumentSelector
              documents={documents.map((d) => ({ id: d.id, title: d.title }))}
              currentId={selectedDoc?.id}
            />
          </div>
        )}
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="text-lg font-medium mb-4">New Document</h2>
          <TextEditor />
        </section>

        {selectedDoc && (
          <section className="pt-8 border-t border-border">
            <DocumentView
              document={{
                ...selectedDoc,
                createdAt: selectedDoc.createdAt.toISOString(),
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
