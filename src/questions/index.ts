import type { Answers, PracticeArea, Question } from '../lib/types.ts';
import { DISCOVER_QUESTIONS } from './discover.ts';
import { CODE_AREAS } from './practices-code.ts';
import { POLICY_AREAS } from './practices-policy.ts';
import { YOU_QUESTIONS } from './you.ts';

export const PRACTICE_AREAS: PracticeArea[] = [...CODE_AREAS, ...POLICY_AREAS];

export const PRACTICE_QUESTIONS: Question[] = PRACTICE_AREAS.map((a) => a.question);

export const ALL_QUESTIONS: Question[] = [
  ...YOU_QUESTIONS,
  ...DISCOVER_QUESTIONS,
  ...PRACTICE_QUESTIONS,
];

export { YOU_QUESTIONS, DISCOVER_QUESTIONS };

export function questionsFor(phase: Question['phase']): Question[] {
  return ALL_QUESTIONS.filter((q) => q.phase === phase);
}

export function askable(questions: Question[], answers: Answers): Question[] {
  return questions.filter((q) => q.when === undefined || q.when(answers));
}

export function findQuestion(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

/** Every question's long form must exist; `doctor` and a test both check this list. */
export function readMoreIds(): string[] {
  return [...new Set(ALL_QUESTIONS.map((q) => q.readMore))];
}
