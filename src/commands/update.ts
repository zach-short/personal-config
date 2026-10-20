import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { confirmWrite } from '../lib/ask.ts';
import { readJson } from '../lib/disk.ts';
import { repoRoot } from '../lib/paths.ts';
import { compareVersions } from '../lib/semver.ts';
import type { Cli } from '../lib/types.ts';
import { say } from '../lib/ui.ts';
import { version } from '../lib/version.ts';

const TIMEOUT_MS = 10_000;

/**
 * `personal-config update` — install the latest release from npm. `upgrade` is taken (it reports
 * what changed in the adapted standard), so this one updates the tool itself. `--dry-run` only
 * reports; otherwise it asks, then runs `npm install -g <name>@latest`.
 */
export async function runUpdate(cli: Cli): Promise<number> {
  const name = await packageName();
  const installed = await version();
  const latest = await latestVersion(name);

  const order = compareVersions(installed, latest);
  if (order === null) throw new Error(`cannot compare ${installed} with ${latest}`);
  if (order >= 0) {
    say(`personal-config ${installed} is up to date.`);
    return 0;
  }
  say(`personal-config ${installed} → ${latest} is available.`);
  if (cli.dryRun) {
    say(`--dry-run: would run \`npm install -g ${name}@latest\`.`);
    return 0;
  }
  if (!(await confirmWrite(`Run \`npm install -g ${name}@latest\`?`, cli.force))) {
    say('Nothing was installed.');
    return 0;
  }
  const code = await npmInstall(name);
  if (code !== 0) {
    console.error(
      `personal-config: npm exited with ${code}. Run \`npm install -g ${name}@latest\` yourself to see why.`,
    );
    return 1;
  }
  say(`Updated to ${latest}.`);
  return 0;
}

async function packageName(): Promise<string> {
  const pkg = (await readJson(join(repoRoot(), 'package.json'))) as { name?: string };
  if (pkg.name === undefined) throw new Error('package.json has no "name"');
  return pkg.name;
}

async function latestVersion(name: string): Promise<string> {
  const url = `https://registry.npmjs.org/${name}/latest`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(`could not reach the npm registry (${url})`);
  }
  if (!response.ok) throw new Error(`the npm registry answered ${response.status} (${url})`);
  const body = (await response.json()) as { version?: string };
  if (typeof body.version !== 'string')
    throw new Error(`the npm registry sent no version (${url})`);
  return body.version;
}

function npmInstall(name: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${name}@latest`], { stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}
