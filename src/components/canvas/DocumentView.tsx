"use client";

import { useState, useCallback, useMemo } from "react";
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findMatch(
  nodeText: string,
  explanations: Explanation[],
  branches: BranchDescription[]
): { explanation: Explanation | null; branch: BranchDescription | null } {
  const norm = normalize(nodeText);

  // Exact match on explanation title
  const exactExp = explanations.find((e) => normalize(e.title) === norm);
  if (exactExp) return { explanation: exactExp, branch: null };

  // Explanation title contains node text or vice versa
  const partialExp = explanations.find(
    (e) => normalize(e.title).includes(norm) || norm.includes(normalize(e.title))
  );
  if (partialExp) return { explanation: partialExp, branch: null };

  // Word-level overlap: find the explanation with the most overlapping words
  const nodeWords = norm.length > 3 ? nodeText.toLowerCase().split(/\s+/).filter((w) => w.length > 2) : [];
  if (nodeWords.length > 0) {
    let bestExp: Explanation | null = null;
    let bestScore = 0;
    for (const exp of explanations) {
      const titleLower = exp.title.toLowerCase();
      const score = nodeWords.filter((w) => titleLower.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestExp = exp;
      }
    }
    if (bestExp && bestScore > 0) return { explanation: bestExp, branch: null };
  }

  // Check branches
  const exactBranch = branches.find((b) => normalize(b.branch) === norm);
  if (exactBranch) return { explanation: null, branch: exactBranch };

  const partialBranch = branches.find(
    (b) =>
      normalize(b.branch).includes(norm) || norm.includes(normalize(b.branch))
  );
  if (partialBranch) return { explanation: null, branch: partialBranch };

  // Search explanation content for the node text
  if (nodeText.length > 3) {
    const contentMatch = explanations.find(
      (e) =>
        e.whatItIs.toLowerCase().includes(nodeText.toLowerCase()) ||
        e.whyItMatters.toLowerCase().includes(nodeText.toLowerCase())
    );
    if (contentMatch) return { explanation: contentMatch, branch: null };
  }

  return { explanation: null, branch: null };
}

export function DocumentView({ document: doc }: DocumentViewProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const branches: BranchDescription[] = useMemo(() => {
    if (!doc.diagram?.branchDescriptions) return [];
    try {
      return JSON.parse(doc.diagram.branchDescriptions);
    } catch {
      return [];
    }
  }, [doc.diagram?.branchDescriptions]);

  const match = useMemo(() => {
    if (!selectedNode) return { explanation: null, branch: null };
    return findMatch(selectedNode, doc.explanations, branches);
  }, [selectedNode, doc.explanations, branches]);

  const handleNodeClick = useCallback((nodeText: string) => {
    setSelectedNode((prev) => (prev === nodeText ? null : nodeText));
  }, []);

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
          <h3 className="text-lg font-medium mb-2">Mind Map</h3>
          <p className="text-xs text-muted mb-4">
            Click any node to see its explanation
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className={selectedNode ? "xl:col-span-2" : "xl:col-span-2"}>
              <DiagramViewer
                mermaidCode={doc.diagram.mermaidCode}
                onNodeClick={handleNodeClick}
              />
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer hover:text-foreground">
                  View Mermaid code (copy for Whimsical)
                </summary>
                <pre className="mt-2 text-xs bg-card border border-border rounded-lg p-4 overflow-auto">
                  {doc.diagram.mermaidCode}
                </pre>
              </details>
            </div>

            <div className="space-y-4">
              {selectedNode ? (
                <div className="bg-card border border-accent/50 rounded-xl p-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-accent text-lg">
                      {selectedNode}
                    </h4>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-muted hover:text-foreground p-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {match.explanation ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-foreground">
                          What it is:{" "}
                        </span>
                        <span className="text-muted">
                          {match.explanation.whatItIs}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">
                          Why it matters:{" "}
                        </span>
                        <span className="text-muted">
                          {match.explanation.whyItMatters}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">
                          Analogy:{" "}
                        </span>
                        <span className="text-muted">
                          {match.explanation.analogy}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">
                          Business value:{" "}
                        </span>
                        <span className="text-muted">
                          {match.explanation.businessValue}
                        </span>
                      </div>
                    </div>
                  ) : match.branch ? (
                    <div className="text-sm">
                      <p className="text-muted leading-relaxed">
                        {match.branch.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted italic">
                      This is a concept node in the mind map. Check the
                      explanations below for more detail on related topics.
                    </p>
                  )}
                </div>
              ) : (
                branches.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
                      Branch Guide
                    </h4>
                    {branches.map((b, i) => (
                      <div
                        key={b.branch}
                        className={`border-l-2 ${BRANCH_COLORS[i % BRANCH_COLORS.length]} pl-3 py-2 mb-2 cursor-pointer hover:bg-card/50 rounded-r-lg transition-colors`}
                        onClick={() => setSelectedNode(b.branch)}
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
                )
              )}
            </div>
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
                id={`explanation-${normalize(exp.title)}`}
                className={`bg-card border rounded-xl p-5 transition-colors ${
                  selectedNode && match.explanation?.id === exp.id
                    ? "border-accent"
                    : "border-border"
                }`}
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
