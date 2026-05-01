"use client";

import { useState } from "react";

interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  order: number;
}

interface QuizPlayerProps {
  quiz: {
    id: string;
    title: string;
    document: { title: string };
  };
  questions: Question[];
}

type OptionKey = "A" | "B" | "C" | "D";

export function QuizPlayer({ quiz, questions }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [showResults, setShowResults] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const current = questions[currentIndex];
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

  const optionText = (q: Question, key: OptionKey): string => {
    const map: Record<OptionKey, string> = {
      A: q.optionA,
      B: q.optionB,
      C: q.optionC,
      D: q.optionD,
    };
    return map[key];
  };

  const score = questions.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0);

  if (showResults) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-card rounded-xl border border-border p-8">
          <h2 className="text-2xl font-semibold mb-2">Quiz Complete</h2>
          <p className="text-muted mb-6">{quiz.title}</p>

          <div className="text-center py-8 mb-8 bg-background rounded-xl">
            <p className="text-5xl font-bold mb-2">
              {score}/{questions.length}
            </p>
            <p className="text-muted">
              {score === questions.length
                ? "Perfect score!"
                : score >= questions.length * 0.7
                ? "Great job!"
                : "Keep studying!"}
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((q, i) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correctAnswer;
              return (
                <div key={q.id} className="bg-background rounded-lg p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {isCorrect ? "✓" : "✗"}
                    </span>
                    <p className="font-medium">
                      {i + 1}. {q.text}
                    </p>
                  </div>
                  <p className="text-sm text-muted ml-9">
                    Your answer:{" "}
                    <span className={isCorrect ? "text-success" : "text-destructive"}>
                      {selected ? `${selected}. ${optionText(q, selected)}` : "Not answered"}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-sm text-success ml-9 mt-1">
                      Correct: {q.correctAnswer}. {optionText(q, q.correctAnswer as OptionKey)}
                    </p>
                  )}
                  <p className="text-sm text-muted mt-2 ml-9 italic">
                    {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              setShowResults(false);
              setAnswers({});
              setRevealed({});
              setCurrentIndex(0);
            }}
            className="mt-8 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card rounded-xl border border-border p-8">
        <div className="flex justify-between items-center mb-6">
          <span className="text-muted text-sm">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  i === currentIndex
                    ? "bg-accent text-white"
                    : answers[questions[i].id]
                    ? "bg-accent/20 text-accent"
                    : "bg-background text-muted hover:text-white"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border mb-6" />

        <div className="inline-block bg-warning/20 text-warning text-xs font-medium px-3 py-1 rounded mb-4">
          {quiz.title}
        </div>

        <h3 className="text-xl font-medium mb-8 leading-relaxed">
          {current.text}
        </h3>

        <div className="space-y-3">
          {optionKeys.map((key) => {
            const selected = answers[current.id] === key;
            const isRevealed = revealed[current.id];
            const isCorrect = key === current.correctAnswer;

            let borderClass = "border-border hover:border-muted";
            if (selected && !isRevealed) borderClass = "border-accent";
            if (isRevealed && isCorrect) borderClass = "border-success bg-success/5";
            if (isRevealed && selected && !isCorrect)
              borderClass = "border-destructive bg-destructive/5";

            return (
              <button
                key={key}
                onClick={() => {
                  if (!isRevealed) {
                    setAnswers({ ...answers, [current.id]: key });
                  }
                }}
                className={`w-full text-left bg-background border ${borderClass} rounded-lg p-4 flex items-start gap-3 transition-all`}
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                    selected
                      ? "border-accent bg-accent text-white"
                      : "border-muted text-muted"
                  }`}
                >
                  {isRevealed && isCorrect
                    ? "✓"
                    : isRevealed && selected && !isCorrect
                    ? "✗"
                    : key}
                </span>
                <span>
                  {key}. {optionText(current, key)}
                </span>
              </button>
            );
          })}
        </div>

        {revealed[current.id] && (
          <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="text-sm text-muted italic">{current.explanation}</p>
          </div>
        )}

        <div className="h-px bg-border my-6" />

        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="text-sm text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &lt; Previous
          </button>

          <div className="flex gap-3">
            {answers[current.id] && !revealed[current.id] && (
              <button
                onClick={() => setRevealed({ ...revealed, [current.id]: true })}
                className="px-4 py-2 text-sm bg-warning/20 text-warning rounded-lg hover:bg-warning/30 transition-colors"
              >
                Check Answer
              </button>
            )}

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
                }
                className="px-6 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
              >
                Next &gt;
              </button>
            ) : (
              <button
                onClick={() => setShowResults(true)}
                className="px-6 py-2 text-sm bg-success hover:bg-success/80 text-white rounded-lg font-medium transition-colors"
              >
                Finish Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
