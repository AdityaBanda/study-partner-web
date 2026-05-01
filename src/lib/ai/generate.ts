import Anthropic from "@anthropic-ai/sdk";
import {
  DIAGRAM_SYSTEM_PROMPT,
  EXPLANATION_SYSTEM_PROMPT,
  QUIZ_SYSTEM_PROMPT,
} from "./prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) return match[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}

export interface ExplanationData {
  title: string;
  whatItIs: string;
  whyItMatters: string;
  analogy: string;
  businessValue: string;
}

export interface QuizQuestionData {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface BranchDescription {
  branch: string;
  description: string;
}

export interface DiagramResult {
  mermaidCode: string;
  branchDescriptions: BranchDescription[];
}

export async function generateDiagram(content: string): Promise<DiagramResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: DIAGRAM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this content and generate a mindmap with branch descriptions:\n\n${content}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const mermaidMatch = text.match(/```mermaid\n([\s\S]*?)\n```/);
  const mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : text.trim();

  const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?```/);
  let branchDescriptions: BranchDescription[] = [];
  if (jsonMatch) {
    try {
      branchDescriptions = JSON.parse(jsonMatch[1].trim());
    } catch {
      branchDescriptions = [];
    }
  }

  return { mermaidCode, branchDescriptions };
}

export async function generateExplanations(
  content: string
): Promise<ExplanationData[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: EXPLANATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate PM-friendly explanations for the key concepts in this content:\n\n${content}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "[]";
  return JSON.parse(extractJSON(text));
}

export async function generateQuiz(
  content: string
): Promise<QuizQuestionData[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: QUIZ_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate quiz questions based on this content:\n\n${content}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "[]";
  return JSON.parse(extractJSON(text));
}

export async function generateAll(content: string) {
  const [diagramResult, explanations, questions] = await Promise.all([
    generateDiagram(content),
    generateExplanations(content),
    generateQuiz(content),
  ]);

  return {
    mermaidCode: diagramResult.mermaidCode,
    branchDescriptions: diagramResult.branchDescriptions,
    explanations,
    questions,
  };
}
