import type { Prompter } from '../lib/ask.ts';
import type { Answers, Config, Phase, Question } from '../lib/types.ts';
import { askable, questionsFor } from '../questions/index.ts';

/**
 * One runner for every phase. A question's default comes from the merged config by its
 * `configKey`, and its answer goes back to the same key — so `--yes` and an interactive run
 * produce identical output from identical inputs, which is what makes the wizard testable.
 */
export async function askPhase(
  phase: Phase,
  prompter: Prompter,
  answers: Answers,
  config: Config,
  only?: string[],
  skip?: string[],
): Promise<void> {
  const all = questionsFor(phase);
  const scoped = all
    .filter((q) => (only ? only.includes(q.id) : true))
    .filter((q) => !skip?.includes(q.id));

  for (const question of scoped) {
    if (!askable([question], answers).length) continue;
    const fallback = defaultFor(question, answers, config);
    answers[question.configKey] = await prompter.ask(question, fallback);
  }
}

function defaultFor(question: Question, answers: Answers, config: Config) {
  const existing = answers[question.configKey];
  if (existing !== undefined) return existing;
  const fromModels = modelDefault(question.configKey, config);
  if (fromModels !== null) return fromModels;
  if (question.configKey === 'projectsDir') return config.projectsDir;
  if (question.configKey === 'archiveHome') return config.archiveHome;
  return (
    question.options?.find((o) => o.recommended)?.value ?? question.options?.[0]?.value ?? ''
  );
}

function modelDefault(configKey: string, config: Config): string | null {
  if (configKey === 'models.deep') return config.models.deep;
  if (configKey === 'models.default') return config.models.default;
  if (configKey === 'models.fast') return config.models.fast;
  return null;
}
