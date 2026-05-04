import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          documents: true,
          quizzes: true,
        },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Users</h2>
        <p className="text-muted text-sm mt-1">
          {users.length} registered {users.length === 1 ? "user" : "users"}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium text-center">Documents</th>
              <th className="px-5 py-3 font-medium text-center">Quizzes</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0 hover:bg-sidebar-active/30 transition-colors"
              >
                <td className="px-5 py-4 font-medium text-foreground">
                  {user.name || "—"}
                </td>
                <td className="px-5 py-4 text-muted">{user.email}</td>
                <td className="px-5 py-4 text-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 text-center text-foreground">
                  {user._count.documents}
                </td>
                <td className="px-5 py-4 text-center text-foreground">
                  {user._count.quizzes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
