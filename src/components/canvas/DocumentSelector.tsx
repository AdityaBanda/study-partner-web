"use client";

import { useRouter } from "next/navigation";

export function DocumentSelector({
  documents,
  currentId,
}: {
  documents: { id: string; title: string }[];
  currentId?: string;
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={currentId}
      onChange={(e) => {
        router.push(`/dashboard/canvas?doc=${e.target.value}`);
      }}
      className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
    >
      {documents.map((d) => (
        <option key={d.id} value={d.id}>
          {d.title}
        </option>
      ))}
    </select>
  );
}
