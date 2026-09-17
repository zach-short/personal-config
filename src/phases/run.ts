import { BACK, type Prompter } from '../lib/ask.ts';
import { storedProfileDefault } from '../lib/stored-profile-defaults.ts';
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

  // The trail is every index actually asked, in order, and it is what `← back` walks. A plain
  // `index - 1` would be wrong: a question skipped by its `when` was never asked, so stepping
  // onto it would show the person a question they have not seen as the one they came from.
  // An empty trail is also exactly the test for "this phase's first question", which is where
  // `← back` is deliberately not offered — `askPhase` is called once per phase and knows
  // nothing about the phase before it, so there is nowhere for it to go.
  const trail: number[] = [];

  for (let index = 0; index < scoped.length; ) {
    const question = scoped[index];
    if (!question || askable([question], answers).length === 0) {
      index += 1;
      continue;
    }

    const fallback = defaultFor(question, answers, config);
    const value = await prompter.ask(question, fallback, trail.length > 0);
    if (value === BACK) {
      index = trail.pop() ?? index;
      continue;
    }

    answers[question.configKey] = value;
    trail.push(index);
    index += 1;
  }
}

/**
 * Exported as an internal seam, not as API: it is the one place DIAL-7's promise is kept, and
 * the promise is that the explicit reading beats the option list — which cannot be observed
 * from outside, because the two agree for every question in the catalog today. A test hands it
 * a question whose `recommended` says the opposite. `src/cli.ts` is this package's only public
 * surface and nothing here widens it.
 */
export function defaultFor(question: Question, answers: Answers, config: Config) {
  const existing = answers[question.configKey];
  if (existing !== undefined) return existing;
  const stored = storedProfileDefault(question.configKey);
  if (stored !== null) return stored;
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
