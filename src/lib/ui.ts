import { diffLines } from './diff.ts';
import { contractHome } from './paths.ts';
import type { PlannedChange } from './write-plan.ts';

/** Console output lives here alone, so every other module stays testable without capture. */
export function say(line = ''): void {
  console.log(line);
}

export function short(path: string): string {
  return contractHome(path);
}

/** The preview tree: every file this run would touch, grouped by where it lands. */
export function previewTree(changes: PlannedChange[]): string {
  const groups = new Map<string, PlannedChange[]>();
  for (const change of changes) {
    const key = groupOf(change.file.path);
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }

  const lines: string[] = [];
  for (const [group, items] of groups) {
    lines.push(group);
    for (const item of items) {
      lines.push(`  ${leafOf(item.file.path)}  — ${item.file.label}  [${markOf(item)}]`);
    }
  }
  return lines.join('\n');
}

/** The bracket. A refusal outranks any diff: there is no change to summarize behind it. */
function markOf(change: PlannedChange): string {
  if (change.guard === 'no-stamp') return 'no stamp — left alone';
  return change.before.length === 0 ? 'new' : change.summary;
}

function groupOf(path: string): string {
  const shortened = short(path);
  const cut = shortened.lastIndexOf('/');
  return cut === -1 ? '.' : shortened.slice(0, cut);
}

function leafOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The per-file expansion behind the single batch confirm. */
export function renderDiff(change: PlannedChange, maxLines = 40): string {
  if (change.guard === 'no-stamp') return `${short(change.file.path)}: no stamp — left alone`;
  if (change.before === change.after) return `${short(change.file.path)}: unchanged`;
  const lines = diffLines(change.before, change.after);
  const shown = lines.slice(0, maxLines).map((l) => `${l.kind} ${l.text}`);
  const rest = lines.length - shown.length;
  const tail = rest > 0 ? [`… ${rest} more lines`] : [];
  return [`--- ${short(change.file.path)}`, ...shown, ...tail].join('\n');
}
