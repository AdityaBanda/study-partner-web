"use client";

import { DiagramViewer } from "./DiagramViewer";

interface BranchDescription {
  branch: string;
  description: string;
}

interface Explanation {
  id: string;
  title: string;
  whatItIs: string;
  whyItMatters: string;
  analogy: string;
  businessValue: string;
}

interface DocumentViewProps {
  document: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    diagram: { mermaidCode: string; branchDescriptions: string } | null;
    explanations: Explanation[];
    quiz: { id: string; title: string } | null;
  };
}

const BRANCH_COLORS = [
  "border-blue-500",
  "border-emerald-500",
  "border-amber-500",
  "border-purple-500",
  "border-rose-500",
  "border-cyan-500",
  "border-orange-500",
];

const BRANCH_DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
];

export function DocumentView({ document: doc }: DocumentViewProps) {
  let branches: BranchDescription[] = [];
  if (doc.diagram?.branchDescriptions) {
    try {
      branches = JSON.parse(doc.diagram.branchDescriptions);
    } catch {
      branches = [];
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-1">{doc.title}</h2>
        <p className="text-muted text-sm">
          Created {new Date(doc.createdAt).toLocaleDateString()}
        </p>
      </div>

      {doc.diagram && (
        <section>
          <h3 className="text-lg font-medium mb-4">Mind Map</h3>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <DiagramViewer mermaidCode={doc.diagram.mermaidCode} />
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer hover:text-foreground">
                  View Mermaid code (copy for Whimsical)
                </summary>
                <pre className="mt-2 text-xs bg-card border border-border rounded-lg p-4 overflow-auto">
                  {doc.diagram.mermaidCode}
                </pre>
              </details>
            </div>

            {branches.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted uppercase tracking-wide">
                  Branch Guide
                </h4>
                {branches.map((b, i) => (
                  <div
                    key={b.branch}
                    className={`border-l-2 ${BRANCH_COLORS[i % BRANCH_COLORS.length]} pl-3 py-2`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${BRANCH_DOT_COLORS[i % BRANCH_DOT_COLORS.length]}`}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {b.branch}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {doc.explanations.length > 0 && (
        <section>
          <h3 className="text-lg font-medium mb-4">
            Concept Explanations (PM-Friendly)
          </h3>
          <div className="space-y-4">
            {doc.explanations.map((exp) => (
              <div
                key={exp.id}
                className="bg-card border border-border rounded-xl p-5"
              >
                <h4 className="font-semibold text-accent mb-3">{exp.title}</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">
                      What it is:{" "}
                    </span>
                    <span className="text-muted">{exp.whatItIs}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Why it matters:{" "}
                    </span>
                    <span className="text-muted">{exp.whyItMatters}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Analogy:{" "}
                    </span>
                    <span className="text-muted">{exp.analogy}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Business value:{" "}
                    </span>
                    <span className="text-muted">{exp.businessValue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {doc.quiz && (
        <section>
          <a
            href={`/dashboard/quizzes/${doc.quiz.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            Take Quiz
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </section>
      )}
    </div>
  );
}
